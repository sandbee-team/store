import { money } from "./Billing";
import { Select } from "../components/ui/Select";
import { useState } from "react";
import {
  ArrowRight,
  Fingerprint,
  ScanLine,
  KeyRound,
  Users,
} from "lucide-react";
import {
  PageTitle,
  Button,
  Pill,
  Section,
  Skeleton,
  ErrorNotice,
  date,
} from "../components/ui";
import { useResource } from "../hooks/useResource";
import UsageChart from "../components/UsageChart";
import MetricStrip from "../components/MetricStrip";
import { number } from "../lib/format";
export default function Home({ data, navigate }) {
  const [days, setDays] = useState("7");
  const report = useResource(`/api/reports/usage?days=${days}`),
    totals = report.data?.totals;
  const keys = data.tokens.filter((t) => t.active).length;
  const completed = totals ? totals.success + totals.failed : 0;
  const metrics = [
    {
      label: "Successful requests",
      value: totals ? number(totals.success) : "—",
      note: "Hosted GST + OCR demo",
    },
    {
      label: "Success rate",
      value: completed
        ? `${Math.round((totals.success / completed) * 100)}%`
        : "—",
      note: totals
        ? `${number(totals.failed)} failed · ${number(totals.pending)} unconfirmed`
        : "Loading usage",
    },
    {
      label: "GST cache hits",
      value: totals?.gst
        ? `${Math.round((totals.cached / totals.gst) * 100)}%`
        : "—",
      note: totals
        ? `${number(totals.cached)} saved responses`
        : "Loading usage",
    },
    {
      label: "Enabled apps",
      value: `${data.apps.filter((a) => a.enabled).length} / ${data.apps.length}`,
      note: `${keys} visible active API keys`,
    },
  ];
  return (
    <>
      <PageTitle
        title="Dashboard"
        action={
          <div className="toolbar">
            <label className="sr-only" htmlFor="dashboard-period">
              Dashboard period
            </label>
            <Select
              id="dashboard-period"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </Select>
            <Button variant="secondary" onClick={() => navigate("/apps")}>
              Browse apps
              <ArrowRight size={14} />
            </Button>
          </div>
        }
      >
        {data.workspace.name} · Usage and workspace activity.
      </PageTitle>
      <ErrorNotice error={report.error} />
      {report.error && <Button onClick={report.reload}>Retry usage</Button>}
      <MetricStrip items={metrics} />
      <div className="dashboard-grid">
        <div>
          <Section
            title="Request activity"
            description={`Successful hosted requests · last ${days} days`}
            action={
              <button
                className="text-link"
                onClick={() => navigate("/reports")}
              >
                Full report
                <ArrowRight size={13} />
              </button>
            }
          >
            {report.loading && <Skeleton lines={3} />}{" "}
            {report.data && (
              <>
                <UsageChart series={report.data.series} />
                {!totals.authorized && (
                  <p className="chart-empty">
                    No requests yet. Open an app to make your first request.
                  </p>
                )}
              </>
            )}
          </Section>
          <Section
            title="Your services"
            action={
              <button className="text-link" onClick={() => navigate("/apps")}>
                All apps
                <ArrowRight size={13} />
              </button>
            }
          >
            <div className="table-scroll">
              <table className="service-table">
                <thead>
                  <tr>
                    <th>App</th>
                    <th>Status</th>
                    <th className="numeric">Successful requests</th>
                    <th>
                      <span className="sr-only">Open service</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.apps.map((app) => {
                    const Icon = app.id === "gst" ? Fingerprint : ScanLine;
                    return (
                      <tr key={app.id}>
                        <td>
                          <span className="table-app">
                            <Icon size={18} />
                            <strong>{app.name}</strong>
                            <Pill tone="neutral">{app.pricing.label}</Pill>
                          </span>
                        </td>
                        <td>
                          <Pill tone={app.enabled ? "green" : "neutral"}>
                            {app.enabled ? "Enabled" : "Not enabled"}
                          </Pill>
                        </td>
                        <td className="numeric">
                          {totals
                            ? number(
                                app.id === "gst" ? totals.gst : totals.demo,
                              )
                            : "—"}
                        </td>
                        <td>
                          <button
                            className="text-link"
                            onClick={() => navigate(app.path)}
                          >
                            {app.enabled ? "Open" : "Set up"}
                            <ArrowRight size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
        <div>
          <Section title="Workspace plan" action={<Pill>Free</Pill>}>
            <div className="dashboard-billing">
              <strong>{money(data.billing.amountDueMinor)}</strong>
              <span>Amount due</span>
            </div>
            <p>No card required. Your current apps are free.</p>
            <button className="text-link" onClick={() => navigate("/billing")}>
              View billing <ArrowRight size={13} />
            </button>
          </Section>
          <Section title="Workspace access">
            <dl className="compact-facts">
              <div>
                <dt>Your role</dt>
                <dd className="capitalize">{data.workspace.role}</dd>
              </div>
              <div>
                <dt>Members</dt>
                <dd>{number(data.workspace.memberCount)}</dd>
              </div>
              <div>
                <dt>Your visible active keys</dt>
                <dd>{keys}</dd>
              </div>
            </dl>
            <div className="quick-actions">
              <button className="text-link" onClick={() => navigate("/tokens")}>
                <KeyRound size={14} /> API keys
              </button>
              <button
                className="text-link"
                onClick={() => navigate("/settings/members")}
              >
                <Users size={14} /> Members
              </button>
            </div>
          </Section>
          <Section title="Recent key activity">
            {data.activity.length ? (
              <ol className="activity-list">
                {data.activity.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                    <small>{date(item.at)}</small>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">
                Created and revoked keys will appear here.
              </p>
            )}
          </Section>
          {!keys && data.workspace.permissions.includes("keys") && (
            <div className="integration-note">
              <strong>Connect your first project</strong>
              <p>
                {data.apps.some((a) => a.enabled)
                  ? "Create a key for an enabled app, then follow its developer guide."
                  : "Enable an app to create your first API key."}
              </p>
              <button
                className="text-link"
                onClick={() =>
                  navigate(
                    data.apps.some((a) => a.enabled) ? "/tokens" : "/apps",
                  )
                }
              >
                {data.apps.some((a) => a.enabled)
                  ? "Create a key"
                  : "Choose an app"}
                <ArrowRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="footnote">
        Customer-hosted OCR runs stay on your server and are not counted here.
      </p>
    </>
  );
}
