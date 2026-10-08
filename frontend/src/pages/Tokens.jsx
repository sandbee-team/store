import { Select } from "../components/ui/Select";
import { useState } from "react";
import { Plus, X, KeyRound, Server } from "lucide-react";
import { api } from "../lib/api";
import {
  Button,
  Field,
  ErrorNotice,
  PageTitle,
  Pill,
  Empty,
  Code,
  Modal,
  Section,
  date,
} from "../components/ui";
export default function Tokens({ data, reload, appScope }) {
  const [creating, setCreating] = useState(false),
    [secret, setSecret] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [confirm, setConfirm] = useState(null);
  const visible = data.tokens.filter(
    (token) => !appScope || token.scope === appScope,
  );
  const canCreate = data.workspace.permissions.includes("keys"),
    canUse = data.apps.some((app) => app.enabled);
  const defaultScope =
    appScope || data.apps.find((app) => app.enabled)?.scope || "global";
  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api("/api/tokens", {
        method: "POST",
        body: Object.fromEntries(new FormData(event.currentTarget)),
      });
      setSecret(result.token);
      setCreating(false);
      await reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    setBusy(true);
    setError(null);
    try {
      await api(confirm.path, { method: "DELETE" });
      setConfirm(null);
      await reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title={appScope ? "App API keys" : "API keys"}
        action={
          canCreate && (
            <Button
              disabled={!canUse}
              onClick={() => {
                setError(null);
                setCreating(true);
              }}
            >
              <Plus size={15} />
              Create key
            </Button>
          )
        }
      >
        {appScope
          ? "Keys restricted to this service. Manage global keys from the workspace API keys page."
          : "Create an app-specific key, or a global key for all enabled services in this workspace."}
      </PageTitle>
      <ErrorNotice error={error} />
      {!canUse && (
        <div className="notice">Enable a service before creating a key.</div>
      )}
      {!canCreate && (
        <div className="notice">
          Your Viewer role cannot create or change API keys. Ask a workspace
          administrator for access.
        </div>
      )}
      {secret && (
        <Section
          title="Save your key now"
          className="secret-panel"
          action={
            <button
              className="icon-button"
              aria-label="Dismiss key"
              onClick={() => setSecret("")}
            >
              <X size={17} />
            </button>
          }
        >
          <p>
            This is the only time the complete key is shown. Store it in your
            server environment.
          </p>
          <Code language="Secret key">{secret}</Code>
          <Button variant="secondary" onClick={() => setSecret("")}>
            I have saved it
          </Button>
        </Section>
      )}
      <Section
        title="Service keys"
        description={
          data.workspace.permissions.includes("manageKeys")
            ? "Administrators can manage every workspace key."
            : "Only keys created by your account are shown."
        }
        action={
          <Pill tone="neutral">
            {data.tokens.filter((t) => t.active).length} visible active
          </Pill>
        }
      >
        {visible.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Scope</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((token) => (
                  <tr key={token.id}>
                    <td>
                      <strong>{token.name}</strong>
                      <small>{token.prefix}...</small>
                    </td>
                    <td>
                      <code>{token.scope}</code>
                    </td>
                    <td>
                      <Pill tone={token.active ? "green" : "neutral"}>
                        {token.active ? "Active" : "Revoked"}
                      </Pill>
                    </td>
                    <td>{date(token.createdAt)}</td>
                    <td>
                      {token.active && canCreate && (
                        <button
                          className="text-link danger"
                          onClick={() =>
                            setConfirm({
                              title: token.name,
                              path: "/api/tokens/" + token.id,
                            })
                          }
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={KeyRound} title="No keys in this view">
            Create a key for your backend integration. Secrets are stored as
            hashes and never shown again.
          </Empty>
        )}
      </Section>
      {appScope !== "gst:read" && (
        <Section
          title="OCR installations"
          description="Five lifetime installation identities per key. Revoked identities keep their slot."
        >
          {visible.some((token) => token.installations.length) ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Installation</th>
                    <th>Key</th>
                    <th>Platform</th>
                    <th>Last verified</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.flatMap((token) =>
                    token.installations.map((install) => (
                      <tr key={token.id + install.id}>
                        <td>
                          <strong>{install.label}</strong>
                          <small>{install.id}</small>
                        </td>
                        <td>{token.name}</td>
                        <td>{install.platform}</td>
                        <td>{date(install.lastSeenAt)}</td>
                        <td>
                          {!install.revokedAt && token.active ? (
                            canCreate && (
                              <button
                                className="text-link danger"
                                onClick={() =>
                                  setConfirm({
                                    title: install.label,
                                    path:
                                      "/api/tokens/" +
                                      token.id +
                                      "/installations/" +
                                      install.id,
                                  })
                                }
                              >
                                Revoke installation
                              </button>
                            )
                          ) : (
                            <Pill tone="neutral">Revoked</Pill>
                          )}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon={Server} title="No registered installations">
              Start the installed OCR package with your key. Its installation
              will appear after the first license check.
            </Empty>
          )}
        </Section>
      )}
      <p className="footnote">
        Keep keys server-side. Global keys can access apps enabled later in this
        workspace. OCR revocation blocks new work within the 60-second lease
        window; admitted jobs may finish.
      </p>
      {creating && (
        <Modal
          title="Create an API key"
          busy={busy}
          onClose={() => setCreating(false)}
        >
          <ErrorNotice error={error} />
          <form onSubmit={create}>
            <Field label="Key name">
              <input
                autoFocus
                name="name"
                required
                minLength={2}
                maxLength={60}
                placeholder="Production integration"
              />
            </Field>
            <Field label="Service">
              <Select name="scope" defaultValue={defaultScope}>
                {data.apps
                  .filter((app) => !appScope || app.scope === appScope)
                  .map((app) => (
                    <option
                      key={app.scope}
                      value={app.scope}
                      disabled={!app.enabled}
                    >
                      {app.name}
                    </option>
                  ))}
                {!appScope && (
                  <option value="global">Global / all enabled apps</option>
                )}
              </Select>
            </Field>
            <p className="footnote">
              Use an app key when your project needs only one service. Maximum
              10 active keys per workspace.
            </p>
            <div className="dialog-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setCreating(false)}
              >
                Cancel
              </Button>
              <Button busy={busy} type="submit">
                Create key
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {confirm && (
        <Modal
          title={"Revoke " + confirm.title + "?"}
          busy={busy}
          onClose={() => setConfirm(null)}
        >
          <ErrorNotice error={error} />
          <p>
            New authorization will be denied. Running OCR clients may finish
            their current 60-second lease window.
          </p>
          <div className="dialog-actions">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Cancel
            </Button>
            <Button variant="danger" busy={busy} onClick={revoke}>
              Revoke access
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
