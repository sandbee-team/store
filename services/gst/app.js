"use strict";
const { baseApp, finishApp } = require("../shared/http");
const { createControlClient } = require("../shared/control-client");
const { GstService } = require("./service");
function createGstApp({
  db,
  config,
  liveLookup,
  control = createControlClient(config),
}) {
  const app = baseApp(config),
    service = new GstService({ db, liveLookup });
  app.locals.gst = service;
  app.get("/api/health", async (_req, res) => {
    await db.command({ ping: 1 });
    res.json({ ok: true, service: "gst" });
  });
  app.get("/api/v1/gstin/:gstin", control.authenticate, async (req, res) => {
    const started = Date.now();
    try {
      const result = await service.get(req.params.gstin);
      await control.complete(req, {
        outcome: "success",
        source: result.source,
      });
      res.json({
        success: true,
        data: result.data,
        meta: {
          source: result.source,
          fetchedAt: result.fetchedAt,
          elapsedMs: Date.now() - started,
        },
      });
    } catch (error) {
      await control.complete(req, { outcome: "failed" }).catch(() => {});
      throw error;
    }
  });
  return finishApp(app);
}
module.exports = { createGstApp };
