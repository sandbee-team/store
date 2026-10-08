import { useState, useId, cloneElement } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
export function Button({
  children,
  busy,
  variant = "primary",
  className = "",
  ...props
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`button ${variant} ${className}`}
    >
      {busy && <LoaderCircle className="spin" size={16} />}
      {children}
    </button>
  );
}
export function Field({ label, hint, children }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, {
        id,
        ...(hint ? { "aria-describedby": `${id}-hint` } : {}),
      })}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function ErrorNotice({ error }) {
  return error ? (
    <div className="notice error" role="alert">
      <AlertCircle size={18} />
      <span>{error.message || error}</span>
    </div>
  ) : null;
}
export function Pill({ children, tone = "green" }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}
export function PageTitle({ title, children, action, compact = false }) {
  return (
    <div className={compact ? "section-heading embedded-title" : "page-title"}>
      <div>
        {compact ? <h2>{title}</h2> : <h1>{title}</h1>}
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  );
}
export function CopyButton({ value, label = "Copy" }) {
  const [status, setStatus] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("Copied");
    } catch {
      setStatus("Select and copy manually");
    }
  }
  return (
    <button type="button" className="copy-button" onClick={copy}>
      {status === "Copied" ? <Check size={14} /> : <Copy size={14} />}
      {status || label}
    </button>
  );
}
export function Code({ children, language = "Node.js" }) {
  return (
    <div className="code">
      <div>
        <span>{language}</span>
        <CopyButton value={children} />
      </div>
      <pre>
        <code>{children}</code>
      </pre>
    </div>
  );
}
export function Empty({ icon: Icon = ArrowUpRight, title, children }) {
  return (
    <div className="empty">
      <Icon size={26} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export { date } from "../lib/format";
export { Modal } from "./ui/Modal";
export { Skeleton } from "./ui/Skeleton";
export { Section } from "./ui/Section";
