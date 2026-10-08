"use strict";
require("dotenv").config({ quiet: true });
const express = require("express");
const { z } = require("zod");
const { baseApp, finishApp, serviceConfig } = require("../shared/http");
const { AppError } = require("../../backend/shared/errors");
const { readJson } = require("../../backend/shared/read-json");

const inputSchema = z
  .object({
    installationId: z.string().uuid(),
    label: z.string().trim().min(1).max(80),
    platform: z.enum(["win32-x64", "linux-x64"]),
  })
  .strict();

function createLicenseApp({ config, fetchImpl = fetch }) {
  const app = baseApp(config);
  let inflight = 0;
  app.get("/api/health", (_req, res) =>
    res.json({ ok: true, service: "ocr-license" }),
  );
  app.post(
    "/api/v1/ocr/license",
    express.json({ limit: "2kb" }),
    async (req, res) => {
      const authorization = req.get("authorization") || "";
      if (!/^Bearer sb_(?:ocr|gst|all)_[A-Za-z0-9_-]{43}$/.test(authorization))
        throw new AppError(
          401,
          "INVALID_TOKEN",
          "Provide an OCR or global Sandbee bearer token.",
        );
      if (authorization.startsWith("Bearer sb_gst_"))
        throw new AppError(
          403,
          "SCOPE_DENIED",
          "Use an OCR or global key for this service.",
        );
      const input = inputSchema.parse(req.body);
      if (inflight >= 64)
        throw new AppError(
          503,
          "SERVICE_BUSY",
          "License verification is busy. Retry shortly.",
        );
      inflight++;
      try {
        const upstream = await fetchImpl(
          `${config.url}/internal/v1/ocr/license`,
          {
            method: "POST",
            redirect: "error",
            signal: AbortSignal.timeout(8000),
            headers: {
              "Content-Type": "application/json",
              Authorization: authorization,
              "X-Sandbee-Service-Key": config.secret,
            },
            body: JSON.stringify(input),
          },
        );
        const result = await readJson(upstream);
        if (!upstream.ok) {
          const status = [400, 401, 403, 409, 429].includes(upstream.status)
            ? upstream.status
            : 503;
          const error = new AppError(
            status,
            status === 429 ? "RATE_LIMITED" : "LICENSE_DENIED",
            status === 503
              ? "License authority is unavailable. Retry shortly."
              : "License access denied. Check your key and installation in Sandbee Store.",
          );
          const retry = upstream.headers.get("retry-after");
          if (retry && /^\d{1,5}$/.test(retry)) error.retryAfter = retry;
          throw error;
        }
        const grant = z
          .object({
            lease: z.string().min(1).max(8192),
            expiresIn: z.number().int().min(1).max(300),
          })
          .parse(result);
        res.json(grant);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(
          503,
          "AUTHORITY_UNAVAILABLE",
          "License authority is unavailable. Retry shortly.",
        );
      } finally {
        inflight--;
      }
    },
  );
  return finishApp(app);
}

function main() {
  const config = serviceConfig("ocr-license");
  const app = createLicenseApp({ config });
  const server = app.listen(config.port, config.host, () =>
    console.log("OCR license API ready"),
  );
  Object.assign(server, {
    requestTimeout: 15000,
    headersTimeout: 10000,
    maxConnections: 256,
  });
  let closing = false;
  function stop() {
    if (closing) return;
    closing = true;
    const timer = setTimeout(() => process.exit(1), 20000);
    timer.unref();
    server.close(() => {
      app.locals.rateStore.shutdown();
      clearTimeout(timer);
    });
  }
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
if (require.main === module) main();
module.exports = { createLicenseApp };
