"use strict";
const { hashToken } = require("../auth/security");
const { serviceForScope } = require("./catalog");
const { AppError } = require("../../shared/errors");
const { can } = require("../workspaces/permissions");
const {
  memberOf,
  createWorkspaceRepository,
} = require("../workspaces/repository");
async function activeTokens(db, workspace) {
  const creators = await db
    .collection("users")
    .find(
      {
        _id: { $in: workspace.tokens.map((t) => t.createdBy) },
        emailVerifiedAt: { $type: "date" },
      },
      { projection: { authVersion: 1 } },
    )
    .toArray();
  const versions = new Map(
    creators.map((u) => [String(u._id), u.authVersion || 0]),
  );
  return workspace.tokens.filter((t) => {
    const member = memberOf(workspace, t.createdBy);
    return (
      !t.revokedAt &&
      t.authVersion === versions.get(String(t.createdBy)) &&
      member?.version === t.memberVersion &&
      can(member?.role, "keys")
    );
  });
}
async function authorizeToken(db, value, scope) {
  if (
    typeof value !== "string" ||
    !/^sb_(?:gst|ocr|all)_[A-Za-z0-9_-]{43}$/.test(value)
  )
    throw new AppError(
      401,
      "INVALID_TOKEN",
      "Provide a valid Sandbee bearer token.",
    );
  const hash = hashToken(value);
  let workspace = await db
    .collection("workspaces")
    .findOne({ tokens: { $elemMatch: { hash, revokedAt: null } } });
  if (!workspace) {
    const legacy = await db.collection("users").findOne({
      tokens: { $elemMatch: { hash, revokedAt: null } },
      emailVerifiedAt: { $type: "date" },
      onboarded: true,
    });
    if (legacy)
      workspace = await createWorkspaceRepository(db).ensurePersonal(legacy);
  }
  const token = workspace?.tokens.find((t) => t.hash === hash && !t.revokedAt);
  const user =
    token &&
    (await db.collection("users").findOne({
      _id: token.createdBy,
      authVersion: token.authVersion,
      emailVerifiedAt: { $type: "date" },
    }));
  const membership = user && memberOf(workspace, user._id);
  if (
    !token ||
    !user ||
    !membership ||
    membership.version !== token.memberVersion ||
    !can(membership.role, "keys")
  )
    throw new AppError(
      401,
      "INVALID_TOKEN",
      "This token is invalid, revoked or its creator no longer has access.",
    );
  if (token.scope !== scope && token.scope !== "global")
    throw new AppError(
      403,
      "SCOPE_DENIED",
      "This token cannot access this app.",
    );
  if (!workspace.enabledApps.includes(serviceForScope(scope)))
    throw new AppError(
      403,
      "APP_DISABLED",
      "Enable this app in your Sandbee workspace first.",
    );
  return { user, workspace, token, membership };
}
module.exports = { authorizeToken, activeTokens };
