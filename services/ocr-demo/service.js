"use strict";
const { LRUCache } = require("lru-cache");
const { createHmac } = require("node:crypto");
const { createReadStream } = require("node:fs");
const { AppError } = require("../../backend/shared/errors");
class ExtractionService {
  constructor({ worker, config }) {
    this.worker = worker;
    this.secret = config.secret;
    this.ttl = config.cacheTtlMs;
    this.pending = new Map();
    this.cache = new LRUCache({
      max: config.cacheEntries,
      maxSize: config.cacheMaxBytes,
      maxEntrySize: 1024 * 1024,
      sizeCalculation: (value) => Buffer.byteLength(value, "utf8"),
      ttl: this.ttl,
      ttlAutopurge: true,
      ttlResolution: 0,
    });
  }
  async key(accountId, job) {
    const hash = createHmac("sha256", this.secret);
    hash.update(
      JSON.stringify([
        "ocr-v1",
        String(accountId),
        job.documentType,
        job.mode,
        job.includeText,
        job.pdfPassword || "",
      ]),
    );
    for (const file of job.files) {
      const digest = createHmac("sha256", this.secret);
      for await (const chunk of createReadStream(file.path))
        digest.update(chunk);
      hash.update(digest.digest());
    }
    return hash.digest("hex");
  }
  async extract(accountId, job) {
    const key = await this.key(accountId, job),
      cached = this.cache.get(key);
    if (cached) return this.response(cached, "hit");
    if (this.pending.has(key))
      return this.response(await this.pending.get(key), "coalesced");
    const pending = this.worker
      .run(job)
      .catch((error) => {
        // The packaged worker has its own Error class across the module boundary.
        const retryable = [
          "SERVICE_BUSY",
          "ENGINE_UNAVAILABLE",
          "EXTRACTION_TIMEOUT",
        ];
        if (retryable.includes(error.code))
          throw new AppError(
            503,
            error.code,
            "OCR is busy or temporarily unavailable. Please retry shortly.",
          );
        if (["EXTRACTION_FAILED", "MULTIPAGE_IMAGE"].includes(error.code))
          throw new AppError(
            422,
            error.code,
            "This document could not be read. Check its format, dimensions and PDF password.",
          );
        throw error;
      })
      .then((result) => {
        const serialized = JSON.stringify(result);
        if (this.ttl > 0) this.cache.set(key, serialized);
        return serialized;
      });
    this.pending.set(key, pending);
    try {
      return this.response(await pending, "miss");
    } finally {
      this.pending.delete(key);
    }
  }
  response(serialized, status) {
    const value = JSON.parse(serialized);
    return {
      ...value,
      meta: {
        ...value.meta,
        cache: status,
        cacheTtlSeconds: this.ttl / 1000,
        retention: "uploads_deleted_results_memory_only",
      },
    };
  }
  clear() {
    this.cache.clear();
  }
}
module.exports = { ExtractionService };
