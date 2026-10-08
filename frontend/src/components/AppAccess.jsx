import { useState } from "react";
import { Power, ArrowRight } from "lucide-react";
import { api } from "../lib/api";
import { Button, ErrorNotice, PageTitle, Pill, Modal } from "./ui";
export default function AppAccess({ app, data, reload, children, path }) {
  const canManage = data.workspace.permissions.includes("manageApps");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [confirm, setConfirm] = useState(false);
  async function activate(enabled) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/apps/${app.id}/activation`, {
        method: "PUT",
        body: { enabled },
      });
      await reload();
      setConfirm(false);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (path.endsWith("/guide")) return children;
  if (!app.enabled)
    return (
      <>
        <PageTitle title={app.name}>{app.description}</PageTitle>
        <section className="enable-service panel">
          <Pill tone="neutral">{app.pricing.label}</Pill>
          <h2>Enable {app.name}</h2>
          <p>
            {app.id === "gst"
              ? "Look up GST registration details and connect the hosted API to your backend."
              : "Try document extraction here, then install the OCR package on your Node.js server."}
          </p>
          <dl className="compact-facts">
            <div>
              <dt>Delivery</dt>
              <dd>{app.mode}</dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>App key or workspace global key</dd>
            </div>
          </dl>
          <ErrorNotice error={error} />
          <div className="quick-actions">
            <Button
              busy={busy}
              disabled={!canManage}
              onClick={() => activate(true)}
            >
              Enable {app.name}
              <ArrowRight size={14} />
            </Button>
            <a className="text-link" href={`/developers/${app.id}`}>
              Read guide
            </a>
          </div>
          {!canManage && <p>Ask an Owner or Admin to enable this service.</p>}
        </section>
      </>
    );
  return (
    <>
      <div className="app-status-row">
        <div>
          <Pill>{app.name} enabled</Pill>
          <span>{app.mode}</span>
          <Pill tone="neutral">{app.pricing.label}</Pill>
        </div>
        {canManage && (
          <button className="text-link danger" onClick={() => setConfirm(true)}>
            <Power size={13} />
            Disable
          </button>
        )}
      </div>
      <ErrorNotice error={error} />
      {confirm && (
        <Modal
          title={`Disable ${app.name}?`}
          busy={busy}
          onClose={() => setConfirm(false)}
        >
          <p>
            App and global keys will stop authorizing this service. Running OCR
            clients stop new work within the 60-second lease window.
          </p>
          <div className="dialog-actions">
            <Button
              busy={busy}
              variant="danger"
              onClick={() => activate(false)}
            >
              Disable app
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              Cancel
            </Button>
          </div>
        </Modal>
      )}
      {children}
    </>
  );
}
