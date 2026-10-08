"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { z } = require("zod");
const { OcrWorker } = require("../backend/modules/ocr/worker");
const { catalog } = require("../backend/modules/ocr/catalog");
const { LicenseClient, licenseError } = require("./license");
const configSchema = z
  .object({
    token: z.string().regex(/^sb_(?:ocr|all)_[A-Za-z0-9_-]{43}$/),
    installationId: z.string().uuid(),
    label: z.string().trim().min(1).max(80),
    publicKey: z.string().min(50).max(4096),
    issuer: z.string().url().default("https://ocrapi.sandbee.in"),
    allowLocalDevelopment: z.boolean().default(false),
  })
  .strict();
const inputSchema = z
  .object({
    documentType: z.enum(catalog.map((x) => x.id)),
    files: z.array(z.string().min(1).max(4096)).min(1).max(2),
    mode: z.enum(["balanced", "accurate"]).default("balanced"),
    includeText: z.boolean().default(false),
    pdfPassword: z.string().max(128).optional(),
  })
  .strict();
function kind(b) {
  if (b.subarray(0, 5).toString() === "%PDF-") return "pdf";
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return "jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "png";
  if (
    b.subarray(0, 4).toString() === "RIFF" &&
    b.subarray(8, 12).toString() === "WEBP"
  )
    return "webp";
  if (["49492a00", "4d4d002a"].includes(b.subarray(0, 4).toString("hex")))
    return "tiff";
  throw licenseError(
    "UNSUPPORTED_FILE",
    "Use a JPEG, PNG, WebP, TIFF or PDF document.",
  );
}
class SandbeeOCR {
  constructor(options) {
    const config = configSchema.parse(options);
    const url = new URL(config.issuer);
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" &&
        !(
          config.allowLocalDevelopment &&
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
        ))
    )
      throw licenseError(
        "INVALID_ISSUER",
        "Issuer must be an HTTPS origin. Local HTTP requires an explicit development option.",
      );
    const platform = `${process.platform}-${process.arch}`;
    if (
      !["win32-x64", "linux-x64"].includes(platform) ||
      (process.platform === "linux" &&
        !process.report.getReport().header.glibcVersionRuntime)
    )
      throw licenseError(
        "PLATFORM_UNSUPPORTED",
        "Use Windows x64 or Linux x64 with glibc. Alpine, ARM and macOS are not supported by this engine build.",
      );
    this.license = new LicenseClient({
      ...config,
      issuer: url.origin,
      platform,
    });
    this.worker = new OcrWorker();
    this.inflight = 0;
    this.closed = false;
  }
  async start() {
    if (this.closed)
      throw licenseError("CLIENT_CLOSED", "This OCR client is closed.");
    await this.license.start();
    this.worker.start();
    return this;
  }
  async extract(options) {
    if (this.closed)
      throw licenseError(
        "CLIENT_CLOSED",
        "Create a new OCR client after closing it.",
      );
    const input = inputSchema.parse(options);
    if (this.inflight >= 2)
      throw licenseError(
        "SERVICE_BUSY",
        "This client already has two documents processing. Use a bounded job queue.",
      );
    this.inflight++;
    let directory;
    try {
      await this.start();
      directory = await fs.mkdtemp(path.join(os.tmpdir(), "sandbee-local-"));
      const files = [];
      for (const [index, source] of input.files.entries()) {
        if (!path.isAbsolute(source))
          throw licenseError(
            "INVALID_PATH",
            "Document paths must be absolute local file paths. URLs are not supported.",
          );
        const handle = await fs.open(source, "r");
        try {
          const stat = await handle.stat();
          if (!stat.isFile() || stat.size < 1 || stat.size > 10 * 1024 * 1024)
            throw licenseError(
              "FILE_LIMIT",
              "Each document must be a regular file of at most 10 MB.",
            );
          // Bounded read also handles files that grow after stat. Never delete caller files.
          const bytes = Buffer.alloc(10 * 1024 * 1024 + 1);
          let length = 0;
          while (length < bytes.length) {
            const { bytesRead } = await handle.read(
              bytes,
              length,
              bytes.length - length,
              null,
            );
            if (!bytesRead) break;
            length += bytesRead;
          }
          if (length > 10 * 1024 * 1024)
            throw licenseError(
              "FILE_LIMIT",
              "File grew beyond the 10 MB limit.",
            );
          const buffer = bytes.subarray(0, length),
            type = kind(buffer),
            destination = path.join(directory, `input-${index}`);
          await fs.writeFile(destination, buffer, { mode: 0o600 });
          files.push({ path: destination, kind: type });
        } finally {
          await handle.close();
        }
      }
      // Recheck if copying/queueing took longer than the lease.
      await this.license.ensure();
      const result = await this.worker.run({ ...input, files, directory });
      return {
        ...result,
        meta: {
          ...result.meta,
          execution: "customer_server",
          documentsUploaded: false,
        },
      };
    } finally {
      try {
        if (directory) await fs.rm(directory, { recursive: true, force: true });
      } finally {
        this.inflight--;
      }
    }
  }
  close() {
    this.closed = true;
    this.license.close();
    this.worker.close();
  }
}
module.exports = { SandbeeOCR };
