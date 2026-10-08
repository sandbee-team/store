"use strict";
const { z } = require("zod");
const { AppError } = require("../../shared/errors");
const {
  hashToken,
  newToken,
  hashPassword,
  verifyPassword,
  csrfToken,
  equalToken,
} = require("./security");
const { OtpService } = require("./otp-service");
const { admission } = require("../../middleware/admission");
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128);
const credentials = z
  .object({ email: emailSchema, password: z.string().min(1).max(128) })
  .strict();
const signupSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();
const profileSchema = z
  .object({
    company: z.string().trim().min(2).max(100),
    useCase: z.enum(["invoicing", "verification", "development", "other"]),
  })
  .strict();
const emptyBody = z.object({}).strict();
function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    company: user.company || "",
    useCase: user.useCase || "",
    onboarded: user.onboarded === true,
    emailVerified: Boolean(user.emailVerifiedAt),
    verificationResendAt: user.emailOtp?.sentAt
      ? new Date(+user.emailOtp.sentAt + 60000)
      : null,
    createdAt: user.createdAt,
    usage: user.usage || {},
  };
}

function mountAuth({ app, db, config, mailer, authLimiter }) {
  const users = db.collection("users");
  const secureWork = admission(3);
  const safeHash = (password) => secureWork(() => hashPassword(password));
  const safeVerify = (password, hash) =>
    secureWork(() => verifyPassword(password, hash));
  const otp = new OtpService({ db, config, mailer });
  const codeSchema = z
    .string()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your email.");
  const cookies = {
    httpOnly: true,
    secure: config.production,
    sameSite: "lax",
    path: "/",
    maxAge: config.sessionMs,
  };
  function originGuard(req, _res, next) {
    if (req.get("origin") !== config.appUrl)
      throw new AppError(
        403,
        "ORIGIN_DENIED",
        "This request must come from your Sandbee panel.",
      );
    next();
  }
  async function sessionAuth(req, _res, next) {
    const token = req.cookies[config.cookieName];
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new AppError(401, "UNAUTHENTICATED", "Please sign in to continue.");
    const user = await users.findOne({
      sessions: {
        $elemMatch: { hash: hashToken(token), expiresAt: { $gt: new Date() } },
      },
    });
    if (!user)
      throw new AppError(
        401,
        "UNAUTHENTICATED",
        "Your session expired. Please sign in again.",
      );
    req.user = user;
    req.session = user.sessions.find(
      (session) => session.hash === hashToken(token),
    );
    req.sessionToken = token;
    next();
  }
  function csrf(req, _res, next) {
    if (
      !equalToken(
        req.get("x-csrf-token"),
        csrfToken(req.sessionToken, config.secret),
      )
    )
      throw new AppError(
        403,
        "CSRF_INVALID",
        "Please reload the panel and try again.",
      );
    next();
  }
  function verified(req, _res, next) {
    if (!req.user.emailVerifiedAt)
      throw new AppError(
        403,
        "EMAIL_NOT_VERIFIED",
        "Verify your email before continuing.",
      );
    next();
  }
  // Recheck the session at the mutation, not only before asynchronous work.
  // Password resets/logout may revoke it while this request is in flight.
  async function updateAccount(req, update, options = {}) {
    const result = await users.updateOne(
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
      update,
      options,
    );
    if (!result.matchedCount)
      throw new AppError(
        401,
        "UNAUTHENTICATED",
        "Your session changed. Please sign in again.",
      );
  }
  async function issueSession(res, user, extra = {}) {
    const token = newToken(),
      now = new Date();
    const sessionWrite = await users.updateOne(
      { _id: user._id, passwordHash: user.passwordHash },
      {
        $push: {
          sessions: {
            $each: [
              {
                hash: hashToken(token),
                expiresAt: new Date(now.getTime() + config.sessionMs),
              },
            ],
            $slice: -5,
          },
        },
      },
    );
    if (!sessionWrite.matchedCount)
      throw new AppError(
        401,
        "UNAUTHENTICATED",
        "Your credentials changed. Please sign in again.",
      );
    res.cookie(config.cookieName, token, cookies);
    res.json({
      user: publicUser(user),
      csrfToken: csrfToken(token, config.secret),
      ...extra,
    });
  }

  app.post("/api/auth/signup", originGuard, authLimiter, async (req, res) => {
    const input = signupSchema.parse(req.body);
    const passwordHash = await safeHash(input.password);
    const user = {
      name: input.name,
      email: input.email,
      passwordHash,
      onboarded: false,
      createdAt: new Date(),
      sessions: [],
      authVersion: 0,
    };
    try {
      const inserted = await users.insertOne(user);
      user._id = inserted.insertedId;
    } catch (error) {
      if (error.code === 11000)
        throw new AppError(
          409,
          "ACCOUNT_EXISTS",
          "An account with this email already exists. Please sign in.",
        );
      throw error;
    }
    let verificationError = "";
    try {
      await otp.send(user, "verify");
    } catch {
      verificationError =
        "We could not send your verification email. Please request a new code shortly.";
    }
    await issueSession(res, await users.findOne({ _id: user._id }), {
      verificationError,
    });
  });
  app.post("/api/auth/login", originGuard, authLimiter, async (req, res) => {
    const input = credentials.parse(req.body),
      user = await users.findOne({ email: input.email });
    if (!(await safeVerify(input.password, user?.passwordHash)))
      throw new AppError(
        401,
        "INVALID_CREDENTIALS",
        "Email or password is incorrect.",
      );
    await issueSession(res, user);
  });
  app.get("/api/auth/me", sessionAuth, (req, res) =>
    res.json({
      user: publicUser(req.user),
      csrfToken: csrfToken(req.sessionToken, config.secret),
    }),
  );
  app.post(
    "/api/auth/verification/send",
    originGuard,
    sessionAuth,
    csrf,
    authLimiter,
    async (req, res) => {
      emptyBody.parse(req.body);
      if (req.user.emailVerifiedAt)
        return res.json({ user: publicUser(req.user) });
      await otp.send(req.user, "verify");
      res.json({
        user: publicUser(await users.findOne({ _id: req.user._id })),
      });
    },
  );
  app.post(
    "/api/auth/verification/confirm",
    originGuard,
    sessionAuth,
    csrf,
    authLimiter,
    async (req, res) => {
      const { code } = z.object({ code: codeSchema }).strict().parse(req.body);
      const result = await otp.consume({ _id: req.user._id }, "verify", code);
      res.json({ user: publicUser(result.user) });
    },
  );
  app.post(
    "/api/auth/forgot-password",
    originGuard,
    authLimiter,
    async (req, res) => {
      const { email } = z
        .object({ email: emailSchema })
        .strict()
        .parse(req.body);
      otp.queueReset(email);
      res.json({
        ok: true,
        message:
          "If an account exists for this email, a reset code will arrive shortly.",
        resendAfter: 60,
      });
    },
  );
  app.post(
    "/api/auth/reset/verify",
    originGuard,
    authLimiter,
    async (req, res) => {
      const { email, code } = z
        .object({ email: emailSchema, code: codeSchema })
        .strict()
        .parse(req.body);
      const { token } = await otp.consume({ email }, "reset", code);
      res.json({ resetToken: token });
    },
  );
  app.post(
    "/api/auth/reset-password",
    originGuard,
    authLimiter,
    async (req, res) => {
      const { email, resetToken, password } = z
        .object({
          email: emailSchema,
          resetToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
          password: passwordSchema,
        })
        .strict()
        .parse(req.body);
      const query = {
        email,
        "passwordReset.hash": hashToken(resetToken),
        "passwordReset.expiresAt": { $gt: new Date() },
      };
      if (!(await users.findOne(query, { projection: { _id: 1 } })))
        throw new AppError(
          400,
          "RESET_EXPIRED",
          "This reset session expired. Please request another code.",
        );
      const passwordHash = await safeHash(password);
      query["passwordReset.expiresAt"] = { $gt: new Date() };
      const result = await users.updateOne(query, {
        $set: { passwordHash, sessions: [], emailVerifiedAt: new Date() },
        $unset: { passwordReset: "", resetOtp: "", emailOtp: "" },
        $inc: { authVersion: 1 },
      });
      if (!result.matchedCount)
        throw new AppError(
          400,
          "RESET_EXPIRED",
          "This reset session expired. Please request another code.",
        );
      otp.notifyPasswordChanged(email);
      res.clearCookie(config.cookieName, { ...cookies, maxAge: undefined });
      res.json({ ok: true });
    },
  );
  app.post(
    "/api/auth/logout",
    originGuard,
    sessionAuth,
    csrf,
    async (req, res) => {
      emptyBody.parse(req.body);
      await updateAccount(req, {
        $pull: { sessions: { hash: hashToken(req.sessionToken) } },
      });
      res.clearCookie(config.cookieName, { ...cookies, maxAge: undefined });
      res.json({ ok: true });
    },
  );
  app.post(
    "/api/auth/password",
    originGuard,
    sessionAuth,
    csrf,
    authLimiter,
    async (req, res) => {
      const input = z
        .object({
          currentPassword: z.string().min(1).max(128),
          password: passwordSchema,
        })
        .strict()
        .parse(req.body);
      if (!(await safeVerify(input.currentPassword, req.user.passwordHash)))
        throw new AppError(
          401,
          "INVALID_CREDENTIALS",
          "Current password is incorrect.",
        );
      await updateAccount(req, {
        $set: { passwordHash: await safeHash(input.password), sessions: [] },
        $unset: { passwordReset: "", resetOtp: "", emailOtp: "" },
        $inc: { authVersion: 1 },
      });
      otp.notifyPasswordChanged(req.user.email);
      res.clearCookie(config.cookieName, { ...cookies, maxAge: undefined });
      res.json({ ok: true });
    },
  );
  app.post(
    "/api/onboarding",
    originGuard,
    sessionAuth,
    csrf,
    verified,
    async (req, res) => {
      const profile = profileSchema.parse(req.body);
      await updateAccount(req, { $set: { ...profile, onboarded: true } });
      res.json({
        user: publicUser({ ...req.user, ...profile, onboarded: true }),
      });
    },
  );
  return { originGuard, sessionAuth, csrf, verified, updateAccount, otp };
}
module.exports = { mountAuth };
