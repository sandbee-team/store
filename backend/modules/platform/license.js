"use strict";
const { readFileSync } = require("node:fs");
const {
  createPrivateKey,
  createPublicKey,
  sign,
  createHash,
} = require("node:crypto");
function createSigner(config) {
  const privateKey = createPrivateKey(readFileSync(config.licenseKeyFile));
  if (privateKey.asymmetricKeyType !== "ed25519")
    throw new Error("License signing key must be Ed25519");
  const publicKey = createPublicKey(privateKey).export({
    type: "spki",
    format: "pem",
  });
  const kid = createHash("sha256").update(publicKey).digest("hex").slice(0, 16);
  return {
    publicKey,
    kid,
    issue({ userId, tokenId, installationId, platform }) {
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iss: config.licenseIssuer,
        aud: "@sandbee/ocr",
        sub: String(userId),
        tokenId,
        installationId,
        platform,
        scope: "ocr:local",
        iat: now,
        exp: now + config.licenseSeconds,
      };
      const parts = [
        Buffer.from(JSON.stringify({ alg: "EdDSA", typ: "JWT", kid })).toString(
          "base64url",
        ),
        Buffer.from(JSON.stringify(payload)).toString("base64url"),
      ];
      return `${parts.join(".")}.${sign(null, Buffer.from(parts.join(".")), privateKey).toString("base64url")}`;
    },
  };
}
module.exports = { createSigner };
