import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Box,
  Terminal,
  ShieldCheck,
  Globe,
  FileCode2,
} from "lucide-react";
import { PageTitle, Button, Code, Pill, CopyButton } from "../components/ui";
export default function Docs({ data, navigate, initial = "ocr", app }) {
  const [section, setSection] = useState(initial);
  const code = `const { SandbeeOCR } = require('@sandbee/ocr');\nconst fs = require('node:fs');\nconst path = require('node:path');\n\nconst ocr = new SandbeeOCR({\n  token: process.env.SANDBEE_OCR_TOKEN,\n  installationId: process.env.SANDBEE_INSTALLATION_ID,\n  label: 'Production document service',\n  issuer: '${data.license.issuer}',\n  publicKey: fs.readFileSync('./sandbee-public.pem', 'utf8'),${data.license.issuer.startsWith("http:") ? "\n  allowLocalDevelopment: true," : ""}\n});\n\nasync function main() {\n  try {\n    await ocr.start();\n    const result = await ocr.extract({\n      documentType: 'PAN',\n      files: [path.resolve('./pan-card.png')],\n      mode: 'balanced',\n    });\n    // Review result.status and field flags before using data.\n    console.log(result.fields);\n  } finally {\n    ocr.close();\n  }\n}\nmain().catch(console.error);`;
  function downloadKey() {
    const url = URL.createObjectURL(
      new Blob([data.license.publicKey], { type: "text/plain" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "sandbee-public.pem";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <PageTitle
        action={
          <a className="button secondary" href="/developers">
            Public developer guides ↗
          </a>
        }
        eyebrow="DEVELOPER CENTER"
        title="Developer guides"
      >
        Install, authenticate, build. Everything you need in one place.
      </PageTitle>
      <div className={app ? "docs-layout app-guide" : "docs-layout"}>
        <aside className="docs-nav">
          <span className="eyebrow">BUILD WITH SANDBEE</span>
          {[
            ["ocr", Box, "OCR quickstart"],
            ["gst", Globe, "GST API"],
            ["security", ShieldCheck, "Security & limits"],
            ["errors", Terminal, "Troubleshooting"],
          ]
            .filter(
              ([id]) =>
                !app || id === app || id === "security" || id === "errors",
            )
            .map(([id, Icon, title]) => (
              <button
                key={id}
                className={section === id ? "active" : ""}
                onClick={() => setSection(id)}
              >
                <Icon size={17} />
                {title}
              </button>
            ))}
          <div className="docs-help">
            <FileCode2 size={22} />
            <strong>Need to try it first?</strong>
            <p>Explore a document in the hosted studio before integrating.</p>
            <button className="text-link" onClick={() => navigate("/apps/ocr")}>
              Open demo <ArrowRight size={14} />
            </button>
          </div>
        </aside>
        <article className="docs-content">
          {section === "ocr" && (
            <>
              <Pill>Node.js 22+ · v0.1.0</Pill>
              <h2>Local OCR quickstart</h2>
              <p className="lead">
                Documents stay on your Node.js server. The package sends only an
                installation ID, environment label and platform to Sandbee for
                license verification.
              </p>
              <div className="flow-row">
                <div>
                  <Box />
                  <strong>Your Node.js app</strong>
                  <small>Document stays here</small>
                </div>
                <ArrowRight />
                <div>
                  <ShieldCheck />
                  <strong>Sandbee license</strong>
                  <small>Metadata only</small>
                </div>
                <ArrowRight />
                <div>
                  <FileCode2 />
                  <strong>Structured result</strong>
                  <small>Returned locally</small>
                </div>
              </div>
              <section className="doc-step">
                <span>01</span>
                <div>
                  <h3>Install the Node.js package</h3>
                  <p>
                    {data.package.publishedToNpm
                      ? "Install from npm on your backend server. Your Store key verifies access through ocrapi.sandbee.in."
                      : "The npm release is being prepared. Use the verified package download below until it is published."}
                  </p>
                  {data.apps.find((app) => app.id === "ocr")?.enabled ? (
                    <a
                      className="button secondary"
                      href={data.package.download}
                    >
                      <ArrowDownToLine size={16} />
                      Download @sandbee/ocr v0.1.0
                    </a>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => navigate("/apps/ocr")}
                    >
                      Enable OCR to download <ArrowRight size={16} />
                    </Button>
                  )}
                  <Code language="Terminal">
                    {data.package.publishedToNpm
                      ? "npm install @sandbee/ocr@0.1.0"
                      : "npm install ./sandbee-ocr-0.1.0.tgz"}
                  </Code>
                  <p>
                    Supported: Windows x64 and Linux x64 with glibc
                    (Debian/Ubuntu). Alpine, ARM/Graviton, macOS and browser
                    runtimes need separate engine builds.
                  </p>
                </div>
              </section>
              <section className="doc-step">
                <span>02</span>
                <div>
                  <h3>Give your environment an identity</h3>
                  <p>
                    Create an OCR app token or global token, store it as{" "}
                    <code>SANDBEE_OCR_TOKEN</code> on your server, and generate
                    a persistent installation ID once. Reuse the same ID on
                    restarts.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => navigate("/tokens")}
                  >
                    Create OCR token <ArrowRight size={15} />
                  </Button>
                  <Code language="Generate once">
                    {
                      "node -e \"console.log(require('node:crypto').randomUUID())\""
                    }
                  </Code>
                  <p>
                    Save that UUID as <code>SANDBEE_INSTALLATION_ID</code>. Do
                    not generate a new identity per request or use a
                    browser-exposed environment variable.
                  </p>
                </div>
              </section>
              <section className="doc-step">
                <span>03</span>
                <div>
                  <h3>Pin your license verification key</h3>
                  <p>
                    Save this public key next to your server configuration. The
                    package uses it to verify signed licenses; it never trusts a
                    key supplied inside the license response.
                  </p>
                  <Button variant="secondary" onClick={downloadKey}>
                    <ArrowDownToLine size={16} />
                    Download sandbee-public.pem
                  </Button>
                  <Code language={`Public key · ${data.license.kid}`}>
                    {data.license.publicKey}
                  </Code>
                </div>
              </section>
              <section className="doc-step">
                <span>04</span>
                <div>
                  <h3>Extract your first document</h3>
                  <Code>{code}</Code>
                  <p>
                    Keep one client per long-running server process; call{" "}
                    <code>close()</code> during shutdown. For a one-off script,
                    close it in <code>finally</code> as shown above. Your
                    original document is never deleted.
                  </p>
                </div>
              </section>
              <div className="notice">
                <ShieldCheck size={19} />
                <span>
                  Only the hosted studio uploads files to Sandbee. There is no
                  hosted OCR extraction API for customer integrations in this
                  platform.
                </span>
              </div>
            </>
          )}
          {section === "gst" && (
            <>
              <Pill>REST API</Pill>
              <h2>
                Business information,
                <br />
                one request away.
              </h2>
              <p className="lead">
                Enable GSTIN and generate a <code>gst:read</code> or global
                token. Make requests from your backend using the Authorization
                header.
              </p>
              <Code language="cURL">{`curl '${data.endpoints.gst}/api/v1/gstin/09AAFPC6958E1ZN' \\\n  --header "Authorization: Bearer $SANDBEE_GST_TOKEN"`}</Code>
              <h3>Response contract</h3>
              <p>
                Successful responses contain <code>success</code>,{" "}
                <code>data</code> and <code>meta</code>. Metadata includes the
                original fetch time, source and request duration. Business
                fields depend on the source portal.
              </p>
              <Code language="Illustrative envelope — not a live result">
                {JSON.stringify(
                  {
                    success: true,
                    data: {
                      gstin: "<queried GSTIN>",
                      legalName: "<portal business name>",
                    },
                    meta: {
                      source: "database",
                      fetchedAt: "<ISO timestamp>",
                      elapsedMs: 0,
                    },
                  },
                  null,
                  2,
                )}
              </Code>
              <h3>Cache behavior</h3>
              <p>
                GSTINs have a unique database index. The bounded local LRU
                stores only presence markers. A cache miss still checks MongoDB
                because an evicted marker is not proof that a record is absent.
                Identical in-flight requests are coalesced.
              </p>
              <h3>Usage and freshness</h3>
              <p>
                Successful calls, including cached responses, increment only the
                requesting workspace's counter. Cached records are first-fetch
                snapshots, not guaranteed current data. Portal failures return
                an error rather than fabricated details.
              </p>
              <Button onClick={() => navigate("/apps/gst")}>
                Try a lookup <ArrowRight size={16} />
              </Button>
            </>
          )}
          {section === "security" && (
            <>
              <Pill>Access & operations</Pill>
              <h2>Know the boundaries.</h2>
              <p className="lead">
                Separate access scopes, bounded work and an explicit revocation
                window.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Control</th>
                    <th>Current behavior</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [
                      "Session",
                      "HTTP-only, host-only cookie; CSRF and exact-origin checks for mutations.",
                    ],
                    [
                      "Access tokens",
                      "App-specific or global across enabled apps; shown once, hash-only storage; 10 active tokens per workspace.",
                    ],
                    [
                      "OCR license",
                      "Ed25519 signed; installation and platform bound; 60-second in-memory lease.",
                    ],
                    [
                      "Revocation",
                      "Startup verification, then background renewal every 45 seconds. Expired 60-second leases block new work; already admitted jobs may finish.",
                    ],
                    [
                      "Installation slots",
                      "Five lifetime slots per token; revoked IDs cannot reactivate. Rotate token for new slots.",
                    ],
                    [
                      "Document limits",
                      "Two files, 10 MB each; first three PDF pages; 25-megapixel image limit.",
                    ],
                    [
                      "Local concurrency",
                      "Two requests admitted per client; one native engine process, bounded queue.",
                    ],
                    [
                      "Rate limits",
                      "GST 60/min/workspace; demo 10/min/workspace; license 120/min/workspace; global API 300/min/IP.",
                    ],
                    [
                      "Passwords",
                      "Scrypt hashing, email OTP, one-use reset, session and token invalidation.",
                    ],
                    [
                      "Deployment",
                      "Separate console, GST and demo services. MongoDB shares workspace quotas; LRU, IP limits and worker queues remain local to each process.",
                    ],
                  ].map(([a, b]) => (
                    <tr key={a}>
                      <td>
                        <strong>{a}</strong>
                      </td>
                      <td>{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3>Customer-hosted software has a trust limit</h3>
              <p>
                A customer controls their own host and can modify distributed
                software. Signed licenses provide access control for the shipped
                client, not unbreakable DRM. Sandbee tracks license checks and
                installations; it does not claim independently verified local
                extraction counts.
              </p>
              <h3>Keep secrets server-side</h3>
              <p>
                Do not expose API tokens in browser bundles, URLs or analytics
                logs. Keep the private signing key only on Sandbee
                infrastructure. Back it up securely: replacing it requires a
                customer public-key rollout.
              </p>
            </>
          )}
          {section === "errors" && (
            <>
              <Pill>Failure handling</Pill>
              <h2>Errors and recovery</h2>
              <p className="lead">
                Handle failures explicitly. Keep retry queues bounded and
                respect Retry-After.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>What to do</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [
                      "INVALID_TOKEN / SCOPE_DENIED",
                      "Check token scope and revocation in Access tokens. Never retry indefinitely.",
                    ],
                    [
                      "LICENSE_DENIED",
                      "Check the token, installation status and slot count.",
                    ],
                    [
                      "LICENSE_UNAVAILABLE",
                      "Restore network access. No new work starts after the cached lease expires.",
                    ],
                    [
                      "LICENSE_INVALID",
                      "Check the pinned public key, issuer and system clock.",
                    ],
                    [
                      "PLATFORM_UNSUPPORTED",
                      "Use Windows x64 or Debian/Ubuntu x64 with glibc.",
                    ],
                    [
                      "SERVICE_BUSY / RATE_LIMITED",
                      "Back off with jitter; reduce concurrency.",
                    ],
                    [
                      "FILE_LIMIT / UNSUPPORTED_FILE",
                      "Use supported formats within the size limits.",
                    ],
                    [
                      "EXTRACTION_FAILED",
                      "Check image quality or PDF password. Ask a human to review.",
                    ],
                    [
                      "INVALID_GSTIN",
                      "Check the complete 15-character value and checksum.",
                    ],
                    [
                      "GST_UNAVAILABLE / CAPTCHA_UNCERTAIN",
                      "Retry later; portal responses and CAPTCHA success are not guaranteed.",
                    ],
                  ].map(([a, b]) => (
                    <tr key={a}>
                      <td>
                        <code>{a}</code>
                      </td>
                      <td>{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3>Do not mistake “extracted” for “verified”</h3>
              <p>
                Review <code>status</code>, field-level flags and conflicts. A
                readable document can still contain false information. Automated
                extraction does not establish authenticity.
              </p>
            </>
          )}
        </article>
      </div>
    </>
  );
}
