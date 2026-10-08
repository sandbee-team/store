import { BrandMark } from "../components/Brand";
import { Select } from "../components/ui/Select";
import { useEffect, useState } from "react";
import { ArrowRight, Fingerprint, ScanLine, Users } from "lucide-react";
import { api } from "../lib/api";
import { Button, Field, ErrorNotice } from "../components/ui";
export default function Auth({ user, onUser }) {
  const [mode, setMode] = useState("login"),
    [email, setEmail] = useState(""),
    [resetToken, setResetToken] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [message, setMessage] = useState(""),
    [step, setStep] = useState(0),
    [profile, setProfile] = useState(null),
    [invites, setInvites] = useState([]);
  const stage = user ? (!user.emailVerified ? "verify" : "onboard") : mode;
  useEffect(() => {
    if (stage === "onboard")
      api("/api/invitations")
        .then((result) => setInvites(result.invitations))
        .catch(() => {});
  }, [stage]);
  const content = {
    login: [
      "Sign in to Sandbee Store",
      "Access your services, API keys and team workspaces.",
    ],
    signup: [
      "Create your account",
      "Start with your email. Set up your workspace next.",
    ],
    verify: [
      "Verify your email",
      "Enter the six-digit code sent to " + (user?.email || "") + ".",
    ],
    onboard:
      step === 0
        ? ["Set up your workspace", "Choose a name your team will recognize."]
        : [
            "Choose your services",
            "Enable what you need now. You can change this later.",
          ],
    forgot: [
      "Reset your password",
      "Enter your email to request a one-time recovery code.",
    ],
    resetCode: [
      "Enter your recovery code",
      "If this email has an account, a code is on its way.",
    ],
    newPassword: [
      "Set a new password",
      "Use a unique passphrase you have not used before.",
    ],
  }[stage];
  function change(next) {
    setMode(next);
    setError(null);
    setMessage("");
  }
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget),
      values = Object.fromEntries(form);
    setError(null);
    setMessage("");
    if (stage === "onboard" && step === 0) {
      setProfile(values);
      setStep(1);
      return;
    }
    setBusy(true);
    try {
      if (stage === "login" || stage === "signup") {
        const result = await api("/api/auth/" + stage, {
          method: "POST",
          body: values,
        });
        onUser(result.user);
        setMessage(result.verificationError || "");
      }
      if (stage === "verify") {
        const result = await api("/api/auth/verification/confirm", {
          method: "POST",
          body: values,
        });
        onUser(result.user);
      }
      if (stage === "onboard") {
        const result = await api("/api/onboarding", {
          method: "POST",
          body: profile,
        });
        for (const app of form.getAll("apps"))
          await api("/api/apps/" + app + "/activation", {
            method: "PUT",
            body: { enabled: true },
          });
        onUser(result.user);
      }
      if (stage === "forgot") {
        await api("/api/auth/forgot-password", {
          method: "POST",
          body: values,
        });
        setEmail(values.email);
        change("resetCode");
      }
      if (stage === "resetCode") {
        const result = await api("/api/auth/reset/verify", {
          method: "POST",
          body: { email, ...values },
        });
        setResetToken(result.resetToken);
        change("newPassword");
      }
      if (stage === "newPassword") {
        await api("/api/auth/reset-password", {
          method: "POST",
          body: { email, resetToken, ...values },
        });
        setResetToken("");
        change("login");
        setMessage("Password updated. Sign in with your new password.");
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/verification/send", { method: "POST", body: {} });
      setMessage("A new code was sent. Check your inbox and spam folder.");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function join(id) {
    setBusy(true);
    setError(null);
    try {
      await api("/api/invitations/" + id + "/accept", {
        method: "POST",
        body: {},
      });
      const me = await api("/api/auth/me");
      onUser(me.user);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const progress =
    stage === "signup"
      ? 0
      : stage === "verify"
        ? 1
        : stage === "onboard"
          ? 2 + step
          : -1;
  return (
    <div className="auth-page">
      <aside className="auth-context">
        <a className="brand" href="/">
          <BrandMark />
          <strong>sandbee</strong>
          <span>store</span>
        </a>
        <div className="auth-context-content">
          <h1>The workspace behind your integrations.</h1>
          <p>
            Business data, local document processing and your team. Connected
            through one account.
          </p>
          <div className="auth-products">
            <div>
              <Fingerprint size={23} />
              <span>
                <strong>GSTIN API</strong>
                <small>Registered business details from your backend.</small>
              </span>
            </div>
            <div>
              <ScanLine size={23} />
              <span>
                <strong>Document OCR</strong>
                <small>Install the package. Process on your server.</small>
              </span>
            </div>
            <div>
              <Users size={23} />
              <span>
                <strong>Workspace access</strong>
                <small>Invite your team with the right permissions.</small>
              </span>
            </div>
          </div>
        </div>
        <footer>One account. Access defined by your workspace.</footer>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          {progress >= 0 && (
            <ol className="auth-progress" aria-label="Account setup progress">
              {["Account", "Verify", "Workspace", "Services"].map(
                (label, i) => (
                  <li
                    key={label}
                    className={
                      i === progress
                        ? "current"
                        : i < progress
                          ? "complete"
                          : ""
                    }
                    aria-current={i === progress ? "step" : undefined}
                  >
                    {label}
                  </li>
                ),
              )}
            </ol>
          )}
          <h2>{content[0]}</h2>
          <p>{content[1]}</p>
          <ErrorNotice error={error} />
          {message && (
            <div className="notice" role="status">
              {message}
            </div>
          )}
          {stage === "onboard" && step === 0 && invites.length > 0 && (
            <div className="onboard-invites">
              <p>
                You have a workspace invitation. Join it, or create your own
                workspace below.
              </p>
              {invites.map((invite) => (
                <Button
                  key={invite.id}
                  busy={busy}
                  variant="secondary"
                  onClick={() => join(invite.id)}
                >
                  Join {invite.workspace}
                </Button>
              ))}
            </div>
          )}
          <form onSubmit={submit} key={stage + step}>
            {stage === "signup" && (
              <Field label="Your name">
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Your full name"
                />
              </Field>
            )}
            {["login", "signup", "forgot"].includes(stage) && (
              <Field label="Email address">
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  placeholder="you@company.com"
                />
              </Field>
            )}
            {["login", "signup", "newPassword"].includes(stage) && (
              <Field
                label={stage === "newPassword" ? "New password" : "Password"}
                hint={
                  stage === "login"
                    ? null
                    : "At least 12 characters. Use a long, unique passphrase."
                }
              >
                <input
                  name="password"
                  type="password"
                  required
                  minLength={stage === "login" ? 1 : 12}
                  maxLength={128}
                  autoComplete={
                    stage === "login" ? "current-password" : "new-password"
                  }
                />
              </Field>
            )}
            {["verify", "resetCode"].includes(stage) && (
              <Field
                label="Verification code"
                hint="Expires in 10 minutes. Never share this code."
              >
                <input
                  className="otp-input"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  placeholder="000000"
                />
              </Field>
            )}
            {stage === "onboard" && step === 0 && (
              <>
                <Field label="Workspace name">
                  <input
                    name="company"
                    required
                    minLength={2}
                    maxLength={100}
                    defaultValue={profile?.company}
                    placeholder="Your company or project"
                  />
                </Field>
                <Field label="Primary use">
                  <Select
                    name="useCase"
                    defaultValue={profile?.useCase || "development"}
                  >
                    <option value="development">Developer integrations</option>
                    <option value="verification">
                      Document and business verification
                    </option>
                    <option value="invoicing">Invoicing and accounting</option>
                    <option value="other">Other</option>
                  </Select>
                </Field>
              </>
            )}
            {stage === "onboard" && step === 1 && (
              <div className="auth-services">
                <label>
                  <input type="checkbox" name="apps" value="gst" />
                  <span>
                    <strong>GSTIN API</strong>
                    <small>Business lookup and a hosted REST API.</small>
                  </span>
                </label>
                <label>
                  <input type="checkbox" name="apps" value="ocr" />
                  <span>
                    <strong>Document OCR</strong>
                    <small>
                      Try the demo, then install the Node.js package.
                    </small>
                  </span>
                </label>
              </div>
            )}
            {stage === "login" && (
              <button
                type="button"
                className="text-link forgot-link"
                onClick={() => change("forgot")}
              >
                Forgot password?
              </button>
            )}
            <Button busy={busy} type="submit" className="full">
              {
                {
                  login: "Sign in",
                  signup: "Create account",
                  verify: "Verify email",
                  onboard:
                    step === 0 ? "Continue to services" : "Open workspace",
                  forgot: "Send reset code",
                  resetCode: "Verify reset code",
                  newPassword: "Update password",
                }[stage]
              }
              <ArrowRight size={16} />
            </Button>
            {stage === "onboard" && step === 1 && (
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setStep(0)}
              >
                Back to workspace details
              </Button>
            )}
          </form>
          {stage === "verify" && (
            <Button variant="ghost" busy={busy} onClick={resend}>
              Resend code
            </Button>
          )}
          {!user && (
            <p className="auth-switch">
              {stage === "login"
                ? "New to Sandbee? "
                : "Already have an account? "}
              <button
                className="text-link"
                onClick={() => change(stage === "login" ? "signup" : "login")}
              >
                {stage === "login" ? "Create an account" : "Sign in"}
              </button>
            </p>
          )}
          {user && (
            <button
              className="text-link"
              onClick={async () => {
                try {
                  await api("/api/auth/logout", { method: "POST", body: {} });
                  onUser(null);
                } catch (e) {
                  setError(e);
                }
              }}
            >
              Use another account
            </button>
          )}
        </div>
        <footer>
          <a href="/developers">Developer documentation</a>
        </footer>
      </main>
    </div>
  );
}
