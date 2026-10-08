"use strict";
const multer = require("multer"),
  fs = require("node:fs/promises"),
  os = require("node:os"),
  path = require("node:path");
const { randomUUID } = require("node:crypto");
const { z } = require("zod");
const { catalog } = require("../../packages/ocr/backend/modules/ocr/catalog");
const { AppError } = require("../../backend/shared/errors");
const {
  removeUploadDirectory,
} = require("../../packages/ocr/backend/modules/ocr/temp-files");
const { ExtractionService } = require("./service");
async function fileKind(file) {
  const handle = await fs.open(file, "r");
  try {
    const b = Buffer.alloc(16);
    await handle.read(b, 0, 16, 0);
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
    throw new AppError(
      415,
      "UNSUPPORTED_FILE",
      "Upload a JPEG, PNG, WebP, TIFF or PDF document.",
    );
  } finally {
    await handle.close();
  }
}
function mountExtraction({ app, worker, config, authenticate, recordUsage }) {
  const service = new ExtractionService({ worker, config });
  app.locals.extraction = service;
  const storage = multer.diskStorage({
    destination: (req, _file, cb) => cb(null, req.uploadDirectory),
    filename: (_req, _file, cb) => cb(null, randomUUID()),
  });
  const upload = multer({
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 2,
      fields: 5,
      fieldSize: 1024,
      parts: 7,
    },
  }).array("files", 2);
  let inflight = 0;
  const accounts = new Map();
  async function extract(req, res) {
    if (!req.user.onboarded)
      throw new AppError(
        403,
        "API_KEY_REQUIRED",
        "Complete your workspace setup first.",
      );
    if (inflight >= config.inflightLimit)
      throw new AppError(
        503,
        "SERVICE_BUSY",
        "All extraction slots are busy. Please retry shortly.",
      );
    const accountId = req.user._id.toString();
    if ((accounts.get(accountId) || 0) >= config.perAccountConcurrency) {
      res.set("Retry-After", "5");
      throw new AppError(
        429,
        "CONCURRENCY_LIMIT",
        "Your account already has documents processing. Please wait for them to finish.",
      );
    }
    if (Number(req.get("content-length") || 0) > 21 * 1024 * 1024)
      throw new AppError(
        413,
        "UPLOAD_LIMIT",
        "Uploads must be at most 20 MB in total.",
      );
    inflight++;
    accounts.set(accountId, (accounts.get(accountId) || 0) + 1);
    let directory;
    try {
      directory = await fs.mkdtemp(path.join(os.tmpdir(), "sandbee-ocr-"));
      req.uploadDirectory = directory;
      await new Promise((resolve, reject) =>
        upload(req, res, (error) => (error ? reject(error) : resolve())),
      );
      const input = z
        .object({
          documentType: z.enum(catalog.map((x) => x.id)),
          mode: z.enum(["balanced", "accurate"]).default("balanced"),
          includeText: z.enum(["true", "false"]).default("false"),
          pdfPassword: z.string().max(128).optional(),
        })
        .strict()
        .parse(req.body);
      if (!req.files?.length)
        throw new AppError(
          400,
          "FILE_REQUIRED",
          "Choose at least one document to extract.",
        );
      const files = [];
      for (const file of req.files)
        files.push({ path: file.path, kind: await fileKind(file.path) });
      const started = Date.now();
      const result = await service.extract(accountId, {
        ...input,
        includeText: input.includeText === "true",
        files,
        directory,
      });
      result.meta.requestMs = Date.now() - started;
      await recordUsage(req, {
        outcome: "success",
        source: "demo",
        review: result.status !== "ready",
      });
      await removeUploadDirectory(directory);
      directory = null;
      res.set("X-OCR-Cache", result.meta.cache);
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof multer.MulterError)
        throw new AppError(
          error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
          "UPLOAD_LIMIT",
          "Upload at most two files, up to 10 MB each.",
        );
      throw error;
    } finally {
      try {
        if (directory) await removeUploadDirectory(directory);
      } finally {
        inflight--;
        const remaining = accounts.get(accountId) - 1;
        if (remaining) accounts.set(accountId, remaining);
        else accounts.delete(accountId);
      }
    }
  }
  app.post("/api/demo/extract", authenticate, extract);
}
module.exports = { mountExtraction, fileKind };
