let csrf = "";
let workspaceId = "";
export function setWorkspace(value) {
  workspaceId = value || "";
}
export function setCsrf(value) {
  csrf = value || "";
}
export async function api(path, { method = "GET", body, signal } = {}) {
  const form = body instanceof FormData;
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(75000)])
      : AbortSignal.timeout(75000),
    headers: {
      ...(body && !form ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" ? { "X-CSRF-Token": csrf } : {}),
      ...(workspaceId && path !== "/api/platform"
        ? { "X-Workspace-Id": workspaceId }
        : {}),
    },
    ...(body ? { body: form ? body : JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      data.error?.message ||
        "Unable to complete the request. Please try again.",
    );
    error.status = response.status;
    error.code = data.error?.code;
    if (error.code === "UNAUTHENTICATED" && path !== "/api/auth/me")
      window.dispatchEvent(new Event("sandbee:session-expired"));
    throw error;
  }
  if (data.csrfToken) setCsrf(data.csrfToken);
  return data;
}
