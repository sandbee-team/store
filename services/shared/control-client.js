"use strict";
const { AppError } = require("../../backend/shared/errors");
const { readJson } = require("../../backend/shared/read-json");
function createControlClient({ url, service, secret }) {
  async function call(route, body) {
    let response;
    try {
      response = await fetch(`${url}${route}`, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(8000),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
          "X-Sandbee-Service": service,
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new AppError(
        503,
        "AUTHORITY_UNAVAILABLE",
        "Account authorization is temporarily unavailable. Please retry later.",
      );
    }
    const result = await readJson(response);
    if (!response.ok) {
      const error = new AppError(
        [400, 401, 403, 404, 409, 429, 503].includes(response.status)
          ? response.status
          : 503,
        result?.error?.code || "AUTHORITY_UNAVAILABLE",
        result?.error?.message || "Account authorization failed.",
      );
      error.retryAfter = response.headers.get("retry-after");
      throw error;
    }
    return result;
  }
  return {
    async authenticate(req, _res, next) {
      const token =
        /^Bearer (sb_(?:gst|ocr|all|request)_[A-Za-z0-9_-]{43})$/.exec(
          req.get("authorization") || "",
        )?.[1];
      if (!token)
        throw new AppError(
          401,
          "INVALID_TOKEN",
          "Provide a valid Sandbee bearer token.",
        );
      const grant = await call("/internal/v1/authorize", { token });
      if (
        !/^[a-f0-9]{24}$/.test(grant.accountId) ||
        typeof grant.requestId !== "string"
      )
        throw new AppError(
          503,
          "AUTHORITY_UNAVAILABLE",
          "Invalid account authorization response.",
        );
      req.user = { _id: grant.accountId, onboarded: true };
      req.grant = grant;
      next();
    },
    async complete(req, details) {
      const body = { requestId: req.grant.requestId, ...details };
      try {
        return await call("/internal/v1/complete", body);
      } catch (error) {
        if (error.status !== 503) throw error;
        return call("/internal/v1/complete", body);
      }
    },
  };
}
module.exports = { createControlClient };
