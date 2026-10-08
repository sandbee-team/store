"use strict";
const fs = require("node:fs");
const { randomBytes, generateKeyPairSync } = require("node:crypto");
fs.mkdirSync(".local", { recursive: true });
if (!fs.existsSync(".local/license-private.pem")) {
  const pair = generateKeyPairSync("ed25519");
  fs.writeFileSync(
    ".local/license-private.pem",
    pair.privateKey.export({ type: "pkcs8", format: "pem" }),
    { mode: 0o600, flag: "wx" },
  );
  fs.writeFileSync(
    ".local/license-public.pem",
    pair.publicKey.export({ type: "spki", format: "pem" }),
    { flag: "wx" },
  );
}
if (!fs.existsSync(".env"))
  fs.writeFileSync(
    ".env",
    fs
      .readFileSync(".env.example", "utf8")
      .replace(
        "replace-with-generated-secret",
        randomBytes(48).toString("hex"),
      ),
    { mode: 0o600, flag: "wx" },
  );
let current = fs.readFileSync(".env", "utf8");
for (const name of ["GST_SERVICE_SECRET", "OCR_DEMO_SERVICE_SECRET", "OCR_LICENSE_SERVICE_SECRET"]) {
  const pattern = new RegExp(`^${name}=.*$`, "m");
  const existing = current.match(pattern)?.[0];
  if (!existing || /replace-with/.test(existing)) {
    const line = `${name}=${randomBytes(48).toString("hex")}`;
    current = existing
      ? current.replace(pattern, line)
      : current + "\n" + line + "\n";
  }
}
fs.writeFileSync(".env", current, { mode: 0o600 });
console.log(
  "Local environment and persistent signing key ready. Existing values were preserved.",
);
