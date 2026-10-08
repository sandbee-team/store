"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const engineRoot = path.resolve("packages/ocr/vendor/doc-extractor");
const manifest = JSON.parse(fs.readFileSync(path.join(engineRoot, "MANIFEST.json"), "utf8"));
const requiredEngineFiles = [...new Set(["dist/index.js", ...Object.keys(manifest.files)])];
// Validate the portable source before producing a customer download. The
// vendored dist directory is required even when application dist is excluded.
for (const relative of requiredEngineFiles) {
  const file = path.resolve(engineRoot, relative);
  if (!file.startsWith(engineRoot + path.sep)) throw new Error("Invalid engine manifest path");
  const bytes = fs.readFileSync(file);
  if (manifest.files[relative] && createHash("sha256").update(bytes).digest("hex") !== manifest.files[relative].sha256)
    throw new Error(`Engine file integrity failed: ${relative}`);
}
fs.mkdirSync("artifacts", { recursive: true });
const result = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["pack", "./packages/ocr", "--pack-destination", "./artifacts", "--json"],
  { encoding: "utf8", shell: process.platform === "win32" },
);
if (result.status !== 0) {
  console.error(result.stderr);
  process.exit(1);
}
const packed = JSON.parse(result.stdout)[0];
const packedPaths = new Set(packed.files.map((file) => file.path));
for (const relative of requiredEngineFiles) {
  if (!packedPaths.has(`vendor/doc-extractor/${relative}`))
    throw new Error(`Required engine file absent from package: ${relative}`);
}
console.log(
  JSON.stringify(
    {
      filename: packed.filename,
      bytes: packed.size,
      integrity: packed.integrity,
      files: packed.entryCount,
    },
    null,
    2,
  ),
);
