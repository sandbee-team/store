"use strict";
require("dotenv").config({ quiet: true });
const { MongoClient } = require("mongodb");
const { serviceConfig } = require("../shared/http");
const { createGstApp } = require("./app");
const { GstClient } = require("./lib/gst-client");
const { OcrWorker } = require("./lib/ocr-worker");
const { lookup } = require("./lib/lookup");
async function main() {
  const config = serviceConfig("gst");
  if (!process.env.MONGODB_URI) throw Error("Set the GST data MongoDB URI");
  const mongo = new MongoClient(process.env.MONGODB_URI, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 8000,
  });
  await mongo.connect();
  const db = mongo.db(process.env.MONGODB_DB || "sandbee_gst_data");
  await db
    .collection("gst_records")
    .createIndex({ gstin: 1 }, { unique: true });
  const solver = new OcrWorker(),
    client = new GstClient();
  const app = createGstApp({
    db,
    config,
    liveLookup: (gstin) => lookup(gstin, { client, solver }),
  });
  const server = app.listen(config.port, config.host, () =>
    console.log("GST API service ready"),
  );
  Object.assign(server, {
    requestTimeout: 70000,
    headersTimeout: 15000,
    maxConnections: 256,
  });
  let closing = false;
  function stop() {
    if (closing) return;
    closing = true;
    const timer = setTimeout(() => process.exit(1), 75000);
    timer.unref();
    server.close(async () => {
      solver.close();
      app.locals.rateStore.shutdown();
      await mongo.close();
      clearTimeout(timer);
    });
  }
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
if (require.main === module)
  main().catch((e) => {
    console.error(
      `GST startup failed (${e.name}). Check service configuration.`,
    );
    process.exitCode = 1;
  });
