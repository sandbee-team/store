import { useState } from "react";
import { api } from "../lib/api";
import {
  PageTitle,
  Section,
  Field,
  Button,
  ErrorNotice,
  Pill,
} from "../components/ui";
import Account from "./Account";
import Members from "./Members";
import Invitations from "./Invitations";
import LegacyAccounts from "../components/LegacyAccounts";
const tabs = [
  ["profile", "Profile"],
  ["workspace", "Workspace"],
  ["members", "Members"],
  ["invitations", "Invitations"],
  ["security", "Security"],
];
function WorkspaceSettings({ data, reload }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [saved, setSaved] = useState(false);
  const manage = data.workspace.permissions.includes("manageWorkspace");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api("/api/workspace", {
        method: "PATCH",
        body: Object.fromEntries(new FormData(event.currentTarget)),
      });
      await reload();
      setSaved(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-columns">
      <Section title="Workspace details">
        <ErrorNotice error={error} />
        {saved && (
          <p className="notice" role="status">
            Workspace name updated.
          </p>
        )}
        <form onSubmit={submit}>
          <Field label="Workspace name">
            <input
              name="name"
              defaultValue={data.workspace.name}
              required
              minLength={2}
              maxLength={100}
              disabled={!manage}
            />
          </Field>
          {manage ? (
            <Button busy={busy} type="submit">
              Save changes
            </Button>
          ) : (
            <p>Only an Owner or Admin can change workspace details.</p>
          )}
        </form>
        <dl className="compact-facts settings-facts">
          <div>
            <dt>Workspace ID</dt>
            <dd>
              <code>{data.workspace.id}</code>
            </dd>
          </div>
          <div>
            <dt>Members</dt>
            <dd>{data.workspace.memberCount} / 50</dd>
          </div>
        </dl>
      </Section>
      <Section title="Enabled services">
        <dl className="compact-facts">
          {data.apps.map((app) => (
            <div key={app.id}>
              <dt>{app.name}</dt>
              <dd>
                <Pill tone={app.enabled ? "green" : "neutral"}>
                  {app.enabled ? "Enabled" : "Not enabled"}
                </Pill>
              </dd>
            </div>
          ))}
        </dl>
        <p className="settings-description">
          App-specific keys work for one enabled service. Global keys work
          across this workspace's enabled apps.
        </p>
      </Section>
    </div>
  );
}
export default function Settings({
  tab = "profile",
  invitations = [],
  ...shared
}) {
  const selected = tabs.some(([id]) => id === tab) ? tab : "profile";
  return (
    <>
      <PageTitle title="Settings">
        Account details, workspace access and security.
      </PageTitle>
      <nav className="settings-tabs" aria-label="Settings sections">
        {tabs.map(([id, label]) => (
          <a
            key={id}
            href={`/settings/${id}`}
            aria-current={selected === id ? "page" : undefined}
            onClick={(event) => {
              if (!event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                shared.navigate(`/settings/${id}`);
              }
            }}
          >
            {label}
            {id === "invitations" && invitations.length > 0 && (
              <span>{invitations.length}</span>
            )}
          </a>
        ))}
      </nav>
      <div className="settings-content" key={selected}>
        {selected === "profile" && (
          <>
            <Account {...shared} />
            <LegacyAccounts />
          </>
        )}
        {selected === "security" && <Account {...shared} section="security" />}
        {selected === "workspace" && <WorkspaceSettings {...shared} />}{" "}
        {selected === "members" && <Members {...shared} embedded />}
        {selected === "invitations" && (
          <Invitations {...shared} invitations={invitations} embedded />
        )}
      </div>
    </>
  );
}
