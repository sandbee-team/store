import { CheckCircle2, AlertCircle, Clock3, Zap } from "lucide-react";
import { Section } from "./ui";
import { number } from "../lib/format";
export default function ReportInsights({ data, service }) {
  const { totals, series } = data;
  const peak = series.reduce(
    (best, day) => (day.success > (best?.success || 0) ? day : best),
    null,
  );
  const outcomes = [
    {
      label: "Successful",
      value: totals.success,
      icon: CheckCircle2,
      className: "success",
    },
    {
      label: "Failed",
      value: totals.failed,
      icon: AlertCircle,
      className: "failed",
    },
    {
      label: "Unconfirmed",
      value: totals.pending,
      icon: Clock3,
      className: "pending",
    },
  ];
  const total = outcomes.reduce((sum, item) => sum + item.value, 0);
  return (
    <Section
      title="Request outcomes"
      description="Every authorized request, including work awaiting confirmation."
    >
      <div
        className="outcome-bar"
        role="img"
        aria-label={
          total
            ? outcomes
                .map(
                  (item) => `${number(item.value)} ${item.label.toLowerCase()}`,
                )
                .join(", ")
            : "No requests yet"
        }
      >
        {outcomes
          .filter((item) => item.value)
          .map((item) => (
            <span
              key={item.label}
              className={item.className}
              style={{ width: `${(item.value / total) * 100}%` }}
            />
          ))}
      </div>
      <dl className="outcome-list">
        {outcomes.map((item) => (
          <div key={item.label}>
            <dt>
              <item.icon size={15} />
              {item.label}
            </dt>
            <dd>
              {number(item.value)}
              <small>
                {total
                  ? `${Math.round((item.value / total) * 100)}%`
                  : "No data"}
              </small>
            </dd>
          </div>
        ))}
      </dl>
      <div className="report-highlight">
        <Zap size={17} />
        <div>
          <strong>
            {peak
              ? `Peak daily volume: ${number(peak.success)}`
              : "Your activity starts here"}
          </strong>
          <p>
            {peak
              ? `${peak.date} / UTC`
              : "Use an enabled app to see real activity."}
          </p>
        </div>
      </div>
      {service !== "ocr" && (
        <p className="footnote">
          {number(totals.cached)} GST responses served from saved records.
        </p>
      )}
    </Section>
  );
}
