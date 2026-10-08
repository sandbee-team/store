import ReportInsights from "../components/ReportInsights";
import { Select } from "../components/ui/Select";
import { useState } from "react";
import { Download } from "lucide-react";
import { useResource } from "../hooks/useResource";
import {
  PageTitle,
  ErrorNotice,
  Button,
  Section,
  Skeleton,
} from "../components/ui";
import MetricStrip from "../components/MetricStrip";
import UsageChart from "../components/UsageChart";
import { number, exportCsv } from "../lib/format";
export default function Reports({ app }) {
  const [days, setDays] = useState("30"),
    [offset, setOffset] = useState(0);
  const columns =
    app === "gst"
      ? [
          ["gst", "GSTIN"],
          ["cached", "Cached GST"],
          ["failed", "Failed"],
          ["pending", "Unconfirmed"],
        ]
      : app === "ocr"
        ? [
            ["demo", "OCR demo"],
            ["failed", "Failed"],
            ["pending", "Unconfirmed"],
          ]
        : [
            ["gst", "GSTIN"],
            ["demo", "OCR demo"],
            ["cached", "Cached GST"],
            ["failed", "Failed"],
            ["pending", "Unconfirmed"],
          ];
  const report = useResource(
    `/api/reports/usage?days=${days}${app ? "&service=" + (app === "gst" ? "gst" : "ocr-demo") : ""}`,
  );
  const data = report.data;
  function download() {
    exportCsv("sandbee-usage.csv", [
      [
        "Date (UTC)",
        "Authorized",
        "Successful",
        "Failed",
        "Unconfirmed",
        "GSTIN",
        "OCR demo",
        "GST cached",
      ],
      ...data.series.map((row) => [
        row.date,
        row.authorized,
        row.success,
        row.failed,
        row.pending,
        row.gst,
        row.demo,
        row.cached,
      ]),
    ]);
  }
  return (
    <>
      <PageTitle
        title={
          app
            ? app === "gst"
              ? "GSTIN usage"
              : "OCR demo usage"
            : "Usage & reports"
        }
        action={
          <div className="toolbar">
            <label className="sr-only" htmlFor="report-period">
              Report period
            </label>
            <Select
              id="report-period"
              value={days}
              onChange={(event) => {
                setDays(event.target.value);
                setOffset(0);
              }}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </Select>
            <Button variant="secondary" disabled={!data} onClick={download}>
              <Download size={15} />
              Export CSV
            </Button>
          </div>
        }
      >
        {app === "gst"
          ? "GSTIN requests for this workspace."
          : app === "ocr"
            ? "Hosted demo activity. Customer-side extractions are not sent to Sandbee."
            : "Hosted service activity for this workspace."}
      </PageTitle>
      <ErrorNotice error={report.error} />
      {report.error && <Button onClick={report.reload}>Retry report</Button>}
      {report.loading && <Skeleton lines={6} />}
      {data && (
        <>
          <MetricStrip
            items={[
              {
                label: "Successful requests",
                value: number(data.totals.success),
              },
              { label: "Failed requests", value: number(data.totals.failed) },
              {
                label: app ? "Unconfirmed" : "GSTIN lookups",
                value: number(app ? data.totals.pending : data.totals.gst),
              },
              {
                label: app === "gst" ? "Cached responses" : "OCR demo runs",
                value: number(
                  app === "gst" ? data.totals.cached : data.totals.demo,
                ),
              },
            ]}
          />
          <div className="report-chart-grid">
            <Section
              title="Request volume"
              description="Successful requests per day"
            >
              <UsageChart series={data.series} service={app} />
              {!data.totals.authorized && (
                <p className="chart-empty">
                  No requests in this period. Enable an app and make your first
                  request to see activity here.
                </p>
              )}
            </Section>
            <ReportInsights data={data} service={app} />
          </div>
          <Section
            title="Daily breakdown"
            description="All dates use UTC. A missing completion stays unconfirmed; it is not reported as a failure."
          >
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    {columns.map(([key, label]) => (
                      <th className="numeric" key={key}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.series
                    .slice()
                    .reverse()
                    .slice(offset, offset + 7)
                    .map((row) => (
                      <tr key={row.date}>
                        <td>{row.date}</td>
                        {columns.map(([key]) => (
                          <td className="numeric" key={key}>
                            {number(row[key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="table-pagination">
              <span>
                {offset + 1}-{Math.min(offset + 7, data.series.length)} of{" "}
                {data.series.length} days / CSV includes all days
              </span>
              <div>
                <Button
                  variant="secondary"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - 7))}
                >
                  Newer
                </Button>
                <Button
                  variant="secondary"
                  disabled={offset + 7 >= data.series.length}
                  onClick={() => setOffset(offset + 7)}
                >
                  Older
                </Button>
              </div>
            </div>
          </Section>
          <p className="footnote">
            Usage is retained for 90 days. Successful work can be counted even
            if the requesting client disconnects afterward. These reports do not
            meter customer-hosted OCR.
          </p>
        </>
      )}
    </>
  );
}
