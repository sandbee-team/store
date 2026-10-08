import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import { api } from "../lib/api";
import { Button, Field, ErrorNotice, Pill, date } from "./ui";
export default function LegacyAccounts() {
  const [status, setStatus] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const reload = () => api("/api/migration/status").then(setStatus);
  useEffect(() => {
    reload().catch(setError);
  }, []);
  async function link(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError("");
    try {
      await api("/api/migration/link", { method: "POST", body });
      form.reset();
      await reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (status && !status.available.length && !Object.keys(status.links).length)
    return null;
  return (
    <section className="panel legacy-panel">
      <div className="section-heading">
        <h2>Connect an existing Sandbee account</h2>
        <Link2 size={20} />
      </div>
      <p>
        Already use gstapi.sandbee.in or ocr.sandbee.in? Prove ownership of a
        verified account with the same email. Historical usage is saved as a
        separate snapshot; existing API keys and sessions stay on the old
        service.
      </p>
      <ErrorNotice error={error} />
      {status && (
        <div className="bottom-grid">
          {["gst", "ocr"].map((service) => (
            <div className="legacy-card" key={service}>
              <h3>{service === "gst" ? "GSTIN" : "Document OCR"}</h3>
              {status.links[service] ? (
                <>
                  <Pill>Account linked</Pill>
                  <p>
                    Snapshot captured {date(status.links[service].linkedAt)}
                  </p>
                  <strong>
                    {status.links[service].historicalUsage.total || 0}{" "}
                    historical successful requests
                  </strong>
                </>
              ) : status.available.includes(service) ? (
                <form onSubmit={link}>
                  <input
                    name="service"
                    value={service}
                    readOnly
                    type="hidden"
                  />
                  <Field
                    label={`${service === "gst" ? "GSTIN" : "OCR"} account password`}
                    hint="Use your existing service password. It is verified once and never stored here."
                  >
                    <input
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      maxLength={128}
                    />
                  </Field>
                  <Button busy={busy} variant="secondary" type="submit">
                    Link account
                  </Button>
                </form>
              ) : (
                <>
                  <Pill tone="neutral">Migration connection pending</Pill>
                  <p>
                    Your operator needs to configure read-only access to the
                    legacy database. You can already use both apps here with
                    your new central account.
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="footnote">
        Linking never combines accounts by email alone. New platform
        integrations use newly generated service tokens.
      </p>
    </section>
  );
}
