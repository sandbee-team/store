import { BrandMark } from "../components/Brand";
import { Select } from "../components/ui/Select";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CreditCard,
  LayoutDashboard,
  Grid2X2,
  KeyRound,
  BookOpen,
  Settings2,
  LogOut,
  Menu,
  ChartNoAxesCombined,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  ArrowLeft,
  Fingerprint,
  ScanLine,
} from "lucide-react";
import { useMediaQuery } from "../hooks/useMediaQuery";
const navigation = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/apps", label: "Apps", icon: Grid2X2 },
  { path: "/reports", label: "Reports", icon: ChartNoAxesCombined },
  { path: "/tokens", label: "API keys", icon: KeyRound },
  { path: "/billing", label: "Billing", icon: CreditCard },
  { path: "/docs", label: "Developers", icon: BookOpen },
  { path: "/settings", label: "Settings", icon: Settings2 },
];
function readCollapsed() {
  try {
    return localStorage.getItem("sandbee:nav-collapsed") === "true";
  } catch {
    return false;
  }
}
export default function ConsoleLayout({
  user,
  data,
  workspaces,
  path,
  navigate,
  selectWorkspace,
  switching,
  logout,
  children,
  invitationCount,
}) {
  const [open, setOpen] = useState(false),
    [collapsed, setCollapsed] = useState(readCollapsed);
  const small = useMediaQuery("(max-width: 800px)");
  const drawer = useRef(null),
    opener = useRef(null);
  const app = data?.apps.find(
    (a) => path === a.path || path.startsWith(a.path + "/"),
  );
  const setting =
    path.startsWith("/settings") ||
    ["/members", "/account", "/invitations"].includes(path);
  const active = (item) =>
    item.path === "/"
      ? path === "/"
      : item.path === "/settings"
        ? setting
        : path === item.path || path.startsWith(item.path + "/");
  const current = app?.name || navigation.find(active)?.label || "Store";
  const appLinks = app
    ? [
        {
          path: app.path,
          label: app.id === "gst" ? "GSTIN lookup" : "Document studio",
          icon: app.id === "gst" ? Fingerprint : ScanLine,
        },
        { path: app.path + "/keys", label: "App API keys", icon: KeyRound },
        {
          path: app.path + "/usage",
          label: "Usage",
          icon: ChartNoAxesCombined,
        },
        { path: app.path + "/guide", label: "Developer guide", icon: BookOpen },
      ]
    : [];
  useEffect(() => {
    if (!small) setOpen(false);
  }, [small]);
  useLayoutEffect(() => {
    if (!small || !open) return;
    const previous = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Chromium can retain the closed drawer's computed visibility briefly
    // after inert is removed. Focus when it is actually focusable, rather
    // than assuming a fixed number of frames is enough.
    let focusFrame, attempts = 0;
    const focusDrawer = () => {
      const element = drawer.current?.querySelector(".store-brand");
      if (!element || drawer.current.contains(document.activeElement)) return;
      if (getComputedStyle(element).visibility === "visible")
        element.focus({ preventScroll: true });
      if (!drawer.current.contains(document.activeElement) && ++attempts < 30)
        focusFrame = requestAnimationFrame(focusDrawer);
    };
    focusFrame = requestAnimationFrame(focusDrawer);
    const key = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key === "Tab") {
        const nodes = [
          ...drawer.current.querySelectorAll(
            "a[href],button:not(:disabled),select:not(:disabled)",
          ),
        ].filter((el) => el.getClientRects().length);
        const first = nodes[0],
          last = nodes.at(-1);
        if (!drawer.current.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      if (opener.current?.isConnected) opener.current.focus();
      else if (previous?.isConnected) previous.focus();
    };
  }, [small, open]);
  function go(next) {
    setOpen(false);
    navigate(next);
  }
  function link(event, next) {
    if (
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      event.button === 0
    ) {
      event.preventDefault();
      go(next);
    }
  }
  function toggle() {
    setCollapsed((value) => {
      try {
        localStorage.setItem("sandbee:nav-collapsed", String(!value));
      } catch {}
      return !value;
    });
  }
  return (
    <div
      className={`store-shell ${collapsed ? "rail-small" : ""} ${app ? "has-app-rail" : ""}`}
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {small && open && (
        <button
          className="store-overlay"
          aria-label="Close navigation backdrop"
          tabIndex={-1}
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        ref={drawer}
        className={`store-rail ${open ? "open" : ""}`}
        inert={small && !open}
        role={small && open ? "dialog" : undefined}
        aria-modal={small && open ? true : undefined}
        aria-label="Store navigation"
      >
        <div className="store-brand-row">
          <a
            href="/"
            className="store-brand"
            onClick={(e) => link(e, "/")}
            aria-label="Sandbee Store dashboard"
          >
            <BrandMark />
            <span>
              sandbee <b>store</b>
            </span>
          </a>
          {small && (
            <button
              className="icon-button"
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
            >
              <X size={17} />
            </button>
          )}
        </div>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <a
              key={item.path}
              href={item.path}
              className={active(item) ? "active" : ""}
              aria-current={active(item) ? "page" : undefined}
              aria-label={item.label}
              onClick={(e) => link(e, item.path)}
            >
              <item.icon size={18} />
              <span className="rail-label">{item.label}</span>
              {collapsed && !small && (
                <span className="rail-tooltip" role="tooltip">
                  {item.label}
                </span>
              )}
              {item.path === "/settings" && invitationCount > 0 && (
                <span
                  className="rail-dot"
                  aria-label={`${invitationCount} invitations`}
                />
              )}
            </a>
          ))}
        </nav>
        {small && app && (
          <nav
            className="mobile-app-links"
            aria-label={`${app.name} navigation`}
          >
            <strong>{app.name}</strong>
            {appLinks.map((item) => (
              <a
                key={item.path}
                href={item.path}
                onClick={(e) => link(e, item.path)}
                aria-current={path === item.path ? "page" : undefined}
              >
                <item.icon size={16} />
                {item.label}
              </a>
            ))}
          </nav>
        )}
        <div className="rail-end">
          <a
            href="/developers"
            className="rail-help"
            aria-label="Public documentation"
          >
            <BookOpen size={17} />
            <span className="rail-label">Documentation</span>
            {collapsed && !small && (
              <span className="rail-tooltip">Documentation</span>
            )}
          </a>
          {!small && (
            <button
              className="rail-toggle"
              onClick={toggle}
              aria-label={collapsed ? "Expand sidebar" : "Minimize sidebar"}
              title={collapsed ? "Expand sidebar" : "Minimize sidebar"}
              aria-expanded={!collapsed}
            >
              {collapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
              <span className="rail-label">Minimize sidebar</span>
            </button>
          )}
        </div>
      </aside>
      {app && !small && (
        <aside className="app-rail" aria-label={`${app.name} menu`}>
          <a
            href="/apps"
            className="app-back"
            onClick={(e) => link(e, "/apps")}
          >
            <ArrowLeft size={14} /> All apps
          </a>
          <div className="app-rail-title">
            {app.id === "gst" ? (
              <Fingerprint size={23} />
            ) : (
              <ScanLine size={23} />
            )}
            <strong>{app.name}</strong>
            <small>{app.enabled ? "Enabled" : "Not enabled"}</small>
          </div>
          <nav aria-label={`${app.name} navigation`}>
            {appLinks.map((item) => (
              <a
                key={item.path}
                href={item.path}
                className={path === item.path ? "active" : ""}
                aria-current={path === item.path ? "page" : undefined}
                onClick={(e) => link(e, item.path)}
              >
                <item.icon size={16} />
                {item.label}
              </a>
            ))}
          </nav>
          <p className="app-rail-note">{app.mode}</p>
        </aside>
      )}
      <div className="store-main" inert={small && open}>
        <header className="store-topbar">
          <div className="store-context">
            {small && (
              <button
                ref={opener}
                className="icon-button"
                aria-label="Open navigation"
                aria-expanded={open}
                onClick={() => setOpen(true)}
              >
                <Menu size={18} />
              </button>
            )}
            <label className="sr-only" htmlFor="workspace-picker">
              Workspace
            </label>
            <Select
              id="workspace-picker"
              value={data?.workspace.id || ""}
              disabled={switching}
              onChange={(e) => selectWorkspace(e.target.value)}
            >
              {!data && (
                <option value="" disabled>
                  Select workspace
                </option>
              )}
              {workspaces.map((w) => (
                <option value={w.id} key={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
            <span className="context-divider">/</span>
            <strong>{current}</strong>
          </div>
          <div className="store-account">
            <span className="role-label capitalize">
              {data?.workspace.role}
            </span>
            <button
              className="avatar"
              aria-label="Account settings"
              title={user.email}
              onClick={() => go("/settings/profile")}
            >
              {user.name.slice(0, 1)}
            </button>
            <button
              className="icon-button"
              aria-label="Sign out"
              title="Sign out"
              onClick={logout}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        {app && small && (
          <nav className="app-mobile-tabs" aria-label="App pages">
            {appLinks.map((item) => (
              <a
                key={item.path}
                href={item.path}
                aria-current={path === item.path ? "page" : undefined}
                onClick={(e) => link(e, item.path)}
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
        <main id="main" className="content">
          {children}
        </main>
      </div>
    </div>
  );
}
