"use strict";
const { z } = require("zod");
const { randomUUID } = require("node:crypto");
const { AppError } = require("../../shared/errors");
const { MongoRateLimit } = require("../../infrastructure/mongo-rate-limit");
const { hashToken } = require("../auth/security");
const { can, permissions, requirePermission } = require("./permissions");
const { memberOf, parseWorkspaceId } = require("./repository");
const roleSchema = z.enum(["admin", "developer", "viewer"]);
function mountWorkspaces({ app, db, auth, repository, mailer, config }) {
  const { workspaces } = repository,
    quota = new MongoRateLimit(db);
  const read = [auth.sessionAuth, auth.verified];
  const write = [auth.originGuard, auth.sessionAuth, auth.csrf, auth.verified];
  const scopedRead = [...read, repository.current];
  const scopedWrite = [...write, repository.current];
  app.get("/api/workspaces", ...read, async (req, res) => {
    const entries = await repository.list(req.user);
    res.json({
      workspaces: entries.map((w) => ({
        id: String(w._id),
        name: w.name,
        role: w.members[0].role,
      })),
      currentId: String(req.session?.workspaceId || req.user._id),
    });
  });
  app.post("/api/workspaces/select", ...write, async (req, res) => {
    const { id } = z.object({ id: z.string() }).strict().parse(req.body);
    const workspace = await workspaces.findOne({ _id: parseWorkspaceId(id) });
    if (!memberOf(workspace, req.user._id))
      throw new AppError(
        403,
        "PERMISSION_DENIED",
        "You do not have access to this workspace.",
      );
    await auth.updateAccount(
      req,
      { $set: { "sessions.$[session].workspaceId": workspace._id } },
      { arrayFilters: [{ "session.hash": hashToken(req.sessionToken) }] },
    );
    res.json({ ok: true });
  });
  app.get("/api/workspace/members", ...scopedRead, async (req, res) => {
    res.json({
      name: req.workspace.name,
      role: req.membership.role,
      permissions: permissions[req.membership.role],
      members: req.workspace.members
        .filter((m) => m.active)
        .map(({ userId, name, email, role, joinedAt }) => ({
          id: String(userId),
          name,
          email,
          role,
          joinedAt,
        })),
      invitations: can(req.membership.role, "manageMembers")
        ? req.workspace.invitations
            .filter((i) => i.state === "pending" && i.expiresAt > new Date())
            .map(({ id, email, role, expiresAt, sentAt, delivery }) => ({
              id,
              email,
              role,
              expiresAt,
              sentAt,
              delivery,
            }))
        : [],
    });
  });
  app.patch(
    "/api/workspace",
    ...scopedWrite,
    requirePermission("manageWorkspace"),
    async (req, res) => {
      const { name } = z
        .object({ name: z.string().trim().min(2).max(100) })
        .strict()
        .parse(req.body);
      await repository.update(
        req,
        { $set: { name }, $inc: { revision: 1 } },
        { permission: "manageWorkspace" },
      );
      res.json({ ok: true });
    },
  );
  app.post(
    "/api/workspace/invitations",
    ...scopedWrite,
    requirePermission("manageMembers"),
    async (req, res) => {
      const input = z
        .object({
          email: z.string().trim().toLowerCase().email().max(254),
          role: roleSchema,
        })
        .strict()
        .parse(req.body);
      if (
        req.workspace.members.some((m) => m.active && m.email === input.email)
      )
        throw new AppError(
          409,
          "ALREADY_MEMBER",
          "This person already has workspace access.",
        );
      const now = new Date(),
        invitations = req.workspace.invitations.filter(
          (i) =>
            i.state === "pending" &&
            i.expiresAt > now &&
            i.email !== input.email,
        );
      if (
        req.workspace.members.filter((m) => m.active).length +
          invitations.length >=
        50
      )
        throw new AppError(
          409,
          "MEMBER_LIMIT",
          "This workspace supports up to 50 active or invited members.",
        );
      await quota.consume(
        String(req.workspace._id),
        "workspace-invite",
        20,
        86400000,
      );
      await quota.consume(
        `${req.workspace._id}:${input.email}`,
        "invite-recipient",
        1,
        60000,
      );
      const invitation = {
        id: randomUUID(),
        ...input,
        state: "pending",
        createdBy: req.user._id,
        sentAt: now,
        expiresAt: new Date(+now + 7 * 86400000),
        delivery: "pending",
      };
      await repository.update(
        req,
        {
          $set: { invitations: [...invitations, invitation] },
          $inc: { revision: 1 },
        },
        {
          permission: "manageMembers",
          filter: { revision: req.workspace.revision },
        },
      );
      let delivery = "sent";
      try {
        await mailer.invite({
          to: input.email,
          workspace: req.workspace.name,
          inviter: req.user.name,
          role: input.role,
          appUrl: config.appUrl,
        });
      } catch {
        delivery = "failed";
      }
      await workspaces.updateOne(
        { _id: req.workspace._id, "invitations.id": invitation.id },
        { $set: { "invitations.$[invite].delivery": delivery } },
        { arrayFilters: [{ "invite.id": invitation.id }] },
      );
      res.status(201).json({
        ok: true,
        delivery,
        message:
          delivery === "failed"
            ? "Invitation saved. Email delivery failed; the recipient can also find it after signing in with this email."
            : "Invitation sent.",
      });
    },
  );
  app.delete(
    "/api/workspace/invitations/:id",
    ...scopedWrite,
    requirePermission("manageMembers"),
    async (req, res) => {
      const id = z.string().uuid().parse(req.params.id);
      await repository.update(
        req,
        { $pull: { invitations: { id } }, $inc: { revision: 1 } },
        { permission: "manageMembers", filter: { "invitations.id": id } },
      );
      res.json({ ok: true });
    },
  );
  app.get("/api/invitations", ...read, async (req, res) => {
    const now = new Date();
    const rows = await workspaces
      .find(
        {
          invitations: {
            $elemMatch: {
              email: req.user.email,
              state: "pending",
              expiresAt: { $gt: now },
            },
          },
        },
        { projection: { name: 1, invitations: 1 } },
      )
      .limit(50)
      .toArray();
    res.json({
      invitations: rows.flatMap((w) =>
        w.invitations
          .filter(
            (i) =>
              i.email === req.user.email &&
              i.state === "pending" &&
              i.expiresAt > now,
          )
          .map((i) => ({
            id: i.id,
            workspaceId: String(w._id),
            workspace: w.name,
            role: i.role,
            expiresAt: i.expiresAt,
          })),
      ),
    });
  });
  app.post("/api/invitations/:id/accept", ...write, async (req, res) => {
    const id = z.string().uuid().parse(req.params.id),
      now = new Date();
    z.object({}).strict().parse(req.body);
    const workspace = await workspaces.findOne({
      invitations: {
        $elemMatch: {
          id,
          email: req.user.email,
          state: "pending",
          expiresAt: { $gt: now },
        },
      },
    });
    if (!workspace)
      throw new AppError(
        404,
        "INVITATION_UNAVAILABLE",
        "This invitation expired, was revoked, or belongs to a different email.",
      );
    if (memberOf(workspace, req.user._id))
      throw new AppError(
        409,
        "ALREADY_MEMBER",
        "You already belong to this workspace.",
      );
    const invitation = workspace.invitations.find((i) => i.id === id);
    const previous = workspace.members.find(
      (m) => String(m.userId) === String(req.user._id),
    );
    const member = {
      userId: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: invitation.role,
      active: true,
      version: (previous?.version || 0) + 1,
      joinedAt: now,
    };
    if (workspace.members.filter((m) => m.active).length >= 50)
      throw new AppError(
        409,
        "MEMBER_LIMIT",
        "The workspace member limit has been reached.",
      );
    await repository.assertSession(req);
    const accepted = await workspaces.updateOne(
      {
        _id: workspace._id,
        revision: workspace.revision,
        invitations: {
          $elemMatch: {
            id,
            email: req.user.email,
            state: "pending",
            expiresAt: { $gt: now },
          },
        },
      },
      {
        $set: {
          members: [
            ...workspace.members.filter(
              (m) => String(m.userId) !== String(req.user._id),
            ),
            member,
          ],
        },
        $pull: { invitations: { id } },
        $inc: { revision: 1, tokenRevision: 1 },
      },
    );
    if (!accepted.matchedCount)
      throw new AppError(
        409,
        "WORKSPACE_CHANGED",
        "Invitation changed. Refresh and try again.",
      );
    await auth.updateAccount(
      req,
      {
        $set: {
          "sessions.$[session].workspaceId": workspace._id,
          ...(!req.user.onboarded
            ? {
                onboarded: true,
                company: `${req.user.name}'s workspace`,
                useCase: "development",
              }
            : {}),
        },
      },
      { arrayFilters: [{ "session.hash": hashToken(req.sessionToken) }] },
    );
    res.json({ ok: true, workspaceId: String(workspace._id) });
  });
  async function changeMember(req, res, remove) {
    const userId = parseWorkspaceId(req.params.id),
      target = memberOf(req.workspace, userId);
    if (!target) throw new AppError(404, "NOT_FOUND", "Member not found.");
    if (target.role === "owner")
      throw new AppError(
        403,
        "OWNER_PROTECTED",
        "The workspace owner cannot be removed or demoted.",
      );
    if (String(userId) === String(req.user._id))
      throw new AppError(
        403,
        "SELF_CHANGE_DENIED",
        "Ask another administrator to change your access.",
      );
    const role = remove
      ? target.role
      : z.object({ role: roleSchema }).strict().parse(req.body).role;
    const update = remove
      ? {
          $pull: { members: { userId } },
          $set: { "tokens.$[token].revokedAt": new Date() },
          $inc: { revision: 1, tokenRevision: 1 },
        }
      : {
          $set: {
            "members.$[member].role": role,
            "tokens.$[token].revokedAt": new Date(),
          },
          $inc: {
            "members.$[member].version": 1,
            revision: 1,
            tokenRevision: 1,
          },
        };
    await repository.update(req, update, {
      permission: "manageMembers",
      filter: { revision: req.workspace.revision },
      arrayFilters: [
        ...(remove ? [] : [{ "member.userId": userId }]),
        { "token.createdBy": userId },
      ],
    });
    res.json({ ok: true });
  }
  app.patch(
    "/api/workspace/members/:id",
    ...scopedWrite,
    requirePermission("manageMembers"),
    (req, res) => changeMember(req, res, false),
  );
  app.delete(
    "/api/workspace/members/:id",
    ...scopedWrite,
    requirePermission("manageMembers"),
    (req, res) => changeMember(req, res, true),
  );
}
module.exports = { mountWorkspaces };
