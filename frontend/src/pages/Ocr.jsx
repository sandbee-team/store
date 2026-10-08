import { Select } from "../components/ui/Select";
import { useEffect, useRef, useState } from "react";
import {
  ScanLine,
  Upload,
  FileText,
  ShieldCheck,
  ArrowUpRight,
  Box,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import {
  Button,
  Field,
  ErrorNotice,
  PageTitle,
  Pill,
  Code,
} from "../components/ui";
const documents = [
  ["PAN", "PAN card"],
  ["AADHAAR", "Aadhaar card"],
  ["VOTER_ID", "Voter ID"],
  ["DRIVING_LICENSE", "Driving license"],
  ["RATION_CARD", "Ration card"],
  ["PASSPORT", "Passport"],
];
export default function Ocr({ data, reload, navigate }) {
  const [files, setFiles] = useState([]),
    [type, setType] = useState("PAN"),
    [mode, setMode] = useState("balanced"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState(null),
    [tab, setTab] = useState("fields"),
    [preview, setPreview] = useState("");
  const fileInput = useRef();
  useEffect(() => {
    if (!files[0]?.type.startsWith("image/")) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(files[0]);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [files]);
  function select(incoming) {
    const next = [...incoming];
    setError("");
    setResult(null);
    if (next.length > 2 || next.some((f) => f.size > 10 * 1024 * 1024)) {
      setError("Choose up to two files, at most 10 MB each.");
      return;
    }
    setFiles(next);
  }
  async function sample() {
    setError("");
    try {
      const response = await fetch("/sample-pan.png");
      if (!response.ok) throw Error("Sample is unavailable.");
      select([
        new File([await response.blob()], "sample-pan.png", {
          type: "image/png",
        }),
      ]);
      setType("PAN");
    } catch (e) {
      setError(e);
    }
  }
  async function submit(event) {
    event.preventDefault();
    if (!files.length) return setError("Choose a document first.");
    setError("");
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData(event.currentTarget);
      form.set("documentType", type);
      form.set("mode", mode);
      files.forEach((file) => form.append("files", file));
      const ticket = await api("/api/apps/ocr/demo-ticket", {
        method: "POST",
        body: {},
      });
      const upload = await fetch(ticket.uploadUrl, {
        method: "POST",
        credentials: "omit",
        signal: AbortSignal.timeout(65000),
        headers: { Authorization: "Bearer " + ticket.ticket },
        body: form,
      });
      const response = await upload.json();
      if (!upload.ok)
        throw new Error(
          response.error?.message ||
            "Document extraction failed. Please retry.",
        );
      setResult(response.data);
      await reload();
    } catch (e) {
      setError(
        e.name === "TimeoutError"
          ? "The demo took too long. Please try again shortly."
          : e,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="DOCUMENT INTELLIGENCE / STUDIO"
        title="Document studio"
        action={
          <Button variant="secondary" onClick={() => navigate("/docs")}>
            <Box size={16} />
            Install package
          </Button>
        }
      >
        Try an extraction here. Run it on your own infrastructure when you’re
        ready.
      </PageTitle>
      <div className="info-strip purple">
        <ShieldCheck size={20} />
        <p>
          <strong>This is a hosted demo.</strong> Files are uploaded for this
          test, then deleted. Results may remain in memory for up to 5 minutes.
          The installed package processes documents locally.
        </p>
      </div>
      <div className="studio-grid">
        <section className="panel studio-input">
          <div className="section-heading">
            <h2>
              01 <span>Document input</span>
            </h2>
            <Pill tone="neutral">Demo</Pill>
          </div>
          <form onSubmit={submit}>
            <Field label="Document type">
              <Select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setResult(null);
                }}
              >
                {documents.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <div
              className={`dropzone ${files.length ? "has-files" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!busy) select(e.dataTransfer.files);
              }}
            >
              {preview ? (
                <img src={preview} alt="Selected document preview" />
              ) : (
                <Upload size={30} />
              )}
              <strong>
                {files.length
                  ? `${files.length} document${files.length === 1 ? "" : "s"} selected`
                  : "Upload a document"}
              </strong>
              <p>
                JPEG, PNG, WebP, TIFF or PDF
                <br />
                Up to 2 files · 10 MB each · First 3 PDF pages
              </p>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => fileInput.current.click()}
              >
                {files.length ? "Change files" : "Choose files"}
              </Button>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.tif,.tiff,.pdf"
                hidden
                onChange={(e) => select(e.target.files)}
              />
            </div>
            {files.map((f, i) => (
              <div className="file-row" key={`${f.name}-${i}`}>
                <FileText size={17} />
                <span>
                  {f.name}
                  <small>{(f.size / 1024).toFixed(0)} KB</small>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  className="icon-button"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => {
                    setFiles(files.filter((_, j) => i !== j));
                    setResult(null);
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={busy}
              className="text-link sample-link"
              onClick={sample}
            >
              No document handy? Try the sample <ArrowUpRight size={14} />
            </button>
            <Field label="Extraction mode">
              <Select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="balanced">Balanced · faster processing</option>
                <option value="accurate">
                  Enhanced · additional image recovery
                </option>
              </Select>
            </Field>
            <Field label="PDF password (optional)">
              <input
                type="password"
                name="pdfPassword"
                maxLength={128}
                autoComplete="off"
                placeholder="Only for encrypted PDFs"
              />
            </Field>
            <Button
              busy={busy}
              disabled={!data.workspace.permissions.includes("use")}
              type="submit"
              className="full"
            >
              <ScanLine size={18} />
              {busy ? "Reading your document…" : "Extract document"}
            </Button>
            <ErrorNotice error={error} />
            {!data.workspace.permissions.includes("use") && (
              <p className="footnote">
                Your Viewer role cannot run demo extractions.
              </p>
            )}
          </form>
        </section>
        <section className="panel studio-output">
          <div className="section-heading">
            <h2>
              02 <span>Structured result</span>
            </h2>
            {result && (
              <Pill tone={result.status === "ready" ? "green" : "amber"}>
                {result.status === "ready" ? "Extracted" : "Review needed"}
              </Pill>
            )}
          </div>
          {!result ? (
            <div className={`studio-empty ${busy ? "processing" : ""}`}>
              <div className="document-outline">
                <ScanLine size={34} />
                <i />
                <i />
                <i />
                <div className="scan-beam" />
              </div>
              <h3>
                {busy
                  ? "Finding the important details"
                  : "Ready for your document"}
              </h3>
              <p>
                {busy
                  ? "Checking the document and organizing its fields. Please keep this page open."
                  : "Names, identifiers and key fields, organized in one readable view."}
              </p>
              <div className="empty-tags">
                <span>Structured fields</span>
                <span>Review flags</span>
                <span>JSON export</span>
              </div>
            </div>
          ) : (
            <>
              <div className="tabs">
                <button
                  className={tab === "fields" ? "active" : ""}
                  onClick={() => setTab("fields")}
                >
                  Extracted fields
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
                <div className="extraction-fields">
                  {Object.entries(result.fields).map(([key, field]) => (
                    <div key={key}>
                      <div>
                        <small>
                          {key.replaceAll("_", " ").replace(/([A-Z])/g, " $1")}
                        </small>
                        <strong>{field.value || "Not found"}</strong>
                      </div>
                      <Pill
                        tone={field.status === "extracted" ? "green" : "amber"}
                      >
                        {field.status.replaceAll("_", " ")}
                      </Pill>
                    </div>
                  ))}
                </div>
              )}
              <div className="notice">
                <ShieldCheck size={18} />
                <span>
                  Review important fields before using them. OCR confidence is
                  not a probability, and this does not verify document
                  authenticity.
                </span>
              </div>
              <div className="result-meta">
                {result.meta.processingMs} ms engine time ·{" "}
                {result.meta.filesProcessed} file(s) · Cache:{" "}
                {result.meta.cache}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
