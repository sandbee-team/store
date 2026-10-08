"use strict";
const { randomUUID } = require("node:crypto");
const { z } = require("zod");
const { newToken, hashToken, equalToken } = require("../auth/security");
const { AppError } = require("../../shared/errors");
const { authorizeToken } = require("./authorization");
const { MongoRateLimit } = require("../../infrastructure/mongo-rate-limit");
const { readJson } = require("../../shared/read-json");
const { memberOf } = require("../workspaces/repository");
const { can } = require("../workspaces/permissions");
function mountServiceAccess({ app, db, config, platform, internalLimiter }) {
  const quota = new MongoRateLimit(db),
    grants = db.collection("request_grants"),
    events = db.collection("usage_events");
  function requireApp(service) {
    return (req, _res, next) => {
      if (!req.workspace.enabledApps?.includes(service))
        throw new AppError(
          403,
          "APP_DISABLED",
          "Enable this app in your workspace first.",
        );
      next();
    };
  }
  async function issueGrant(req, service) {
    const token = `sb_request_${newToken()}`;
    await grants.insertOne({
      _id: hashToken(token),
      accountId: req.workspace._id,
      actorId: req.user._id,
      memberVersion: req.membership.version,
      service,
      authVersion: req.user.authVersion || 0,
      expiresAt: new Date(Date.now() + 60000),
    });
    return token;
  }
  function serviceAuth(req, _res, next) {
    const service = req.get("x-sandbee-service");
    const secret =
      service === "gst"
        ? config.services.gst.secret
        : service === "ocr-demo"
          ? config.services.demo.secret
          : "";
    if (!secret || !equalToken(req.get("authorization"), `Bearer ${secret}`))
      throw new AppError(
        401,
        "SERVICE_UNAUTHORIZED",
        "Service authentication failed.",
      );
    req.serviceId = service;
    next();
  }
  app.post(
    "/internal/v1/authorize",
    serviceAuth,
    internalLimiter,
    async (req, res) => {
      const { token } = z
        .object({ token: z.string().min(1).max(160) })
        .strict()
        .parse(req.body);
      const service = req.serviceId,
        appId = service === "gst" ? "gst" : "ocr";
      let user, workspace;
      if (/^sb_request_[A-Za-z0-9_-]{43}$/.test(token)) {
        const grant = await grants.findOneAndDelete({
          _id: hashToken(token),
          service,
          expiresAt: { $gt: new Date() },
        });
        if (!grant)
          throw new AppError(
            401,
            "GRANT_INVALID",
            "This one-use request grant is invalid or expired.",
          );
        user = await db.collection("users").findOne({
          _id: grant.actorId,
          authVersion: grant.authVersion,
          emailVerifiedAt: { $type: "date" },
          onboarded: true,
        });
        workspace = await db
          .collection("workspaces")
          .findOne({ _id: grant.accountId, enabledApps: appId });
        const membership = memberOf(workspace, grant.actorId);
        if (
          !user ||
          !membership ||
          membership.version !== grant.memberVersion ||
          !can(membership.role, "use")
        )
          throw new AppError(
            403,
            "APP_DISABLED",
            "Account access changed. Open the console and try again.",
          );
      } else {
        if (service !== "gst")
          throw new AppError(
            403,
            "DEMO_ONLY",
            "Use the hosted studio for demo uploads; customer OCR runs locally.",
          );
        ({ user, workspace } = await authorizeToken(db, token, "gst:read"));
      }
      await quota.consume(
        String(workspace._id),
        service,
        service === "gst" ? 60 : 10,
      );
      const requestId = randomUUID();
      await events.insertOne({
        _id: requestId,
        accountId: workspace._id,
        actorId: user._id,
        service,
        state: "authorized",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 86400000),
      });
      res.json({ accountId: String(workspace._id), requestId });
    },
  );
  app.post(
    "/internal/v1/complete",
    serviceAuth,
    internalLimiter,
    async (req, res) => {
      const input = z
        .object({
          requestId: z.string().uuid(),
          outcome: z.enum(["success", "failed"]),
          source: z.enum(["live", "database", "demo"]).optional(),
          review: z.boolean().optional(),
        })
        .strict()
        .parse(req.body);
      if (
        (req.serviceId === "gst" && input.source === "demo") ||
        (req.serviceId === "ocr-demo" &&
          input.source &&
          input.source !== "demo")
      )
        throw new AppError(
          400,
          "INVALID_SOURCE",
          "Invalid service result category.",
        );
      const result = await events.updateOne(
        { _id: input.requestId, service: req.serviceId, state: "authorized" },
        {
          $set: {
            state: input.outcome,
            source: input.source || null,
            review: input.review || false,
            completedAt: new Date(),
          },
        },
      );
      if (!result.matchedCount) {
        const existing = await events.findOne({
          _id: input.requestId,
          service: req.serviceId,
          state: input.outcome,
        });
        if (!existing)
          throw new AppError(
            404,
            "REQUEST_UNKNOWN",
            "The service request cannot be completed.",
          );
      }
      res.json({ ok: true });
    },
  );
  app.post(
    "/api/apps/gst/lookup",
    ...platform.use,
    requireApp("gst"),
    async (req, res) => {
      const body = z
        .object({ gstin: z.string().min(15).max(15) })
        .strict()
        .parse(req.body);
      const token = await issueGrant(req, "gst");
      let response;
      try {
        response = await fetch(
          `${config.services.gst.url}/api/v1/gstin/${encodeURIComponent(body.gstin)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            redirect: "error",
            signal: AbortSignal.timeout(65000),
          },
        );
      } catch {
        throw new AppError(
          503,
          "GST_UNAVAILABLE",
          "The GST service is unavailable. Please retry shortly.",
        );
      }
      const result = await readJson(response, 2 * 1024 * 1024);
      if (response.headers.has("retry-after"))
        res.set("Retry-After", response.headers.get("retry-after"));
      res.status(response.status).json(result);
    },
  );
  app.post(
    "/api/apps/ocr/demo-ticket",
    ...platform.use,
    requireApp("ocr"),
    async (req, res) => {
      z.object({}).strict().parse(req.body);
      await quota.consume(String(req.workspace._id), "demo-ticket", 12);
      res.json({
        ticket: await issueGrant(req, "ocr-demo"),
        uploadUrl: `${config.services.demo.publicUrl}/api/demo/extract`,
        expiresIn: 60,
      });
    },
  );
  app.get(
    "/api/apps/ocr/catalog",
    ...platform.read,
    requireApp("ocr"),
    (_req, res) =>
      res.json({
        documents: require("../../../packages/ocr/backend/modules/ocr/catalog")
          .catalog,
      }),
  );
  app.use("/internal", (_req, _res, next) =>
    next(new AppError(404, "NOT_FOUND", "Internal route not found.")),
  );
}
async function readUsage(db, user) {
  const rows = await db
    .collection("usage_events")
    .aggregate([
      {
        $match: {
          accountId: user._id,
          state: "success",
          createdAt: { $gt: new Date(Date.now() - 90 * 86400000) },
        },
      },
      {
        $group: {
          _id: { service: "$service", source: "$source" },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();
  const usage = {
    licenseChecks: user.usage?.licenseChecks || 0,
    gst: 0,
    gstCached: 0,
    gstLive: 0,
    ocrDemo: 0,
  };
  for (const row of rows) {
    if (row._id.service === "gst") {
      usage.gst += row.count;
      usage[row._id.source === "database" ? "gstCached" : "gstLive"] +=
        row.count;
    } else if (row._id.service === "ocr-demo") usage.ocrDemo += row.count;
  }
  return usage;
}
module.exports = { mountServiceAccess, readUsage };
