"use strict";
require("dotenv").config({ quiet: true });
const { baseApp, finishApp, serviceConfig } = require("../shared/http");
const { createControlClient } = require("../shared/control-client");
const { mountExtraction } = require("./routes");
const { OcrWorker } = require("../../packages/ocr/backend/modules/ocr/worker");
const { AppError } = require("../../backend/shared/errors");
function createDemoApp({
  config,
  worker,
  control = createControlClient(config),
}) {
  const app = baseApp(config);
  app.use((req, res, next) => {
    if (req.get("origin") === config.consoleOrigin) {
      res.set("Access-Control-Allow-Origin", config.consoleOrigin);
      res.set("Vary", "Origin");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.set(
        "Access-Control-Expose-Headers",
        "X-Request-Id, X-OCR-Cache, Retry-After",
      );
    }
    if (req.method === "OPTIONS")
      return res.sendStatus(
        req.get("origin") === config.consoleOrigin ? 204 : 403,
      );
    if (
      req.path === "/api/demo/extract" &&
      req.get("origin") !== config.consoleOrigin
    )
      throw new AppError(
        403,
        "ORIGIN_DENIED",
        "Open the document studio from Sandbee Store.",
      );
    next();
  });
  app.get("/api/health", (_req, res) =>
    res
      .status(worker.ready ? 200 : 503)
      .json({ ok: worker.ready, service: "ocr-demo" }),
  );
  mountExtraction({
    app,
    worker,
    config,
    authenticate: control.authenticate,
    recordUsage: control.complete,
  });
  return finishApp(app);
}
async function main() {
  const config = {
    ...serviceConfig("ocr-demo"),
    consoleOrigin: process.env.CONSOLE_ORIGIN || "http://localhost:8094",
    secret: process.env.CACHE_SECRET || process.env.SERVICE_SECRET,
    queueLimit: 4,
    inflightLimit: 5,
    perAccountConcurrency: 2,
    cacheTtlMs: 300000,
    cacheEntries: 256,
    cacheMaxBytes: 16 * 1024 * 1024,
  };
  const origin = new URL(config.consoleOrigin);
  if (
    origin.origin !== config.consoleOrigin ||
    (config.production && origin.protocol !== "https:")
  )
    throw Error("Invalid console origin");
  const control = createControlClient({
    ...config,
    secret: process.env.SERVICE_SECRET,
  });
  const worker = new OcrWorker({ maxQueue: 4 });
  worker.start();
  const app = createDemoApp({ config, worker, control });
  const server = app.listen(config.port, config.host, () =>
    console.log("OCR demo service ready"),
  );
  Object.assign(server, {
    requestTimeout: 60000,
    headersTimeout: 15000,
    maxConnections: 128,
  });
  let closing = false;
  function stop() {
    if (closing) return;
    closing = true;
    const timer = setTimeout(() => process.exit(1), 65000);
    timer.unref();
    server.close(() => {
      worker.close();
      app.locals.extraction.clear();
      app.locals.rateStore.shutdown();
      clearTimeout(timer);
    });
  }
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
if (require.main === module)
  main().catch((e) => {
    console.error(
      `Demo startup failed (${e.name}). Check service configuration.`,
    );
    process.exitCode = 1;
  });
module.exports = { createDemoApp };
