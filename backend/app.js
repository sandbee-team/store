"use strict";
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { randomUUID, randomBytes } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { ZodError } = require("zod");
const { AppError } = require("./shared/errors");
const { BoundedRateStore } = require("./infrastructure/rate-limit-store");
const { mountAuth } = require("./modules/auth/routes");
const { createMailer } = require("./modules/mail/mailer");
const { mountPlatform } = require("./modules/platform/routes");
const { mountServiceAccess } = require("./modules/platform/service-access");
const { mountLegacy } = require("./modules/platform/legacy");
const { mountDeveloperPages } = require("./modules/platform/developer-pages");
const { MongoRateLimit } = require("./infrastructure/mongo-rate-limit");
const { hashToken } = require("./modules/auth/security");
const {
  createWorkspaceRepository,
} = require("./modules/workspaces/repository");
const { mountWorkspaces } = require("./modules/workspaces/routes");
const { mountReports } = require("./modules/reports/routes");
function createApp({
  db,
  config,
  signer,
  legacy = { configured: [] },
  mailer = createMailer(config),
}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.use((_req, res, next) => {
    res.locals.styleNonce = randomBytes(18).toString("base64");
    next();
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: [
            "'self'",
            (_req, res) => `'nonce-${res.locals.styleNonce}'`,
          ],
          imgSrc: ["'self'", "blob:", "data:"],
          connectSrc: ["'self'", config.services.demo.publicUrl],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: config.production ? [] : null,
        },
      },
      strictTransportSecurity: config.production ? undefined : false,
    }),
  );
  app.use((req, res, next) => {
    res.set("X-Request-Id", randomUUID());
    if (req.path.startsWith("/api") || req.path.startsWith("/internal"))
      res.set("Cache-Control", "no-store");
    next();
  });
  const stores = [];
  function limit(max, windowMs, account = false) {
    const store = new BoundedRateStore();
    stores.push(store);
    return rateLimit({
      max,
      windowMs,
      store,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      ...(account ? { keyGenerator: (req) => req.user._id.toString() } : {}),
      handler: (_req, res) =>
        res.status(429).json({
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Request limit reached. Wait and try again.",
          },
        }),
    });
  }
  app.get("/api/health", limit(60, 60000), async (_req, res) => {
    await db.command({ ping: 1 });
    res.json({
      ok: true,
      services: {
        platform: "ready",
        gst: config.services.gst.publicUrl,
        ocrDemo: config.services.demo.publicUrl,
      },
    });
  });
  app.use(
    "/api",
    limit(300, 60000),
    express.json({ limit: "8kb" }),
    cookieParser(),
  );
  app.use("/internal", express.json({ limit: "8kb" }));
  app.use("/internal", limit(10000, 60000));
  const quota = new MongoRateLimit(db);
  const auth = mountAuth({
    app,
    db,
    config,
    mailer,
    authLimiter: async (req, _res, next) => {
      await quota.consume(
        hashToken(ipKeyGenerator(req.ip)),
        "auth",
        config.authLimit,
        900000,
      );
      next();
    },
  });
  const workspaceRepository = createWorkspaceRepository(db);
  mountWorkspaces({
    app,
    db,
    auth,
    repository: workspaceRepository,
    mailer,
    config,
  });
  const platform = mountPlatform({
    app,
    db,
    auth,
    signer,
    config,
    workspaceRepository,
    downloadLimiter: async (req, _res, next) => {
      await quota.consume(String(req.workspace._id), "package-download", 3);
      next();
    },
  });
  mountLegacy({ app, db, platform, legacy, limiter: limit(5, 900000, true) });
  mountReports({ app, db, platform });
  mountServiceAccess({
    app,
    db,
    config,
    platform,
    internalLimiter: limit(10000, 60000),
  });
  app.locals.otp = auth.otp;
  app.locals.rateStores = stores;
  mountDeveloperPages(app, config);
  app.use("/api", (_req, _res, next) =>
    next(new AppError(404, "NOT_FOUND", "API endpoint not found.")),
  );
  app.use("/internal", (_req, _res, next) =>
    next(new AppError(404, "NOT_FOUND", "API endpoint not found.")),
  );
  const dist = path.resolve(__dirname, "../frontend/dist");
  app.use(
    "/assets",
    express.static(path.join(dist, "assets"), {
      immutable: true,
      maxAge: "1y",
    }),
  );
  let indexTemplate;
  async function renderIndex(_req, res) {
    // Cache the immutable template, never the per-response CSP nonce.
    if (!indexTemplate)
      indexTemplate = await fs.readFile(path.join(dist, "index.html"), "utf8");
    res.set("Cache-Control", "no-store");
    res.set("X-Robots-Tag", "noindex, nofollow");
    res
      .type("html")
      .send(
        indexTemplate.replace(
          "<!--STYLE_NONCE-->",
          `<meta name="style-nonce" content="${res.locals.styleNonce}">`,
        ),
      );
  }
  app.get("/index.html", renderIndex);
  app.use(express.static(dist, { index: false, maxAge: 0 }));
  app.get("/{*path}", renderIndex);
  app.use((error, req, res, _next) => {
    if (res.headersSent) return res.end();
    let status = error instanceof AppError ? error.status : 500;
    let code = error instanceof AppError ? error.code : "INTERNAL_ERROR";
    let message =
      error instanceof AppError
        ? error.message
        : "Service is temporarily unavailable. Please try again.";
    if (error instanceof ZodError) {
      status = 400;
      code = "INVALID_INPUT";
      message = error.issues[0]?.message || "Check the information provided.";
    }
    if (error.type === "entity.parse.failed") {
      status = 400;
      code = "INVALID_JSON";
      message = "Request body must be valid JSON.";
    }
    if (error.type === "entity.too.large") {
      status = 413;
      code = "PAYLOAD_TOO_LARGE";
      message = "Request body exceeds the 8 KB limit.";
    }
    if (error.code === "INVALID_GSTIN") {
      status = 400;
      code = error.code;
      message = "GSTIN format or checksum is invalid.";
    }
    if (error.code === "GSTIN_NOT_FOUND") {
      status = 404;
      code = error.code;
      message = "GSTIN was not found by the portal.";
    }
    if (
      [
        "HTTP_ERROR",
        "ACCESS_DENIED",
        "PORTAL_ERROR",
        "LOOKUP_TIMEOUT",
        "TIMEOUT",
        "RATE_LIMITED",
      ].includes(error.code)
    ) {
      status = 503;
      code = "GST_UNAVAILABLE";
      message =
        "The GST portal is temporarily unavailable. Please retry later.";
    }
    if (status === 500)
      console.error(
        JSON.stringify({
          event: "request_failed",
          requestId: res.get("X-Request-Id"),
          type: error.name,
        }),
      );
    if (error.retryAfter) res.set("Retry-After", String(error.retryAfter));
    else if (status === 503) res.set("Retry-After", "30");
    res.status(status).json({
      success: false,
      error: { code, message },
      requestId: res.get("X-Request-Id"),
    });
  });
  return app;
}
module.exports = { createApp };
