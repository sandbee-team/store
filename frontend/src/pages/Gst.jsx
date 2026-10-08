import { useState } from "react";
import {
  Fingerprint,
  Search,
  ArrowUpRight,
  Building2,
  Clock3,
  Database,
} from "lucide-react";
import { api } from "../lib/api";
import {
  Button,
  Field,
  ErrorNotice,
  PageTitle,
  Pill,
  Empty,
  Code,
  date,
} from "../components/ui";
function readable(value) {
  return typeof value === "object"
    ? JSON.stringify(value, null, 2)
    : String(value ?? "Not provided");
}
export default function Gst({ data, reload, navigate }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState(null),
    [tab, setTab] = useState("details");
  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    setResult(null);
    try {
      const value = new FormData(event.currentTarget)
        .get("gstin")
        .trim()
        .toUpperCase();
      const next = await api("/api/apps/gst/lookup", {
        method: "POST",
        body: { gstin: value },
      });
      setResult(next);
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
        eyebrow="BUSINESS DATA / GSTIN"
        title="GSTIN lookup"
        action={<Pill>Hosted API</Pill>}
      >
        Explore business details, then connect the same lookup to your own
        product.
      </PageTitle>
      <div className="workspace-grid">
        <section className="panel input-panel">
          <div className="app-icon mint">
            <Fingerprint size={25} />
          </div>
          <h2>Business lookup</h2>
          <p>
            Enter a valid, 15-character GSTIN. Previous results are served from
            the shared database.
          </p>
          <form onSubmit={submit}>
            <Field
              label="GST identification number"
              hint="Format and checksum are validated before lookup."
            >
              <input
                name="gstin"
                required
                minLength={15}
                maxLength={15}
                pattern="[a-zA-Z0-9]{15}"
                placeholder="09AAFPC6958E1ZN"
                autoComplete="off"
                className="gst-input"
              />
            </Field>
            <Button
              busy={busy}
              disabled={!data.workspace.permissions.includes("use")}
              type="submit"
              className="full"
            >
              <Search size={17} />
              {busy ? "Looking up business…" : "Look up GSTIN"}
            </Button>
          </form>
          {!data.workspace.permissions.includes("use") && (
            <p className="footnote">
              Your role can view reports. Ask an administrator for permission to
              run lookups.
            </p>
          )}
          <ErrorNotice error={error} />
          <div className="hint-card">
            <Database size={18} />
            <div>
              <strong>Built to avoid repeat requests</strong>
              <p>
                Saved lookups return the original details and fetch date. Check
                the timestamp before relying on a saved result. Records show
                when they were first fetched.
              </p>
            </div>
          </div>
          <Button variant="ghost" onClick={() => navigate("/docs/gst")}>
            Integrate the API <ArrowUpRight size={15} />
          </Button>
        </section>
        <section className="panel results-panel">
          <div className="section-heading">
            <h2>Business details</h2>
            {result && (
              <Pill tone="neutral">
                {result.meta.source === "database"
                  ? "Saved record"
                  : "Live lookup"}
              </Pill>
            )}
          </div>
          {!result ? (
            <Empty
              icon={Building2}
              title={busy ? "Connecting the details…" : "No business selected"}
            >
              {busy
                ? "The portal can take a moment. Your result will appear here."
                : "Search a GSTIN to see the registered business information and response data."}
            </Empty>
          ) : (
            <>
              <div className="tabs">
                <button
                  className={tab === "details" ? "active" : ""}
                  onClick={() => setTab("details")}
                >
                  Details
                </button>
                <button
                  className={tab === "json" ? "active" : ""}
                  onClick={() => setTab("json")}
                >
                  JSON response
                </button>
              </div>
              {tab === "json" ? (
                <Code language="JSON">{JSON.stringify(result, null, 2)}</Code>
              ) : (
                <dl className="detail-grid">
                  {Object.entries(result.data).map(([key, value]) => (
                    <div key={key}>
                      <dt>
                        {key.replace(/([A-Z])/g, " $1").replaceAll("_", " ")}
                      </dt>
                      <dd>{readable(value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="result-meta">
                <Clock3 size={14} />
                First fetched {date(result.meta.fetchedAt)} ·{" "}
                {result.meta.elapsedMs} ms
              </div>
              <p className="footnote">
                Saved data may have changed at the source. Extraction is not a
                current legal verification.
              </p>
            </>
          )}
        </section>
      </div>
      <div className="stats-grid compact">
        <div className="stat">
          <div>Your successful lookups</div>
          <strong>{data.usage.gst || 0}</strong>
        </div>
        <div className="stat">
          <div>From the database</div>
          <strong>{data.usage.gstCached || 0}</strong>
        </div>
        <div className="stat">
          <div>Live lookups</div>
          <strong>{data.usage.gstLive || 0}</strong>
        </div>
      </div>
    </>
  );
}
