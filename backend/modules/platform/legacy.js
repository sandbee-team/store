"use strict";
const { MongoClient } = require("mongodb");
const { z } = require("zod");
const { createHash } = require("node:crypto");
const { verifyPassword, hashToken } = require("../auth/security");
const { admission } = require("../../middleware/admission");
const { AppError } = require("../../shared/errors");
function createLegacyReader(config) {
  const configured = Object.keys(config.legacy.databases).filter(
    (service) => config.legacy.databases[service],
  );
  const client = configured.length
    ? new MongoClient(config.legacy.uri, {
        maxPoolSize: 2,
        serverSelectionTimeoutMS: 3000,
      })
    : null;
  return {
    configured,
    async find(service, email) {
      const database = config.legacy.databases[service];
      if (!client || !database) return null;
      const user = await client
        .db(database)
        .collection("users")
        .findOne(
          { email },
          { projection: { passwordHash: 1, emailVerifiedAt: 1, usage: 1 } },
        );
      if (!user) return null;
      return {
        ...user,
        sourceKey: createHash("sha256")
          .update(`${database}:${user._id}`)
          .digest("hex"),
      };
    },
    close: () => client?.close(),
  };
}
function mountLegacy({ app, db, platform, limiter, legacy }) {
  const verify = admission(3);
  app.get("/api/migration/status", ...platform.accountRead, (req, res) =>
    res.json({
      available: legacy.configured,
      links: req.user.legacyLinks || {},
    }),
  );
  app.post(
    "/api/migration/link",
    ...platform.accountWrite,
    limiter,
    async (req, res) => {
      const { service, password } = z
        .object({
          service: z.enum(["gst", "ocr"]),
          password: z.string().min(1).max(128),
        })
        .strict()
        .parse(req.body);
      if (!legacy.configured.includes(service))
        throw new AppError(
          503,
          "MIGRATION_UNAVAILABLE",
          "This service is not connected for account linking yet.",
        );
      const old = await legacy.find(service, req.user.email);
      const valid = await verify(() =>
        verifyPassword(password, old?.passwordHash),
      );
      if (!valid || !old?.emailVerifiedAt)
        throw new AppError(
          401,
          "LEGACY_CREDENTIALS_INVALID",
          "Use the password for a verified legacy account with the same email address.",
        );
      const link = {
        sourceKey: old.sourceKey,
        linkedAt: new Date(),
        historicalUsage: Object.fromEntries(
          Object.entries(old.usage || {}).filter(
            ([key, value]) =>
              ["total", "cached", "live", "accepted", "review"].includes(key) &&
              Number.isSafeInteger(value) &&
              value >= 0,
          ),
        ),
      };
      const result = await db.collection("users").updateOne(
        {
          _id: req.user._id,
          passwordHash: req.user.passwordHash,
          sessions: {
            $elemMatch: {
              hash: hashToken(req.sessionToken),
              expiresAt: { $gt: new Date() },
            },
          },
          [`legacyLinks.${service}`]: { $exists: false },
        },
        { $set: { [`legacyLinks.${service}`]: link } },
      );
      if (!result.matchedCount)
        throw new AppError(
          409,
          "ALREADY_LINKED",
          "Account already linked or the central session changed. Refresh this page.",
        );
      res.json({ ok: true, link });
    },
  );
}
module.exports = { createLegacyReader, mountLegacy };
