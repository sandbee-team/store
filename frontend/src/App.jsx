import Billing from "./pages/Billing";
import { BrandLoader } from "./components/Brand";
import { useEffect, useRef, useState } from "react";
import { api, setCsrf, setWorkspace } from "./lib/api";
import { Button, ErrorNotice, Skeleton } from "./components/ui";
import ConsoleLayout from "./layouts/ConsoleLayout";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Tokens from "./pages/Tokens";
import Gst from "./pages/Gst";
import Ocr from "./pages/Ocr";
import Docs from "./pages/Docs";
import Apps from "./pages/Apps";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import AppAccess from "./components/AppAccess";
export default function App() {
  const loadSequence = useRef(0);
  const [user, setUser] = useState(undefined),
    [data, setData] = useState(null),
    [path, setPath] = useState(location.pathname),
    [error, setError] = useState(null),
    [workspaces, setWorkspaces] = useState([]),
    [invitations, setInvitations] = useState([]),
    [switching, setSwitching] = useState(false);
  function navigate(next) {
    history.pushState(null, "", next);
    setPath(next);
    window.scrollTo(0, 0);
  }
  useEffect(() => {
    const listener = () => setPath(location.pathname);
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);
  useEffect(() => {
    api("/api/auth/me")
      .then((result) => setUser(result.user))
      .catch((e) => {
        if (e.status !== 401) setError(e);
        setUser(null);
      });
  }, []);
  useEffect(() => {
    const expire = () => {
      loadSequence.current++;
      setUser(null);
      setData(null);
      setCsrf("");
      setWorkspace("");
    };
    window.addEventListener("sandbee:session-expired", expire);
    return () => window.removeEventListener("sandbee:session-expired", expire);
  }, []);
  async function reload() {
    const sequence = ++loadSequence.current;
    const [platform, spaces, invites] = await Promise.allSettled([
      api("/api/platform"),
      api("/api/workspaces"),
      api("/api/invitations"),
    ]);
    if (sequence !== loadSequence.current) return;
    if (spaces.status === "fulfilled") setWorkspaces(spaces.value.workspaces);
    if (invites.status === "fulfilled")
      setInvitations(invites.value.invitations);
    if (platform.status === "fulfilled") {
      setWorkspace(platform.value.workspace.id);
      setData(platform.value);
      setError(null);
    } else {
      setData(null);
      setError(platform.reason);
    }
  }
  useEffect(() => {
    loadSequence.current++;
    setWorkspace("");
    setData(null);
    if (user?.emailVerified && user?.onboarded) reload().catch(setError);
  }, [user?.id, user?.onboarded, user?.emailVerified]);
  async function selectWorkspace(id) {
    loadSequence.current++;
    setWorkspace("");
    setSwitching(true);
    setError(null);
    setData(null);
    try {
      await api("/api/workspaces/select", { method: "POST", body: { id } });
      await reload();
      navigate("/");
    } catch (e) {
      setError(e);
    } finally {
      setSwitching(false);
    }
  }
  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST", body: {} });
      loadSequence.current++;
      setUser(null);
      setData(null);
      setCsrf("");
      navigate("/");
    } catch (e) {
      setError(e);
    }
  }
  if (user === undefined)
    return (
      <main className="boot">
        <BrandLoader />
      </main>
    );
  if (!user?.emailVerified || !user?.onboarded)
    return <Auth user={user} onUser={setUser} />;
  const shared = { user, data, reload, navigate, onUser: setUser };
  let page;
  if (data) {
    if (path === "/") page = <Home {...shared} />;
    else if (path === "/billing") page = <Billing {...shared} />;
    else if (path === "/apps") page = <Apps {...shared} />;
    else if (
      path.startsWith("/settings") ||
      ["/members", "/account", "/invitations"].includes(path)
    )
      page = (
        <Settings
          {...shared}
          invitations={invitations}
          tab={
            path.startsWith("/settings")
              ? path.split("/")[2] || "profile"
              : path === "/account"
                ? "profile"
                : path.slice(1)
          }
        />
      );
    else if (/^\/apps\/(gst|ocr)\/usage$/.test(path))
      page = <Reports app={path.split("/")[2]} />;
    else if (/^\/apps\/(gst|ocr)\/guide$/.test(path))
      page = (
        <Docs
          {...shared}
          key={path}
          app={path.split("/")[2]}
          initial={path.split("/")[2]}
        />
      );
    else if (path === "/tokens") page = <Tokens {...shared} />;
    else if (path === "/reports") page = <Reports />;
    else if (path === "/apps/gst") page = <Gst {...shared} />;
    else if (path === "/apps/ocr") page = <Ocr {...shared} />;
    else if (path === "/apps/gst/keys")
      page = <Tokens {...shared} appScope="gst:read" />;
    else if (path === "/apps/ocr/keys")
      page = <Tokens {...shared} appScope="ocr:local" />;
    else if (path === "/docs" || path === "/docs/gst")
      page = (
        <Docs
          {...shared}
          key={path}
          initial={path === "/docs/gst" ? "gst" : "ocr"}
        />
      );
    else
      page = (
        <section className="panel">
          <h1>Page not found</h1>
          <p>Select a page from the workspace navigation.</p>
          <Button onClick={() => navigate("/")}>Open overview</Button>
        </section>
      );
    const activeApp = data.apps.find(
      (app) => path === app.path || path.startsWith(app.path + "/"),
    );
    if (activeApp)
      page = (
        <AppAccess
          key={activeApp.id}
          app={activeApp}
          data={data}
          reload={reload}
          navigate={navigate}
          path={path}
        >
          {page}
        </AppAccess>
      );
  }
  return (
    <ConsoleLayout
      user={user}
      data={data}
      workspaces={workspaces}
      path={path}
      navigate={navigate}
      selectWorkspace={selectWorkspace}
      switching={switching}
      logout={logout}
      invitationCount={invitations.length}
    >
      <ErrorNotice error={error} />
      {data ? (
        <div key={data.workspace.id}>{page}</div>
      ) : error ? (
        <div className="panel">
          <h1>Choose a workspace</h1>
          <p>
            Select an available workspace from the header, or retry if the
            service is temporarily unavailable.
          </p>
          <Button onClick={reload}>Retry</Button>
        </div>
      ) : (
        <BrandLoader label="Loading workspace" compact />
      )}
    </ConsoleLayout>
  );
}
