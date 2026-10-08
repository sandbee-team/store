"use strict";
const { ObjectId } = require("mongodb");
const { AppError } = require("../../shared/errors");
const { hashToken } = require("../auth/security");
const { can } = require("./permissions");
function memberOf(workspace, userId) {
  return workspace?.members.find(
    (member) => String(member.userId) === String(userId) && member.active,
  );
}
function memberMatch(req, permission) {
  if (permission && !can(req.membership.role, permission))
    throw new AppError(
      403,
      "PERMISSION_DENIED",
      "Your workspace role does not allow this action.",
    );
  return {
    _id: req.workspace._id,
    members: {
      $elemMatch: {
        userId: req.user._id,
        active: true,
        role: req.membership.role,
        version: req.membership.version,
      },
    },
  };
}
function createWorkspaceRepository(db) {
  const workspaces = db.collection("workspaces"),
    users = db.collection("users");
  async function ensurePersonal(user) {
    if (!user.onboarded || !user.emailVerifiedAt) return null;
    const existing = await workspaces.findOne({ _id: user._id });
    if (existing) return existing;
    // The initial personal workspace keeps the original account ID so historical service events retain ownership.
    const workspace = {
      _id: user._id,
      ownerId: user._id,
      name: user.company || `${user.name}'s workspace`,
      createdAt: user.createdAt || new Date(),
      members: [
        {
          userId: user._id,
          email: user.email,
          name: user.name,
          role: "owner",
          active: true,
          version: 0,
          joinedAt: new Date(),
        },
      ],
      invitations: [],
      revision: 0,
      tokenRevision: user.tokenRevision || 0,
      enabledApps: user.enabledApps || [],
      tokens: (user.tokens || []).map((token) => ({
        ...token,
        createdBy: user._id,
        memberVersion: 0,
      })),
      activity: user.activity || [],
      usage: { licenseChecks: user.usage?.licenseChecks || 0 },
    };
    try {
      await workspaces.updateOne(
        { _id: user._id },
        { $setOnInsert: workspace },
        { upsert: true },
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
    const created = await workspaces.findOne({ _id: user._id });
    // Old local-release resource fields have one authority after migration.
    await users.updateOne(
      { _id: user._id },
      {
        $unset: {
          tokens: "",
          enabledApps: "",
          tokenRevision: "",
          activity: "",
          "usage.licenseChecks": "",
        },
      },
    );
    return created;
  }
  async function current(req, _res, next) {
    await ensurePersonal(req.user);
    const selected = req.session?.workspaceId || req.user._id;
    const expected = req.get("x-workspace-id");
    if (expected && expected !== String(selected))
      throw new AppError(
        409,
        "WORKSPACE_CHANGED",
        "Your workspace changed in another tab. Refresh before continuing.",
      );
    const workspace = await workspaces.findOne({ _id: selected });
    const membership = memberOf(workspace, req.user._id);
    if (!membership)
      throw new AppError(
        403,
        "WORKSPACE_ACCESS_REMOVED",
        "Workspace access has changed. Select another workspace.",
      );
    req.workspace = workspace;
    req.membership = membership;
    next();
  }
  async function assertSession(req) {
    const current = await users.findOne(
      {
        _id: req.user._id,
        passwordHash: req.user.passwordHash,
        sessions: {
          $elemMatch: {
            hash: hashToken(req.sessionToken),
            expiresAt: { $gt: new Date() },
          },
        },
      },
      { projection: { _id: 1 } },
    );
    if (!current)
      throw new AppError(
        401,
        "UNAUTHENTICATED",
        "Your session changed. Sign in again.",
      );
  }
  async function update(
    req,
    update,
    { permission, filter = {}, ...options } = {},
  ) {
    await assertSession(req);
    const result = await workspaces.updateOne(
      { ...filter, ...memberMatch(req, permission) },
      update,
      options,
    );
    if (!result.matchedCount)
      throw new AppError(
        409,
        "WORKSPACE_CHANGED",
        "Workspace access or settings changed. Refresh and try again.",
      );
    return result;
  }
  async function list(user) {
    await ensurePersonal(user);
    return workspaces
      .find(
        { members: { $elemMatch: { userId: user._id, active: true } } },
        {
          projection: {
            name: 1,
            ownerId: 1,
            members: { $elemMatch: { userId: user._id, active: true } },
          },
        },
      )
      .limit(100)
      .toArray();
  }
  return {
    workspaces,
    users,
    ensurePersonal,
    current,
    assertSession,
    update,
    list,
  };
}
function parseWorkspaceId(value) {
  if (typeof value !== "string" || !/^[a-f0-9]{24}$/.test(value))
    throw new AppError(400, "INVALID_INPUT", "Invalid workspace identifier.");
  return new ObjectId(value);
}
module.exports = {
  createWorkspaceRepository,
  memberOf,
  memberMatch,
  parseWorkspaceId,
};
