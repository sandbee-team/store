"use strict";
function readConfig(env = process.env) {
  const integer = (name, fallback, min, max) => {
    const value = Number(env[name] ?? fallback);
    if (!Number.isInteger(value) || value < min || value > max)
      throw new Error(`${name} must be an integer between ${min} and ${max}.`);
    return value;
  };
  const production = env.NODE_ENV === "production";
  const appUrl = env.APP_URL || "http://localhost:8094";
  const url = new URL(appUrl);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "APP_URL must be an HTTP(S) origin without credentials, path, query or fragment.",
    );
  if (production && url.protocol !== "https:")
    throw new Error("Production APP_URL must use HTTPS.");
  if (!env.MONGODB_URI)
    throw new Error(
      "MONGODB_URI is required. Copy .env.example and configure MongoDB.",
    );
  if (
    !env.SESSION_SECRET ||
    env.SESSION_SECRET.length < 32 ||
    /replace-with|change-me|your-secret/i.test(env.SESSION_SECRET)
  )
    throw new Error(
      "SESSION_SECRET must contain at least 32 random characters.",
    );
  const port = Number(env.PORT || 8094);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT.");
  const gmailUser = env.GMAIL_USER?.trim() || "";
  const gmailPassword = env.GMAIL_APP_PASSWORD?.replace(/\s/g, "") || "";
  if (Boolean(gmailUser) !== Boolean(gmailPassword))
    throw new Error("Set both GMAIL_USER and GMAIL_APP_PASSWORD.");
  if (production && !gmailUser)
    throw new Error("Production Gmail SMTP credentials are required.");
  const dbName = env.MONGODB_DB || "sandbee_platform";
  const legacyDatabases = {
    gst: env.LEGACY_GST_DB || "",
    ocr: env.LEGACY_OCR_DB || "",
  };
  for (const name of Object.values(legacyDatabases)) {
    if (name && (!/^[A-Za-z0-9_-]{1,64}$/.test(name) || name === dbName))
      throw new Error(
        "Legacy databases must have safe, distinct names, separate from the platform database.",
      );
  }
  function serviceUrl(value, fallback) {
    const parsed = new URL(value || fallback);
    if (
      !["https:", "http:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      (production && parsed.protocol !== "https:")
    )
      throw new Error(
        "Service addresses must be HTTP(S) origins; production requires HTTPS.",
      );
    return parsed.origin;
  }
  const services = {
    gst: {
      url: serviceUrl(env.GST_SERVICE_URL, "http://localhost:8095"),
      publicUrl: serviceUrl(
        env.GST_PUBLIC_URL,
        production ? "https://gstapi.sandbee.in" : "http://localhost:8095",
      ),
      secret: env.GST_SERVICE_SECRET || "",
    },
    demo: {
      publicUrl: serviceUrl(
        env.OCR_DEMO_PUBLIC_URL,
        production ? url.origin : "http://localhost:8096",
      ),
      secret: env.OCR_DEMO_SERVICE_SECRET || "",
    },
    license: {
      publicUrl: serviceUrl(
        env.OCR_LICENSE_URL,
        production ? "https://ocrapi.sandbee.in" : "http://localhost:8097",
      ),
      secret: env.OCR_LICENSE_SERVICE_SECRET || "",
    },
  };
  if (
    production &&
    Object.values(services).some(
      (service) =>
        service.secret.length < 32 ||
        /replace-with|change-me|your-secret/i.test(service.secret),
    )
  )
    throw new Error(
      "Set distinct random service secrets of at least 32 characters.",
    );
  const serviceSecrets = Object.values(services)
    .map((s) => s.secret)
    .filter(Boolean);
  if (new Set(serviceSecrets).size !== serviceSecrets.length)
    throw new Error("Services must use distinct credentials.");
  return {
    production,
    appUrl: url.origin,
    port,
    host: env.HOST || "127.0.0.1",
    mongoUri: env.MONGODB_URI,
    dbName,
    services,
    legacy: {
      uri: env.LEGACY_MONGODB_URI || env.MONGODB_URI,
      databases: legacyDatabases,
    },
    secret: env.SESSION_SECRET,
    trustProxy: env.TRUST_PROXY === "1" ? 1 : false,
    cookieName: production
      ? "__Host-sandbee_apps_session"
      : "sandbee_apps_session",
    sessionMs: 7 * 24 * 60 * 60 * 1000,
    authLimit: integer("AUTH_RATE_LIMIT", 15, 1, 1000),

    licenseKeyFile: env.LICENSE_KEY_FILE || ".local/license-private.pem",
    licenseSeconds: 60,
    licenseIssuer: services.license.publicUrl,
    ocrNpmPublished: env.OCR_NPM_PUBLISHED === "true",
    mail: {
      host: gmailUser ? "smtp.gmail.com" : env.SMTP_HOST || "",
      port: gmailUser ? 465 : Number(env.SMTP_PORT || 1025),
      user: gmailUser,
      password: gmailPassword,
      from: env.MAIL_FROM || gmailUser || "no-reply@sandbee.local",
    },
  };
}
module.exports = { readConfig };
