"use strict";
const { z } = require("zod");
const { randomUUID } = require("node:crypto");
const { AppError } = require("../../shared/errors");
const { newToken, hashToken, equalToken } = require("../auth/security");
const { apps, serviceForScope } = require("./catalog");
const { authorizeToken, activeTokens } = require("./authorization");
const { readUsage } = require("./service-access");
const { MongoRateLimit } = require("../../infrastructure/mongo-rate-limit");
const {
  permissions,
  can,
  requirePermission,
  assertKeyManagement,
} = require("../workspaces/permissions");
const { memberMatch } = require("../workspaces/repository");
const { billingSummary } = require("./billing");
const tokenSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    scope: z.enum(["gst:read", "ocr:local", "global"]),
  })
  .strict();
const installSchema = z
  .object({
    installationId: z.string().uuid(),
    label: z.string().trim().min(1).max(80),
    platform: z.enum(["win32-x64", "linux-x64"]),
  })
  .strict();
const safeToken = ({ hash, authVersion, ...token }) => token;
function mountPlatform({
  app,
  db,
  auth,
  signer,
  config,
  downloadLimiter,
  workspaceRepository,
}) {
  const workspaces = db.collection("workspaces");
  const quota = new MongoRateLimit(db);
  function ready(req, _res, next) {
    if (!req.user.onboarded)
      throw new AppError(
        403,
        "ONBOARDING_REQUIRED",
        "Finish workspace setup first.",
      );
    next();
  }
  const read = [
    auth.sessionAuth,
    auth.verified,
    ready,
    workspaceRepository.current,
  ];
  const write = [
    auth.originGuard,
    auth.sessionAuth,
    auth.csrf,
    auth.verified,
    ready,
    workspaceRepository.current,
  ];
  app.get("/api/platform", ...read, async (req, res) => {
    const active = new Set(
      (await activeTokens(db, req.workspace)).map((t) => t.id),
    );
    const tokens = (req.workspace.tokens || [])
      .filter(
        (t) =>
          can(req.membership.role, "manageKeys") ||
          String(t.createdBy) === String(req.user._id),
      )
      .map((t) => ({
        ...safeToken(t),
        active: active.has(t.id),
      }));
    res.json({
      workspace: {
        id: String(req.workspace._id),
        name: req.workspace.name,
        memberCount: req.workspace.members.filter((member) => member.active)
          .length,
        role: req.membership.role,
        permissions: permissions[req.membership.role],
      },
      apps: apps.map((app) => ({
        ...app,
        enabled: req.workspace.enabledApps?.includes(app.id) || false,
      })),
      endpoints: {
        gst: config.services.gst.publicUrl,
        demo: config.services.demo.publicUrl,
      },
      tokens,
      billing: billingSummary(req.workspace),
      usage: await readUsage(db, req.workspace),
      usageWindowDays: 90,
      activity: (req.workspace.activity || []).slice().reverse(),
      license: {
        issuer: config.licenseIssuer,
        publicKey: signer.publicKey,
        kid: signer.kid,
        leaseSeconds: config.licenseSeconds,
        installationsPerToken: 5,
      },
      package: {
        name: "@sandbee/ocr",
        version: "0.1.0",
        download: "/api/apps/ocr/package",
        platforms: ["Linux x64 (glibc)", "Windows x64"],
        publishedToNpm: config.ocrNpmPublished,
      },
    });
  });
  app.get("/api/billing", ...read, (req, res) =>
    res.json(billingSummary(req.workspace)),
  );
  app.post(
    "/api/tokens",
    ...write,
    requirePermission("keys"),
    async (req, res) => {
      const input = tokenSchema.parse(req.body);
      const validTokens = await activeTokens(db, req.workspace);
      if (
        input.scope !== "global" &&
        !req.workspace.enabledApps?.includes(serviceForScope(input.scope))
      )
        throw new AppError(
          403,
          "APP_DISABLED",
          "Enable this app before creating its key.",
        );
      if (input.scope === "global" && !req.workspace.enabledApps?.length)
        throw new AppError(
          403,
          "APP_DISABLED",
          "Enable at least one app before creating a global key.",
        );
      if (validTokens.length >= 10)
        throw new AppError(
          409,
          "TOKEN_LIMIT",
          "Revoke a token before creating another. Maximum 10 active tokens.",
        );
      const value = `sb_${input.scope === "global" ? "all" : input.scope === "gst:read" ? "gst" : "ocr"}_${newToken()}`;
      const token = {
        id: randomUUID(),
        ...input,
        hash: hashToken(value),
        prefix: value.slice(0, 16),
        authVersion: req.user.authVersion || 0,
        createdBy: req.user._id,
        memberVersion: req.membership.version,
        createdAt: new Date(),
        revokedAt: null,
        installations: [],
      };
      // CAS on token revision also protects concurrent creations from bypassing the cap.
      const revision = req.workspace.tokenRevision || 0;
      await workspaceRepository.assertSession(req);
      const result = await workspaces.updateOne(
        {
          ...memberMatch(req, "keys"),
          tokenRevision: revision || { $in: [null, 0] },
        },
        {
          $set: {
            tokens: [...validTokens, token],
          },
          $inc: { tokenRevision: 1 },
          $push: {
            activity: {
              $each: [
                {
                  id: randomUUID(),
                  at: new Date(),
                  title: "Access token created",
                  detail: `${input.name} · ${input.scope}`,
                },
              ],
              $slice: -30,
            },
          },
        },
      );
      if (!result.matchedCount)
        throw new AppError(
          409,
          "ACCOUNT_CHANGED",
          "Your account changed. Refresh and try again.",
        );
      res.status(201).json({ token: value, metadata: safeToken(token) });
    },
  );
  app.delete("/api/tokens/:id", ...write, async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    assertKeyManagement(
      req,
      req.workspace.tokens.find((t) => t.id === id),
    );
    const tokens = (req.workspace.tokens || []).map((t) =>
      t.id === id ? { ...t, revokedAt: new Date() } : t,
    );
    if (!tokens.some((t) => t.id === id))
      throw new AppError(404, "NOT_FOUND", "Token not found.");
    // Positional update avoids overwriting installations created by a concurrent license request.
    await workspaceRepository.update(
      req,
      {
        $set: { "tokens.$[token].revokedAt": new Date() },
        $inc: { tokenRevision: 1 },
      },
      { arrayFilters: [{ "token.id": id }] },
    );
    res.json({ ok: true });
  });
  app.delete(
    "/api/tokens/:tokenId/installations/:id",
    ...write,
    async (req, res) => {
      const tokenId = z.string().uuid().parse(req.params.tokenId),
        id = z.string().uuid().parse(req.params.id);
      assertKeyManagement(
        req,
        req.workspace.tokens.find((t) => t.id === tokenId),
      );
      if (
        !(req.workspace.tokens || []).some(
          (t) => t.id === tokenId && t.installations.some((i) => i.id === id),
        )
      )
        throw new AppError(404, "NOT_FOUND", "Installation not found.");
      await workspaceRepository.update(
        req,
        {
          $set: {
            "tokens.$[token].installations.$[installation].revokedAt":
              new Date(),
          },
          $inc: { tokenRevision: 1 },
        },
        { arrayFilters: [{ "token.id": tokenId }, { "installation.id": id }] },
      );
      res.json({ ok: true });
    },
  );
  app.put(
    "/api/apps/:id/activation",
    ...write,
    requirePermission("manageApps"),
    async (req, res) => {
      const id = z.enum(apps.map((app) => app.id)).parse(req.params.id);
      const { enabled } = z
        .object({ enabled: z.boolean() })
        .strict()
        .parse(req.body);
      await workspaceRepository.update(req, {
        [enabled ? "$addToSet" : "$pull"]: { enabledApps: id },
        $inc: { tokenRevision: 1 },
      });
      res.json({ ok: true, enabled });
    },
  );
  function tokenAuth(scope) {
    return async (req, _res, next) => {
      const { user, workspace, token } = await authorizeToken(
        db,
        (req.get("authorization") || "").replace(/^Bearer /, ""),
        scope,
      );
      req.user = user;
      req.workspace = workspace;
      req.accessToken = token;
      next();
    };
  }
  app.post(
    "/internal/v1/ocr/license",
    (req, _res, next) => {
      const secret = config.services.license.secret;
      if (!secret || !equalToken(req.get("x-sandbee-service-key"), secret))
        throw new AppError(
          401,
          "SERVICE_UNAUTHORIZED",
          "Service authentication failed.",
        );
      next();
    },
    tokenAuth("ocr:local"),
    async (req, _res, next) => {
      await quota.consume(String(req.workspace._id), "ocr-license", 120);
      next();
    },
    async (req, res) => {
      const input = installSchema.parse(req.body),
        token = req.accessToken;
      const existing = token.installations.find(
        (i) => i.id === input.installationId,
      );
      if (existing?.revokedAt)
        throw new AppError(
          403,
          "INSTALLATION_REVOKED",
          "This installation has been revoked.",
        );
      if (existing && existing.platform !== input.platform)
        throw new AppError(
          409,
          "PLATFORM_CHANGED",
          "Create a different installation ID for a different platform.",
        );
      const userMatch = {
        _id: req.workspace._id,
        members: {
          $elemMatch: {
            userId: token.createdBy,
            active: true,
            version: token.memberVersion,
            role: { $in: ["owner", "admin", "developer"] },
          },
        },
        enabledApps: "ocr",
      };
      if (!existing) {
        const result = await workspaces.updateOne(
          {
            ...userMatch,
            tokens: {
              $elemMatch: {
                id: token.id,
                revokedAt: null,
                "installations.id": { $ne: input.installationId },
                "installations.4": { $exists: false },
              },
            },
          },
          {
            $push: {
              "tokens.$[token].installations": {
                id: input.installationId,
                label: input.label,
                platform: input.platform,
                createdAt: new Date(),
                lastSeenAt: new Date(),
                revokedAt: null,
              },
            },
            $inc: { tokenRevision: 1 },
          },
          { arrayFilters: [{ "token.id": token.id }] },
        );
        if (!result.matchedCount) {
          // A duplicate concurrent activation may have won. Re-read all authorization conditions.
          const latest = await workspaces.findOne({
            ...userMatch,
            tokens: {
              $elemMatch: {
                id: token.id,
                revokedAt: null,
                installations: {
                  $elemMatch: {
                    id: input.installationId,
                    platform: input.platform,
                    revokedAt: null,
                  },
                },
              },
            },
          });
          if (!latest)
            throw new AppError(
              403,
              "INSTALLATION_LIMIT",
              "Token revoked or all five installation slots used. Rotate the token to reset slots.",
            );
        }
      }
      const authorized = await workspaces.updateOne(
        {
          ...userMatch,
          tokens: {
            $elemMatch: {
              id: token.id,
              revokedAt: null,
              installations: {
                $elemMatch: {
                  id: input.installationId,
                  platform: input.platform,
                  revokedAt: null,
                },
              },
            },
          },
        },
        {
          $set: {
            "tokens.$[token].lastUsedAt": new Date(),
            "tokens.$[token].installations.$[installation].lastSeenAt":
              new Date(),
          },
          $inc: { "usage.licenseChecks": 1 },
        },
        {
          arrayFilters: [
            { "token.id": token.id },
            { "installation.id": input.installationId },
          ],
        },
      );
      if (!authorized.matchedCount)
        throw new AppError(
          403,
          "LICENSE_REVOKED",
          "Your license is no longer active.",
        );
      res.json({
        lease: signer.issue({
          userId: req.workspace._id,
          tokenId: token.id,
          installationId: input.installationId,
          platform: input.platform,
        }),
        expiresIn: config.licenseSeconds,
      });
    },
  );
  app.get(
    "/api/apps/ocr/package",
    ...read,
    downloadLimiter,
    (req, res, next) => {
      if (!req.workspace.enabledApps?.includes("ocr"))
        throw new AppError(403, "APP_DISABLED", "Enable Document OCR first.");
      next();
    },
    (req, res, next) => {
      const path = require("node:path");
      res.download(
        path.resolve("artifacts/sandbee-ocr-0.1.0.tgz"),
        "sandbee-ocr-0.1.0.tgz",
        (error) => {
          if (error)
            next(
              new AppError(
                503,
                "PACKAGE_UNAVAILABLE",
                "Package download is being prepared. Please try again shortly.",
              ),
            );
        },
      );
    },
  );
  return {
    read,
    write,
    use: [...write, requirePermission("use")],
    accountRead: [auth.sessionAuth, auth.verified, ready],
    accountWrite: [
      auth.originGuard,
      auth.sessionAuth,
      auth.csrf,
      auth.verified,
      ready,
    ],
    tokenAuth,
  };
}
module.exports = { mountPlatform };
