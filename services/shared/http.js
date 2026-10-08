"use strict";
const express = require("express"),
  helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const { randomUUID } = require("node:crypto");
const { ZodError } = require("zod");
const {
  BoundedRateStore,
} = require("../../backend/infrastructure/rate-limit-store");
const { AppError } = require("../../backend/shared/errors");
function baseApp(config) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.use(helmet());
  app.use((_req, res, next) => {
    res.set("X-Request-Id", randomUUID());
    res.set("Cache-Control", "no-store");
    next();
  });
  const store = new BoundedRateStore();
  app.locals.rateStore = store;
  app.use(
    rateLimit({
      windowMs: 60000,
      limit: 300,
      store,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: (_req, res) =>
        res.status(429).json({
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "IP request limit reached. Retry later.",
          },
        }),
    }),
  );
  return app;
}
function finishApp(app) {
  app.use((_req, _res, next) =>
    next(new AppError(404, "NOT_FOUND", "API endpoint not found.")),
  );
  app.use((error, _req, res, _next) => {
    if (res.headersSent) return res.end();
    let status = error instanceof AppError ? error.status : 500,
      code = error instanceof AppError ? error.code : "SERVICE_UNAVAILABLE",
      message =
        error instanceof AppError
          ? error.message
          : "The service is temporarily unavailable.";
    if (error instanceof ZodError) {
      status = 400;
      code = "INVALID_INPUT";
      message = "Check the request fields.";
    }
    if (error.type === "entity.parse.failed") {
      status = 400;
      code = "INVALID_JSON";
      message = "Request body must be valid JSON.";
    }
    if (error.type === "entity.too.large") {
      status = 413;
      code = "PAYLOAD_TOO_LARGE";
      message = "Request body exceeds the allowed size.";
    }
    if (error.code === "INVALID_GSTIN") {
      status = 400;
      code = error.code;
      message = "GSTIN format or checksum is invalid.";
    }
    if (error.code === "GSTIN_NOT_FOUND") {
      status = 404;
      code = error.code;
      message = "GSTIN was not found.";
    }
    if (
      !(error instanceof AppError) &&
      [
        "LOOKUP_TIMEOUT",
        "TIMEOUT",
        "HTTP_ERROR",
        "ACCESS_DENIED",
        "PORTAL_ERROR",
        "ECONNRESET",
        "ETIMEDOUT",
        "EAI_AGAIN",
        "ENOTFOUND",
        "ECONNREFUSED",
        "RESPONSE_TOO_LARGE",
        "INVALID_RESPONSE",
        "MISSING_COOKIE",
        "RATE_LIMITED",
      ].includes(error.code)
    ) {
      status = 503;
      code = "GST_UNAVAILABLE";
      message = "The GST portal is temporarily unavailable.";
    }
    if (status >= 500)
      console.error(
        JSON.stringify({
          event: "service_request_failed",
          requestId: res.get("X-Request-Id"),
          type: error.name,
          code:
            typeof error.code === "string" && /^[A-Z_0-9]+$/.test(error.code)
              ? error.code
              : undefined,
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
function serviceConfig(service) {
  const production = process.env.NODE_ENV === "production";
  const url = new URL(process.env.CONTROL_URL || "http://127.0.0.1:8094");
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !["http:", "https:"].includes(url.protocol)
  )
    throw Error("CONTROL_URL must be an origin");
  if (production && url.protocol !== "https:")
    throw Error("Remote production authorization requires HTTPS");
  const secret = process.env.SERVICE_SECRET || "";
  if (secret.length < 32 || /replace-with|change-me|your-secret/i.test(secret))
    throw Error("SERVICE_SECRET must be at least 32 random characters");
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw Error("Invalid PORT");
  return {
    production,
    url: url.origin,
    secret,
    service,
    trustProxy: process.env.TRUST_PROXY === "1" ? 1 : false,
    host: process.env.HOST || "127.0.0.1",
    port,
  };
}
module.exports = { baseApp, finishApp, serviceConfig };
