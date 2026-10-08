import { useState } from "react";
import { api } from "../lib/api";
import {
  Field,
  Button,
  ErrorNotice,
  Pill,
  Section,
  date,
} from "../components/ui";
export default function Account({ user, data, onUser, section = "profile" }) {
  const [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/password", {
        method: "POST",
        body: Object.fromEntries(new FormData(event.currentTarget)),
      });
      onUser(null);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (section === "security")
    return (
      <div className="settings-columns">
        <Section
          title="Change password"
          description="Use a unique passphrase of at least 12 characters."
        >
          <ErrorNotice error={error} />
          <form onSubmit={submit}>
            <Field label="Current password">
              <input
                name="currentPassword"
                type="password"
                required
                maxLength={128}
                autoComplete="current-password"
              />
            </Field>
            <Field label="New password">
              <input
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </Field>
            <Button busy={busy} type="submit">
              Update password & sign out
            </Button>
          </form>
        </Section>
        <Section title="Account protection">
          <dl className="compact-facts">
            <div>
              <dt>Email verification</dt>
              <dd>
                <Pill>Verified</Pill>
              </dd>
            </div>
            <div>
              <dt>Recovery email</dt>
              <dd>{user.email}</dd>
            </div>
          </dl>
          <p className="settings-description">
            Changing your password signs out your sessions and invalidates API
            keys you created across workspaces. Other members' keys stay active.
          </p>
          <p className="settings-description">
            After signing in again, create replacement keys and update your
            integrations.
          </p>
        </Section>
      </div>
    );
  return (
    <div className="settings-columns">
      <Section title="Profile">
        <dl className="profile-list">
          <div>
            <dt>Name</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>
              {user.email} <Pill>Verified</Pill>
            </dd>
          </div>
          <div>
            <dt>Member since</dt>
            <dd>{date(user.createdAt)}</dd>
          </div>
        </dl>
      </Section>
      <Section title="Current workspace">
        <dl className="profile-list">
          <div>
            <dt>Workspace</dt>
            <dd>{data.workspace.name}</dd>
          </div>
          <div>
            <dt>Your role</dt>
            <dd className="capitalize">{data.workspace.role}</dd>
          </div>
          <div>
            <dt>Members</dt>
            <dd>{data.workspace.memberCount}</dd>
          </div>
        </dl>
        <p className="settings-description">
          Use the workspace selector in the header to switch teams. Each
          workspace has separate apps, keys and usage.
        </p>
      </Section>
    </div>
  );
}
