"use strict";
const { AppError } = require("../../shared/errors");
const roles = ["owner", "admin", "developer", "viewer"];
const permissions = {
  owner: [
    "read",
    "use",
    "keys",
    "manageKeys",
    "manageApps",
    "manageMembers",
    "manageWorkspace",
  ],
  admin: [
    "read",
    "use",
    "keys",
    "manageKeys",
    "manageApps",
    "manageMembers",
    "manageWorkspace",
  ],
  developer: ["read", "use", "keys"],
  viewer: ["read"],
};
function can(role, permission) {
  return permissions[role]?.includes(permission) || false;
}
function requirePermission(permission) {
  return (req, _res, next) => {
    if (!can(req.membership?.role, permission))
      throw new AppError(
        403,
        "PERMISSION_DENIED",
        "Your workspace role does not allow this action.",
      );
    next();
  };
}
function assertKeyManagement(req, token) {
  if (!token) throw new AppError(404, "NOT_FOUND", "Token not found.");
  if (
    !can(req.membership.role, "manageKeys") &&
    (!can(req.membership.role, "keys") ||
      String(token.createdBy) !== String(req.user._id))
  )
    throw new AppError(
      403,
      "PERMISSION_DENIED",
      "You can manage only keys you created in this workspace.",
    );
}
module.exports = {
  roles,
  permissions,
  can,
  requirePermission,
  assertKeyManagement,
};
