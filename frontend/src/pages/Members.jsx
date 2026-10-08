import { Select } from "../components/ui/Select";
import { useState } from "react";
import { UserPlus, Mail, Users } from "lucide-react";
import { api } from "../lib/api";
import { useResource } from "../hooks/useResource";
import {
  PageTitle,
  Button,
  Field,
  Section,
  ErrorNotice,
  Pill,
  Skeleton,
  Modal,
  date,
} from "../components/ui";
const roles = [
  ["admin", "Admin"],
  ["developer", "Developer"],
  ["viewer", "Viewer"],
];
export default function Members({ user, data, reload, embedded = false }) {
  const team = useResource("/api/workspace/members");
  const [inviting, setInviting] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [message, setMessage] = useState(""),
    [confirm, setConfirm] = useState(null);
  const manage = data.workspace.permissions.includes("manageMembers");
  async function mutate(path, method, body) {
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const result = await api(path, { method, body });
      team.reload();
      await reload();
      setConfirm(null);
      setInviting(false);
      setMessage(result.message || "Workspace updated.");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        compact={embedded}
        title="Members"
        action={
          manage && (
            <Button onClick={() => setInviting(!inviting)}>
              <UserPlus size={15} />
              Invite member
            </Button>
          )
        }
      >
        Manage who can use this workspace and what they can change.
      </PageTitle>
      <ErrorNotice error={error || team.error} />
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      {inviting && (
        <Section
          title="Invite a teammate"
          description="They must sign in with this email and accept. Invitations expire after 7 days."
        >
          <form
            className="invite-form"
            onSubmit={(event) => {
              event.preventDefault();
              mutate(
                "/api/workspace/invitations",
                "POST",
                Object.fromEntries(new FormData(event.currentTarget)),
              );
            }}
          >
            <Field label="Teammate email">
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                placeholder="teammate@company.com"
              />
            </Field>
            <Field label="Role">
              <Select name="role" defaultValue="developer">
                {roles.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Button busy={busy} type="submit">
              <Mail size={15} />
              Send invitation
            </Button>
            <Button
              variant="ghost"
              type="button"
              disabled={busy}
              onClick={() => setInviting(false)}
            >
              Cancel
            </Button>
          </form>
        </Section>
      )}
      {team.loading && <Skeleton lines={5} />}
      {team.data && (
        <>
          <Section title={`Workspace members (${team.data.members.length})`}>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Joined</th>
                    {manage && <th>Access</th>}
                  </tr>
                </thead>
                <tbody>
                  {team.data.members.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <div className="person-cell">
                          <span className="avatar">
                            {member.name.slice(0, 1)}
                          </span>
                          <span>
                            <strong>
                              {member.name}
                              {member.id === user.id ? " (you)" : ""}
                            </strong>
                            <small>{member.email}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <Pill tone="neutral">{member.role}</Pill>
                      </td>
                      <td>{date(member.joinedAt)}</td>
                      {manage && (
                        <td>
                          {member.role === "owner" ? (
                            <span className="muted">Workspace owner</span>
                          ) : member.id === user.id ? (
                            <span className="muted">Your account</span>
                          ) : (
                            <div className="row-actions">
                              <Select
                                aria-label={`Role for ${member.email}`}
                                value={member.role}
                                onChange={(event) =>
                                  setConfirm({
                                    title: `Change ${member.name}'s role?`,
                                    path: `/api/workspace/members/${member.id}`,
                                    method: "PATCH",
                                    body: { role: event.target.value },
                                    action: "Change role",
                                  })
                                }
                              >
                                {roles.map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </Select>
                              <button
                                className="text-link danger"
                                onClick={() =>
                                  setConfirm({
                                    title: `Remove ${member.name}?`,
                                    path: `/api/workspace/members/${member.id}`,
                                    method: "DELETE",
                                    action: "Remove member",
                                  })
                                }
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          {manage && (
            <Section
              title="Pending invitations"
              description="Resend by inviting the same email again after one minute."
            >
              {team.data.invitations.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Delivery</th>
                        <th>Expires</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {team.data.invitations.map((invite) => (
                        <tr key={invite.id}>
                          <td>{invite.email}</td>
                          <td className="capitalize">{invite.role}</td>
                          <td>
                            <Pill
                              tone={
                                invite.delivery === "failed"
                                  ? "amber"
                                  : "neutral"
                              }
                            >
                              {invite.delivery === "failed"
                                ? "Email failed"
                                : "Sent"}
                            </Pill>
                          </td>
                          <td>{date(invite.expiresAt)}</td>
                          <td>
                            <button
                              className="text-link danger"
                              disabled={busy}
                              onClick={() =>
                                mutate(
                                  `/api/workspace/invitations/${invite.id}`,
                                  "DELETE",
                                )
                              }
                            >
                              Cancel invite
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-inline">
                  <Users size={20} />
                  <p>
                    No pending invitations. Invite someone when you are ready to
                    share access.
                  </p>
                </div>
              )}
            </Section>
          )}
        </>
      )}
      <details className="permissions-details">
        <summary>Role permissions</summary>
        <Section title="Role permissions">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Services and reports</th>
                  <th>API keys</th>
                  <th>Members and apps</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "Owner",
                    "Full access",
                    "All workspace keys",
                    "Manage; protected owner",
                  ],
                  ["Admin", "Full access", "All workspace keys", "Manage"],
                  [
                    "Developer",
                    "Use enabled apps; read reports",
                    "Create and manage own keys",
                    "View",
                  ],
                  [
                    "Viewer",
                    "Read reports and guides",
                    "Cannot create or change keys",
                    "View",
                  ],
                ].map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell) => (
                      <td key={cell}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </details>
      {confirm && (
        <Modal
          title={confirm.title}
          busy={busy}
          onClose={() => setConfirm(null)}
        >
          <p>
            Keys created by this member will be revoked. Running OCR clients
            stop accepting new work within their 60-second license window.
          </p>
          <div className="dialog-actions">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              busy={busy}
              onClick={() => mutate(confirm.path, confirm.method, confirm.body)}
            >
              {confirm.action}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
