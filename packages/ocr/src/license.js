"use strict";
const { createPublicKey, verify } = require("node:crypto");
function licenseError(code, message) {
  return Object.assign(new Error(message), { code });
}
function verifyLease(
  lease,
  { publicKey, issuer, installationId, platform, now = Date.now() },
) {
  try {
    if (typeof lease !== "string" || lease.length > 8192) throw Error();
    const parts = lease.split(".");
    if (parts.length !== 3 || parts.some((p) => !/^[\w-]+$/.test(p)))
      throw Error();
    const header = JSON.parse(Buffer.from(parts[0], "base64url"));
    const key = createPublicKey(publicKey);
    if (
      header.alg !== "EdDSA" ||
      header.typ !== "JWT" ||
      key.asymmetricKeyType !== "ed25519"
    )
      throw Error();
    if (
      !verify(
        null,
        Buffer.from(`${parts[0]}.${parts[1]}`),
        key,
        Buffer.from(parts[2], "base64url"),
      )
    )
      throw Error();
    const claims = JSON.parse(Buffer.from(parts[1], "base64url"));
    const seconds = Math.floor(now / 1000);
    if (
      claims.iss !== issuer ||
      claims.aud !== "@sandbee/ocr" ||
      claims.scope !== "ocr:local" ||
      claims.installationId !== installationId ||
      claims.platform !== platform ||
      !Number.isSafeInteger(claims.iat) ||
      !Number.isSafeInteger(claims.exp) ||
      claims.exp <= seconds ||
      claims.iat > seconds + 5 ||
      claims.exp <= claims.iat ||
      claims.exp - claims.iat > 300 ||
      typeof claims.sub !== "string" ||
      typeof claims.tokenId !== "string"
    )
      throw Error();
    return claims;
  } catch {
    throw licenseError(
      "LICENSE_INVALID",
      "The license signature, binding or validity window is invalid. Check the pinned public key and server clock.",
    );
  }
}
class LicenseClient {
  constructor(options) {
    this.options = options;
    this.lease = null;
    this.pending = null;
    this.timer = null;
    this.closed = false;
    this.blocked = null;
    this.abort = new AbortController();
  }
  async start() {
    await this.ensure();
    if (!this.timer && !this.closed) {
      this.timer = setInterval(() => {
        this.renew().catch(() => {});
      }, 45000);
      this.timer.unref();
    }
  }
  close() {
    this.closed = true;
    clearInterval(this.timer);
    this.timer = null;
    this.lease = null;
    this.abort.abort();
  }
  async ensure() {
    if (this.closed)
      throw licenseError("CLIENT_CLOSED", "This license client is closed.");
    if (this.blocked) throw this.blocked;
    if (this.lease) {
      try {
        return verifyLease(this.lease, this.options);
      } catch {
        this.lease = null;
      }
    }
    return this.renew();
  }
  async renew() {
    if (this.closed)
      throw licenseError("CLIENT_CLOSED", "This license client is closed.");
    if (this.pending) return this.pending;
    this.pending = this.refresh();
    try {
      return await this.pending;
    } finally {
      this.pending = null;
    }
  }
  async refresh() {
    const { issuer, token, installationId, label, platform } = this.options;
    let response;
    try {
      response = await fetch(`${issuer}/api/v1/ocr/license`, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.any([
          AbortSignal.timeout(10000),
          this.abort.signal,
        ]),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ installationId, label, platform }),
      });
    } catch {
      throw licenseError(
        "LICENSE_UNAVAILABLE",
        "Cannot verify your Sandbee license. Check connectivity and retry. Documents have not been uploaded.",
      );
    }
    if (!response.ok) {
      await response.body?.cancel();
      const error = licenseError(
        response.status === 429 ? "LICENSE_RATE_LIMITED" : "LICENSE_DENIED",
        "License access was denied. Check the token and installation in Sandbee Store.",
      );
      if ([401, 403].includes(response.status)) {
        this.lease = null;
        this.blocked = error;
      }
      throw error;
    }
    const reader = response.body.getReader();
    const parts = [];
    let length = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 16384) {
        await reader.cancel();
        throw licenseError(
          "LICENSE_INVALID",
          "License response exceeded the allowed size.",
        );
      }
      parts.push(value);
    }
    let lease;
    try {
      lease = JSON.parse(Buffer.concat(parts).toString("utf8")).lease;
    } catch {
      throw licenseError("LICENSE_INVALID", "Invalid license response.");
    }
    const claims = verifyLease(lease, this.options);
    if (this.closed)
      throw licenseError("CLIENT_CLOSED", "This license client is closed.");
    this.blocked = null;
    this.lease = lease;
    return claims;
  }
}
module.exports = { LicenseClient, verifyLease, licenseError };
