import { useState } from "react";
import { Mail, ArrowRight } from "lucide-react";
import { api } from "../lib/api";
import {
  PageTitle,
  Section,
  Button,
  ErrorNotice,
  Pill,
  Empty,
  date,
} from "../components/ui";
export default function Invitations({
  invitations,
  reload,
  navigate,
  embedded = false,
}) {
  const [busy, setBusy] = useState(null),
    [error, setError] = useState(null);
  async function accept(id) {
    setBusy(id);
    setError(null);
    try {
      await api(`/api/invitations/${id}/accept`, { method: "POST", body: {} });
      await reload();
      navigate("/");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <PageTitle compact={embedded} title="Workspace invitations">
        Invitations sent to your verified account email. Joining a workspace
        does not share your personal workspace.
      </PageTitle>
      <ErrorNotice error={error} />
      <Section title="Waiting for your response">
        {invitations.length ? (
          <div className="invitation-list">
            {invitations.map((invite) => (
              <article className="invitation-row" key={invite.id}>
                <Mail size={21} />
                <div>
                  <h3>{invite.workspace}</h3>
                  <p>Expires {date(invite.expiresAt)}</p>
                </div>
                <Pill tone="neutral">{invite.role}</Pill>
                <Button
                  busy={busy === invite.id}
                  disabled={Boolean(busy)}
                  onClick={() => accept(invite.id)}
                >
                  Accept invitation
                  <ArrowRight size={14} />
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <Empty icon={Mail} title="No pending invitations">
            Ask a workspace administrator to invite your account email. New
            invitations appear here.
          </Empty>
        )}
      </Section>
      <Button variant="secondary" onClick={reload}>
        Refresh invitations
      </Button>
    </>
  );
}
