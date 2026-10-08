"use strict";
require("dotenv").config({ quiet: true });
const { readConfig } = require("./backend/config/env");
const { connectDatabase } = require("./backend/infrastructure/database");
const { createApp } = require("./backend/app");
const { createSigner } = require("./backend/modules/platform/license");
const { createLegacyReader } = require("./backend/modules/platform/legacy");
async function main() {
  const config = readConfig(),
    signer = createSigner(config);
  const { client, db } = await connectDatabase(config);
  const legacy = createLegacyReader(config);
  const app = createApp({
    db,
    config,
    signer,
    legacy,
  });
  const server = app.listen(config.port, config.host, () =>
    console.log(`Sandbee Apps listening on ${config.appUrl}`),
  );
  Object.assign(server, {
    requestTimeout: 70000,
    headersTimeout: 15000,
    keepAliveTimeout: 5000,
    maxRequestsPerSocket: 100,
    maxConnections: 256,
  });
  let closing = false;
  function stop() {
    if (closing) return;
    closing = true;
    const deadline = setTimeout(() => process.exit(1), 75000);
    deadline.unref();
    server.close(async () => {
      app.locals.rateStores.forEach((store) => store.shutdown());
      await Promise.allSettled(app.locals.otp.deliveries);
      await legacy.close();
      await client.close();
      clearTimeout(deadline);
    });
  }
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
if (require.main === module)
  main().catch((error) => {
    console.error(
      `Startup failed (${error.name}). Check local configuration, signing key and MongoDB.`,
    );
    process.exitCode = 1;
  });
module.exports = { main };
