"use strict";
// Local-only smoke: creates a disposable account through the real auth/SMTP flow.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID, randomBytes } = require("node:crypto");
const { spawn } = require("node:child_process");
const base = "http://localhost:8094";
let cookie, csrf;
async function api(route, body, method = body ? "POST" : "GET") {
  const response = await fetch(base + route, {
    method,
    headers: {
      Origin: base,
      ...(cookie ? { Cookie: cookie, "X-CSRF-Token": csrf } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok)
    throw Error(`${route}: ${response.status} ${result.error?.code}`);
  if (response.headers.has("set-cookie"))
    cookie = response.headers.get("set-cookie").split(";")[0];
  if (result.csrfToken) csrf = result.csrfToken;
  return result;
}
async function main() {
  const email = `installed-${randomUUID()}@example.test`;
  await api("/api/auth/signup", {
    name: "Package smoke test",
    email,
    password: randomBytes(24).toString("base64url"),
  });
  let code;
  for (let n = 0; n < 20 && !code; n++) {
    const messages = await (
      await fetch("http://localhost:8029/api/v1/messages")
    ).json();
    const message = messages.messages?.find((m) =>
      m.To?.some((t) => t.Address === email),
    );
    if (message) {
      const body = await (
        await fetch(`http://localhost:8029/api/v1/message/${message.ID}`)
      ).json();
      code = /\b\d{6}\b/.exec(body.Text)?.[0];
    }
    if (!code) await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(code, "OTP delivered to local Mailpit");
  await api("/api/auth/verification/confirm", { code });
  await api("/api/onboarding", {
    company: "Package smoke workspace",
    useCase: "development",
  });
  for (const id of ["gst", "ocr"])
    await api(`/api/apps/${id}/activation`, { enabled: true }, "PUT");
  const key = await api("/api/tokens", {
    name: "Installed package check",
    scope: "global",
  });
  const platform = await api("/api/platform");
  const directory = path.resolve(".local/installed-consumer");
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, "package.json"),
    JSON.stringify({
      name: "sandbee-installed-smoke",
      version: "1.0.0",
      private: true,
    }),
  );
  const download = await fetch(base + platform.package.download, {
    headers: { Cookie: cookie },
  });
  assert.equal(download.status, 200);
  await fs.writeFile(
    path.join(directory, "sandbee-ocr-0.1.0.tgz"),
    Buffer.from(await download.arrayBuffer()),
  );
  await new Promise((resolve, reject) => {
    const install = spawn(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["install", "./sandbee-ocr-0.1.0.tgz", "--no-audit", "--no-fund"],
      {
        cwd: directory,
        shell: process.platform === "win32",
        windowsHide: true,
        stdio: "ignore",
      },
    );
    install.once("error", reject);
    install.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(Error(`Consumer package installation failed: exit ${code}`)),
    );
  });
  const { SandbeeOCR } = require(
    path.join(directory, "node_modules/@sandbee/ocr"),
  );
  const installationId = randomUUID();
  const ocr = new SandbeeOCR({
    token: key.token,
    installationId,
    label: "Installed tarball smoke",
    issuer: base,
    publicKey: platform.license.publicKey,
    allowLocalDevelopment: true,
  });
  let output;
  const realFetch = global.fetch;
  global.fetch = async (...args) => {
    try {
      return await realFetch(...args);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "smoke_transport_failed",
          type: error.name,
          code: error.cause?.code || error.code,
        }),
      );
      throw error;
    }
  };
  try {
    await ocr.start();
    output = await ocr.extract({
      documentType: "PAN",
      files: [path.resolve("frontend/public/sample-pan.png")],
    });
  } finally {
    ocr.close();
    global.fetch = realFetch;
  }
  assert.equal(output.fields.panNumber.value, "ABCPS1234D");
  assert.equal(output.fields.name.value, "ARJUN SHARMA");
  assert.equal(output.meta.documentsUploaded, false);
  await api(`/api/tokens/${key.metadata.id}`, undefined, "DELETE");
  const denied = await fetch(base + "/api/v1/ocr/license", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key.token}`,
    },
    body: JSON.stringify({
      installationId,
      label: "Revoked check",
      platform: "win32-x64",
    }),
  });
  assert.equal(denied.status, 401);
  let gst = { attempted: false };
  if (process.argv.includes("--live-gst")) {
    const gstKey = await api("/api/tokens", {
      name: "GST smoke",
      scope: "gst:read",
    });
    const response = await fetch(
      platform.endpoints.gst + "/api/v1/gstin/09AAFPC6958E1ZN",
      {
        headers: { Authorization: `Bearer ${gstKey.token}` },
        signal: AbortSignal.timeout(70000),
      },
    );
    const body = await response.json();
    gst = {
      attempted: true,
      status: response.status,
      success: body.success === true,
      source: body.meta?.source,
      error: body.error?.code,
    };
    if (response.ok) assert.equal(body.data.gstin, "09AAFPC6958E1ZN");
    await api(`/api/tokens/${gstKey.metadata.id}`, undefined, "DELETE");
  }
  const report = {
    checkedAt: new Date().toISOString(),
    installedTarball: true,
    nativeFieldsMatched: 2,
    documentsUploaded: false,
    revokedLeaseRequestStatus: denied.status,
    gst,
  };
  await fs.mkdir("test-results", { recursive: true });
  await fs.writeFile(
    "test-results/installed-smoke.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (gst.attempted && !gst.success) process.exitCode = 1;
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
