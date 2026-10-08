"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { randomUUID, generateKeyPairSync, sign } = require("node:crypto");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { readConfig } = require("../backend/config/env");
const { connectDatabase } = require("../backend/infrastructure/database");
const { createApp } = require("../backend/app");
const { createGstApp } = require("../services/gst/app");
const { createLicenseApp } = require("../services/ocr-license/server");
let licenseServer, licenseApp, licenseBase;
let gstServer, gstApp, gstBase, gstDb;
const { createSigner } = require("../backend/modules/platform/license");
const { verifyLease } = require("../packages/ocr/src/license");
const { SandbeeOCR } = require("../packages/ocr");
const { hashPassword } = require("../backend/modules/auth/security");
let mongod,
  client,
  db,
  server,
  app,
  config,
  signer,
  base,
  directory,
  user,
  other,
  token,
  gstToken;
const mail = new Map();
let calls = 0;
async function request(
  route,
  { method = "GET", body, account, bearer, origin = true, workspaceId } = {},
) {
  const headers = {
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...(origin ? { Origin: base } : {}),
    ...(account
      ? { Cookie: account.cookie, "X-CSRF-Token": account.csrf }
      : {}),
    ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    ...(workspaceId ? { "X-Workspace-Id": workspaceId } : {}),
  };
  const response = await fetch(
    (route.startsWith("/api/v1/gstin/")
      ? gstBase
      : route === "/api/v1/ocr/license"
        ? licenseBase
        : base) + route,
    {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  const data = await response.json();
  return { status: response.status, data, response };
}
async function register(email, { onboard = true } = {}) {
  const signup = await request("/api/auth/signup", {
    method: "POST",
    body: { name: "Test Builder", email, password: "Long-test-password-123" },
  });
  assert.equal(signup.status, 200);
  const account = {
    email,
    cookie: signup.response.headers.get("set-cookie").split(";")[0],
    csrf: signup.data.csrfToken,
    id: signup.data.user.id,
  };
  assert.equal(
    (
      await request("/api/auth/verification/confirm", {
        method: "POST",
        account,
        body: { code: mail.get(email).code },
      })
    ).status,
    200,
  );
  if (!onboard) return account;
  assert.equal(
    (
      await request("/api/onboarding", {
        method: "POST",
        account,
        body: { company: "Test workspace", useCase: "development" },
      })
    ).status,
    200,
  );
  for (const id of ["gst", "ocr"])
    assert.equal(
      (
        await request(`/api/apps/${id}/activation`, {
          method: "PUT",
          account,
          body: { enabled: true },
        })
      ).status,
      200,
    );
  return account;
}
before(async () => {
  mongod = await MongoMemoryServer.create();
  directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "sandbee-platform-test-"),
  );
  const key = generateKeyPairSync("ed25519").privateKey.export({
    type: "pkcs8",
    format: "pem",
  });
  await fs.writeFile(path.join(directory, "key.pem"), key);
  config = readConfig({
    APP_URL: "http://127.0.0.1:8095",
    SESSION_SECRET: "test-secret-".repeat(6),
    MONGODB_URI: mongod.getUri(),
    LICENSE_KEY_FILE: path.join(directory, "key.pem"),
  });
  config.authLimit = 1000;
  config.services.gst.secret = "g".repeat(48);
  config.services.demo.secret = "d".repeat(48);
  config.services.license.secret = "l".repeat(48);
  ({ client, db } = await connectDatabase(config));
  signer = createSigner(config);
  const legacyPassword = await hashPassword("Legacy-passphrase-2026");
  app = createApp({
    db,
    config,
    signer,
    legacy: {
      configured: ["gst"],
      find: async (service, email) =>
        email === "first@example.test"
          ? {
              passwordHash: legacyPassword,
              emailVerifiedAt: new Date(),
              sourceKey: "test-legacy-gst-id",
              usage: { total: 123, cached: 100, live: 23 },
            }
          : null,
    },
    mailer: {
      send: async (payload) => mail.set(payload.to, payload),
      invite: async (payload) => mail.set(`invite:${payload.to}`, payload),
    },
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  config.appUrl = base;
  licenseApp = createLicenseApp({
    config: {
      url: base,
      secret: config.services.license.secret,
      trustProxy: false,
    },
  });
  licenseServer = licenseApp.listen(0, "127.0.0.1");
  await new Promise((r) => licenseServer.once("listening", r));
  licenseBase = `http://127.0.0.1:${licenseServer.address().port}`;
  config.licenseIssuer = licenseBase;
  gstDb = client.db("gst_service_test");
  await gstDb
    .collection("gst_records")
    .createIndex({ gstin: 1 }, { unique: true });
  gstApp = createGstApp({
    db: gstDb,
    config: {
      url: base,
      service: "gst",
      secret: config.services.gst.secret,
      trustProxy: false,
    },
    liveLookup: async (gstin) => {
      calls++;
      await new Promise((r) => setTimeout(r, 30));
      return {
        status: "success",
        details: { gstin, legalName: "Test business" },
      };
    },
  });
  gstServer = gstApp.listen(0, "127.0.0.1");
  await new Promise((r) => gstServer.once("listening", r));
  gstBase = "http://127.0.0.1:" + gstServer.address().port;
  config.services.gst.url = gstBase;
  config.services.gst.publicUrl = gstBase;
  user = await register("first@example.test");
  other = await register("second@example.test");
});
after(async () => {
  if (licenseServer) await new Promise((r) => licenseServer.close(r));
  licenseApp?.locals.rateStore.shutdown();
  if (server) await new Promise((r) => server.close(r));
  app?.locals.rateStores.forEach((s) => s.shutdown());
  if (gstServer) await new Promise((r) => gstServer.close(r));
  gstApp?.locals.rateStore.shutdown();
  await client?.close();
  await mongod?.stop();
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});
test("central session reaches both product catalogues, never exposes credential hashes", async () => {
  const result = await request("/api/platform", { account: user });
  assert.equal(result.status, 200);
  assert.deepEqual(
    result.data.apps.map((a) => a.id),
    ["gst", "ocr"],
  );
  assert.equal(
    (await request("/api/apps/ocr/catalog", { account: user })).status,
    200,
  );
  assert.equal(JSON.stringify(result.data).includes("passwordHash"), false);
  assert.equal((await request("/api/platform")).status, 401);
});
test("mutations reject missing Origin, CSRF and unverified accounts", async () => {
  const body = { name: "OCR production", scope: "ocr:local" };
  assert.equal(
    (
      await request("/api/tokens", {
        method: "POST",
        body,
        account: user,
        origin: false,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/tokens", {
        method: "POST",
        body,
        account: { ...user, csrf: "bad" },
      })
    ).status,
    403,
  );
  const signup = await request("/api/auth/signup", {
    method: "POST",
    body: {
      name: "Unverified",
      email: "unverified@example.test",
      password: "Long-test-password-123",
    },
  });
  const unverified = {
    cookie: signup.response.headers.get("set-cookie").split(";")[0],
    csrf: signup.data.csrfToken,
  };
  assert.equal(
    (
      await request("/api/tokens", {
        method: "POST",
        body,
        account: unverified,
      })
    ).status,
    403,
  );
});
test("scoped tokens are shown once and cannot be used across products", async () => {
  const response = await request("/api/tokens", {
    method: "POST",
    account: user,
    body: { name: "Local OCR", scope: "ocr:local" },
  });
  assert.equal(response.status, 201);
  token = response.data.token;
  const gst = await request("/api/tokens", {
    method: "POST",
    account: user,
    body: { name: "GST server", scope: "gst:read" },
  });
  gstToken = gst.data.token;
  assert.equal(
    (await request("/api/v1/gstin/09AAFPC6958E1ZN", { bearer: token })).status,
    403,
  );
  assert.equal(
    (
      await request("/api/v1/ocr/license", {
        method: "POST",
        bearer: gstToken,
        body: {},
      })
    ).status,
    403,
  );
  const overview = await request("/api/platform", { account: user });
  assert.equal(JSON.stringify(overview.data).includes(token), false);
  assert.equal(JSON.stringify(overview.data).includes('"hash"'), false);
  assert.equal(
    (await request("/api/platform", { account: other })).data.tokens.length,
    0,
  );
});
test("concurrent token creation cannot overwrite another key or exceed the active-key cap", async () => {
  for (let n = 0; n < 9; n++) {
    const result = await request("/api/tokens", {
      method: "POST",
      account: other,
      body: { name: `Worker ${n}`, scope: "gst:read" },
    });
    assert.equal(result.status, 201);
  }
  const results = await Promise.all(
    Array.from({ length: 5 }, (_, n) =>
      request("/api/tokens", {
        method: "POST",
        account: other,
        body: { name: `Concurrent ${n}`, scope: "ocr:local" },
      }),
    ),
  );
  assert.equal(results.filter((result) => result.status === 201).length, 1);
  assert.ok(
    results
      .filter((result) => result.status !== 201)
      .every((result) => result.status === 409),
  );
  const state = await request("/api/platform", { account: other });
  assert.equal(state.data.tokens.filter((t) => t.active).length, 10);
  assert.equal(new Set(state.data.tokens.map((t) => t.id)).size, 10);
});
test("GST coalesces live work; LRU eviction still finds DB; counters belong only to caller", async () => {
  const results = await Promise.all(
    [1, 2, 3].map(() =>
      request("/api/v1/gstin/09AAFPC6958E1ZN", { bearer: gstToken }),
    ),
  );
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(calls, 1);
  gstApp.locals.gst.cache.clear();
  const cached = await request("/api/v1/gstin/09AAFPC6958E1ZN", {
    bearer: gstToken,
  });
  assert.equal(cached.data.meta.source, "database");
  assert.equal(calls, 1);
  assert.equal(
    (await request("/api/platform", { account: user })).data.usage.gst,
    4,
  );
  assert.equal(
    (await request("/api/platform", { account: other })).data.usage.gst,
    0,
  );
  assert.equal(
    (await request("/api/v1/gstin/NOTVALID", { bearer: gstToken })).status,
    400,
  );
  assert.equal(await gstDb.collection("gst_records").countDocuments(), 1);
});
test("license claims verify; tampering, audience, issuer, installation and expiry fail", async () => {
  const installationId = randomUUID();
  const response = await request("/api/v1/ocr/license", {
    method: "POST",
    bearer: token,
    body: { installationId, label: "Test worker", platform: "win32-x64" },
  });
  assert.equal(response.status, 200);
  const options = {
    publicKey: signer.publicKey,
    issuer: licenseBase,
    installationId,
    platform: "win32-x64",
  };
  const claims = verifyLease(response.data.lease, options);
  assert.equal(claims.aud, "@sandbee/ocr");
  assert.equal(claims.sub, user.id);
  assert.throws(() =>
    verifyLease(response.data.lease, {
      ...options,
      installationId: randomUUID(),
    }),
  );
  assert.throws(() =>
    verifyLease(response.data.lease, {
      ...options,
      issuer: "https://attacker.example",
    }),
  );
  assert.throws(() =>
    verifyLease(response.data.lease, {
      ...options,
      now: (claims.exp + 1) * 1000,
    }),
  );
  const [h, p, s] = response.data.lease.split(".");
  const changed = Buffer.from(
    JSON.stringify({ ...claims, aud: "other" }),
  ).toString("base64url");
  assert.throws(() => verifyLease(`${h}.${changed}.${s}`, options));
  const overview = await request("/api/platform", { account: user });
  const record = overview.data.tokens.find((t) => t.scope === "ocr:local");
  const denied = await request(
    `/api/tokens/${record.id}/installations/${installationId}`,
    { method: "DELETE", account: other },
  );
  assert.equal(denied.status, 404);
  assert.equal(
    (
      await request(
        `/api/tokens/${record.id}/installations/${installationId}`,
        { method: "DELETE", account: user },
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/api/v1/ocr/license", {
        method: "POST",
        bearer: token,
        body: { installationId, label: "Test worker", platform: "win32-x64" },
      })
    ).status,
    403,
  );
});
test("concurrent installation registrations cannot exceed five slots", async () => {
  const results = await Promise.all(
    Array.from({ length: 9 }, () =>
      request("/api/v1/ocr/license", {
        method: "POST",
        bearer: token,
        body: {
          installationId: randomUUID(),
          label: "Parallel worker",
          platform: "win32-x64",
        },
      }),
    ),
  );
  assert.equal(results.filter((r) => r.status === 200).length, 4); // one tombstone from prior test
  const overview = await request("/api/platform", { account: user });
  assert.equal(
    overview.data.tokens.find((t) => t.scope === "ocr:local").installations
      .length,
    5,
  );
});
test("token revocation blocks renewal and does not affect the other service", async () => {
  const overview = await request("/api/platform", { account: user }),
    record = overview.data.tokens.find((t) => t.scope === "ocr:local");
  assert.equal(
    (
      await request(`/api/tokens/${record.id}`, {
        method: "DELETE",
        account: other,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(`/api/tokens/${record.id}`, {
        method: "DELETE",
        account: user,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/api/v1/ocr/license", {
        method: "POST",
        bearer: token,
        body: {
          installationId: randomUUID(),
          label: "Denied",
          platform: "win32-x64",
        },
      })
    ).status,
    401,
  );
  assert.equal(
    (await request("/api/v1/gstin/09AAFPC6958E1ZN", { bearer: gstToken }))
      .status,
    200,
  );
});
test("package local native extraction sends only license metadata, preserves caller file", async () => {
  const fresh = await request("/api/tokens", {
    method: "POST",
    account: user,
    body: { name: "Native test", scope: "ocr:local" },
  });
  const ocr = new SandbeeOCR({
    token: fresh.data.token,
    installationId: randomUUID(),
    label: "Local test",
    issuer: licenseBase,
    publicKey: signer.publicKey,
    allowLocalDevelopment: true,
  });
  const original = global.fetch;
  const captured = [];
  global.fetch = async (url, options) => {
    captured.push({ url, body: options?.body });
    return original(url, options);
  };
  const input = path.resolve("frontend/public/sample-pan.png");
  try {
    const result = await ocr.extract({ documentType: "PAN", files: [input] });
    assert.equal(result.meta.documentsUploaded, false);
    assert.equal(result.meta.execution, "customer_server");
    assert.equal(result.fields.panNumber.value, "ABCPS1234D");
    assert.equal(result.documentAuthenticity, "not_verified");
    assert.equal(captured.length, 1);
    assert.equal(captured[0].url, `${licenseBase}/api/v1/ocr/license`);
    assert.deepEqual(Object.keys(JSON.parse(captured[0].body)).sort(), [
      "installationId",
      "label",
      "platform",
    ]);
    assert.ok((await fs.stat(input)).isFile());
    await assert.rejects(
      ocr.extract({
        documentType: "PAN",
        files: ["https://example.com/image.png"],
      }),
      /absolute local file/,
    );
  } finally {
    global.fetch = original;
    ocr.close();
  }
});
test("legacy linking requires ownership, is idempotent and keeps historical counts separate", async () => {
  const body = { service: "gst", password: "Legacy-passphrase-2026" };
  assert.equal(
    (
      await request("/api/migration/link", {
        method: "POST",
        account: other,
        body,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/api/migration/link", {
        method: "POST",
        account: user,
        body: { ...body, password: "wrong" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/api/migration/link", {
        method: "POST",
        account: user,
        body,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/api/migration/link", {
        method: "POST",
        account: user,
        body,
      })
    ).status,
    409,
  );
  const result = await request("/api/migration/status", { account: user });
  assert.equal(result.data.links.gst.historicalUsage.total, 123);
  assert.equal(
    (await request("/api/platform", { account: user })).data.usage.gst,
    5,
  );
  assert.deepEqual(
    (await request("/api/migration/status", { account: other })).data.links,
    {},
  );
});
test("global keys follow app enablement; workers cannot use another service grant or fake usage", async () => {
  const account = await register("global@example.test");
  for (const id of ["gst", "ocr"])
    await request(`/api/apps/${id}/activation`, {
      method: "PUT",
      account,
      body: { enabled: false },
    });
  assert.equal(
    (
      await request("/api/tokens", {
        method: "POST",
        account,
        body: { name: "Global client", scope: "global" },
      })
    ).status,
    403,
  );
  await request("/api/apps/gst/activation", {
    method: "PUT",
    account,
    body: { enabled: true },
  });
  const key = await request("/api/tokens", {
    method: "POST",
    account,
    body: { name: "Global client", scope: "global" },
  });
  assert.equal(key.status, 201);
  assert.match(key.data.token, /^sb_all_/);
  assert.equal(
    (await request("/api/v1/gstin/09AAFPC6958E1ZN", { bearer: key.data.token }))
      .status,
    200,
  );
  const body = {
    installationId: randomUUID(),
    label: "Global installation",
    platform: "win32-x64",
  };
  assert.equal(
    (
      await request("/api/v1/ocr/license", {
        method: "POST",
        bearer: key.data.token,
        body,
      })
    ).status,
    403,
  );
  await request("/api/apps/ocr/activation", {
    method: "PUT",
    account,
    body: { enabled: true },
  });
  assert.equal(
    (
      await request("/api/v1/ocr/license", {
        method: "POST",
        bearer: key.data.token,
        body,
      })
    ).status,
    200,
  );
  const ticket = (
    await request("/api/apps/ocr/demo-ticket", {
      method: "POST",
      account,
      body: {},
    })
  ).data.ticket;
  async function internal(
    service,
    route,
    payload,
    secret = config.services[service === "gst" ? "gst" : "demo"].secret,
  ) {
    const response = await fetch(base + route, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "X-Sandbee-Service": service,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return { status: response.status, data: await response.json() };
  }
  assert.equal(
    (await internal("gst", "/internal/v1/authorize", { token: ticket })).status,
    401,
  );
  assert.equal(
    (
      await internal(
        "gst",
        "/internal/v1/authorize",
        { token: key.data.token },
        key.data.token,
      )
    ).status,
    401,
  );
  const grant = await internal("ocr-demo", "/internal/v1/authorize", {
    token: ticket,
  });
  assert.equal(grant.status, 200);
  assert.equal(
    (await internal("ocr-demo", "/internal/v1/authorize", { token: ticket }))
      .status,
    401,
  );
  assert.equal(
    (
      await internal("gst", "/internal/v1/complete", {
        requestId: grant.data.requestId,
        outcome: "success",
        source: "database",
      })
    ).status,
    404,
  );
  for (let n = 0; n < 2; n++)
    assert.equal(
      (
        await internal("ocr-demo", "/internal/v1/complete", {
          requestId: grant.data.requestId,
          outcome: "success",
          source: "demo",
        })
      ).status,
      200,
    );
  assert.equal(
    (await request("/api/platform", { account })).data.usage.ocrDemo,
    1,
  );
  await request("/api/apps/gst/activation", {
    method: "PUT",
    account,
    body: { enabled: false },
  });
  assert.equal(
    (await request("/api/v1/gstin/09AAFPC6958E1ZN", { bearer: key.data.token }))
      .status,
    403,
  );
});
test("workspace invitations enforce verified email, role permissions, key ownership and removal", async () => {
  const owner = await register("team-owner@example.test");
  const developer = await register("team-developer@example.test");
  const outsider = await register("team-outsider@example.test");
  const ownerKey = await request("/api/tokens", {
    method: "POST",
    account: owner,
    body: { name: "Owner key", scope: "global" },
  });
  assert.equal(ownerKey.status, 201);
  const invite = await request("/api/workspace/invitations", {
    method: "POST",
    account: owner,
    body: { email: developer.email, role: "developer" },
  });
  assert.equal(invite.status, 201);
  assert.equal(invite.data.delivery, "sent");
  assert.equal(mail.get(`invite:${developer.email}`).role, "developer");
  const pending = await request("/api/invitations", { account: developer });
  const id = pending.data.invitations[0].id;
  assert.equal(
    (
      await request(`/api/invitations/${id}/accept`, {
        method: "POST",
        account: outsider,
        body: {},
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(`/api/invitations/${id}/accept`, {
        method: "POST",
        account: developer,
        body: {},
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/api/invitations/${id}/accept`, {
        method: "POST",
        account: developer,
        body: {},
      })
    ).status,
    404,
  );
  const platform = await request("/api/platform", { account: developer });
  assert.equal(platform.data.workspace.id, owner.id);
  assert.equal(platform.data.workspace.role, "developer");
  assert.equal(
    platform.data.tokens.length,
    0,
    "other creators' token metadata stays hidden from developer",
  );
  assert.equal(
    (
      await request(`/api/tokens/${ownerKey.data.metadata.id}`, {
        method: "DELETE",
        account: developer,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/apps/gst/activation", {
        method: "PUT",
        account: developer,
        body: { enabled: false },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/workspace/invitations", {
        method: "POST",
        account: developer,
        body: { email: outsider.email, role: "admin" },
      })
    ).status,
    403,
  );
  const ownKey = await request("/api/tokens", {
    method: "POST",
    account: developer,
    body: { name: "Developer key", scope: "gst:read" },
  });
  assert.equal(ownKey.status, 201);
  assert.equal(
    (
      await request("/api/v1/gstin/09AAFPC6958E1ZN", {
        bearer: ownKey.data.token,
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/reports/usage?days=7", { account: developer })).data
      .totals.gst,
    1,
  );
  assert.equal(
    (await request("/api/reports/usage?days=7", { account: outsider })).data
      .totals.gst,
    0,
  );
  assert.equal(
    (
      await request(`/api/workspace/members/${developer.id}`, {
        method: "PATCH",
        account: owner,
        body: { role: "viewer" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/api/v1/gstin/09AAFPC6958E1ZN", {
        bearer: ownKey.data.token,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/api/tokens", {
        method: "POST",
        account: developer,
        body: { name: "Viewer forbidden", scope: "global" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/apps/ocr/demo-ticket", {
        method: "POST",
        account: developer,
        body: {},
      })
    ).status,
    403,
  );
  assert.equal(
    (await request("/api/reports/usage?days=7", { account: developer })).status,
    200,
  );
  assert.equal(
    (
      await request(`/api/workspace/members/${owner.id}`, {
        method: "DELETE",
        account: owner,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`/api/workspace/members/${developer.id}`, {
        method: "DELETE",
        account: owner,
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/platform", { account: developer })).status,
    403,
  );
  assert.equal(
    (
      await request("/api/workspaces/select", {
        method: "POST",
        account: developer,
        body: { id: owner.id },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/workspaces/select", {
        method: "POST",
        account: developer,
        body: { id: developer.id },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/platform", { account: developer })).data.workspace.id,
    developer.id,
  );
  assert.equal(
    (await request("/api/reports/usage?days=7", { account: developer })).data
      .totals.gst,
    0,
  );
});

test("MongoDB quotas are atomic across independent limiter instances", async () => {
  const {
    MongoRateLimit,
  } = require("../backend/infrastructure/mongo-rate-limit");
  const limiters = Array.from({ length: 3 }, () => new MongoRateLimit(db));
  const outcomes = await Promise.allSettled(
    Array.from({ length: 30 }, (_, n) =>
      limiters[n % 3].consume("quota-test", "shared-service", 7, 86400000),
    ),
  );
  assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 7);
  assert.ok(
    outcomes
      .filter((r) => r.status === "rejected")
      .every((r) => r.reason.status === 429 && r.reason.retryAfter > 0),
  );
});
test("public developer guides are rendered without login, have metadata, and unknown guides return 404", async () => {
  const response = await fetch(base + "/developers/ocr"),
    text = await response.text();
  assert.equal(response.status, 200);
  assert.match(text, /<h1>Local document OCR/);
  assert.match(text, /rel="canonical"/);
  assert.match(text, /name="description"/);
  assert.match(text, /await ocr.start/);
  assert.equal((await fetch(base + "/developers/not-a-guide")).status, 404);
  assert.match(
    await (await fetch(base + "/sitemap.xml")).text(),
    /developers\/gst/,
  );
  assert.equal(
    (await fetch(base + "/account")).headers.get("x-robots-tag"),
    "noindex, nofollow",
  );
});
test("OTP reset is one-use and invalidates central session and all product keys", async () => {
  await request("/api/auth/forgot-password", {
    method: "POST",
    body: { email: user.email },
  });
  await Promise.all(app.locals.otp.deliveries);
  const code = mail.get(user.email).code;
  const verified = await request("/api/auth/reset/verify", {
    method: "POST",
    body: { email: user.email, code },
  });
  assert.equal(verified.status, 200);
  assert.equal(
    (
      await request("/api/auth/reset/verify", {
        method: "POST",
        body: { email: user.email, code },
      })
    ).status,
    400,
  );
  const body = {
    email: user.email,
    resetToken: verified.data.resetToken,
    password: "An-even-longer-new-password",
  };
  assert.equal(
    (await request("/api/auth/reset-password", { method: "POST", body }))
      .status,
    200,
  );
  assert.equal(
    (await request("/api/auth/reset-password", { method: "POST", body }))
      .status,
    400,
  );
  assert.equal((await request("/api/platform", { account: user })).status, 401);
  assert.equal(
    (await request("/api/v1/gstin/09AAFPC6958E1ZN", { bearer: gstToken }))
      .status,
    401,
  );
  assert.equal(
    (await request("/api/platform", { account: other })).status,
    200,
  );
});
test("unknown extraction API is absent; production requires HTTPS and private configuration", async () => {
  assert.equal(
    (
      await request("/api/v1/extract", {
        method: "POST",
        body: {},
        account: other,
      })
    ).status,
    404,
  );
  assert.throws(
    () => readConfig({ NODE_ENV: "production", APP_URL: "http://example.com" }),
    /HTTPS/,
  );
  assert.throws(
    () =>
      new SandbeeOCR({
        token: "sb_ocr_" + "a".repeat(43),
        installationId: randomUUID(),
        label: "test",
        issuer: "http://evil.example",
        publicKey: signer.publicKey,
        allowLocalDevelopment: true,
      }),
    /HTTPS/,
  );
});

test("new employees join without creating a workspace; admin access and held grants track role changes", async () => {
  const owner = await register("invite-owner@example.test");
  const employee = await register("invite-new@example.test", {
    onboard: false,
  });
  assert.equal(
    (
      await request("/api/workspace/invitations", {
        method: "POST",
        account: owner,
        body: { email: employee.email, role: "admin" },
      })
    ).status,
    201,
  );
  const invite = (await request("/api/invitations", { account: employee })).data
    .invitations[0];
  assert.equal(
    (
      await request(`/api/invitations/${invite.id}/accept`, {
        method: "POST",
        account: employee,
        body: {},
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/auth/me", { account: employee })).data.user.onboarded,
    true,
  );
  const panel = (await request("/api/platform", { account: employee })).data;
  assert.equal(panel.workspace.id, owner.id);
  assert.equal(panel.workspace.role, "admin");
  assert.equal(
    (
      await request("/api/tokens", {
        method: "POST",
        account: employee,
        workspaceId: employee.id,
        body: { name: "Wrong tab", scope: "global" },
      })
    ).status,
    409,
  );
  const key = await request("/api/tokens", {
    method: "POST",
    account: owner,
    body: { name: "Admin managed", scope: "global" },
  });
  assert.equal(
    (
      await request(`/api/tokens/${key.data.metadata.id}`, {
        method: "DELETE",
        account: employee,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/api/workspace", {
        method: "PATCH",
        account: employee,
        body: { name: "Shared operations" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/api/workspace/members/${owner.id}`, {
        method: "DELETE",
        account: employee,
      })
    ).status,
    403,
  );
  const ticket = await request("/api/apps/ocr/demo-ticket", {
    method: "POST",
    account: employee,
    body: {},
  });
  assert.equal(ticket.status, 200);
  assert.equal(
    (
      await request(`/api/workspace/members/${employee.id}`, {
        method: "PATCH",
        account: owner,
        body: { role: "viewer" },
      })
    ).status,
    200,
  );
  const rejected = await fetch(base + "/internal/v1/authorize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sandbee-Service": "ocr-demo",
      Authorization: `Bearer ${config.services.demo.secret}`,
    },
    body: JSON.stringify({ token: ticket.data.ticket }),
  });
  assert.equal(rejected.status, 403);
  assert.equal(
    (
      await request("/api/workspace", {
        method: "PATCH",
        account: employee,
        body: { name: "Denied" },
      })
    ).status,
    403,
  );
});

test("expired and cancelled invitations cannot be accepted", async () => {
  const owner = await register("expiry-owner@example.test");
  const employee = await register("expiry-employee@example.test", {
    onboard: false,
  });
  await request("/api/workspace/invitations", {
    method: "POST",
    account: owner,
    body: { email: employee.email, role: "developer" },
  });
  const invite = (await request("/api/invitations", { account: employee })).data
    .invitations[0];
  await db
    .collection("workspaces")
    .updateOne(
      { "invitations.id": invite.id },
      { $set: { "invitations.$.expiresAt": new Date(Date.now() - 1000) } },
    );
  assert.equal(
    (
      await request(`/api/invitations/${invite.id}/accept`, {
        method: "POST",
        account: employee,
        body: {},
      })
    ).status,
    404,
  );
  assert.equal(
    (await request("/api/invitations", { account: employee })).data.invitations
      .length,
    0,
  );
  assert.equal(
    (
      await request(`/api/workspace/invitations/${invite.id}`, {
        method: "DELETE",
        account: owner,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/api/invitations/${invite.id}/accept`, {
        method: "POST",
        account: employee,
        body: {},
      })
    ).status,
    404,
  );
});

test("service reports filter only the selected service and reject unknown filters", async () => {
  const owner = await register("reports-filter@example.test");
  const { ObjectId } = require("mongodb");
  const accountId = new ObjectId(owner.id),
    now = new Date();
  await db.collection("usage_events").insertMany([
    {
      _id: randomUUID(),
      accountId,
      service: "gst",
      state: "success",
      source: "database",
      createdAt: now,
      expiresAt: new Date(+now + 86400000),
    },
    {
      _id: randomUUID(),
      accountId,
      service: "ocr-demo",
      state: "success",
      source: "demo",
      createdAt: now,
      expiresAt: new Date(+now + 86400000),
    },
  ]);
  const gst = (
    await request("/api/reports/usage?days=7&service=gst", { account: owner })
  ).data;
  assert.equal(gst.totals.success, 1);
  assert.equal(gst.totals.gst, 1);
  assert.equal(gst.totals.demo, 0);
  assert.equal(gst.totals.cached, 1);
  const ocr = (
    await request("/api/reports/usage?days=7&service=ocr-demo", {
      account: owner,
    })
  ).data;
  assert.equal(ocr.totals.success, 1);
  assert.equal(ocr.totals.gst, 0);
  assert.equal(ocr.totals.demo, 1);
  assert.equal(
    (await request("/api/reports/usage?service=other", { account: owner }))
      .status,
    400,
  );
});

test("billing follows workspace activation, requires a session and never invents charges", async () => {
  const owner = await register(`billing-${Date.now()}@example.test`);
  assert.equal((await request("/api/billing")).status, 401);
  const initial = await request("/api/billing", { account: owner });
  assert.equal(initial.status, 200);
  assert.equal(initial.data.amountDueMinor, 0);
  assert.equal(initial.data.paymentRequired, false);
  assert.equal(initial.data.subscriptions.length, 2);
  assert.deepEqual(initial.data.invoices, []);
  await request("/api/apps/gst/activation", {
    account: owner,
    method: "PUT",
    body: { enabled: false },
  });
  const updated = await request("/api/billing", { account: owner });
  assert.deepEqual(
    updated.data.subscriptions.map((item) => item.appId),
    ["ocr"],
  );
  assert.equal(updated.data.monthlyTotalMinor, 0);
  const foreign = await request("/api/billing", {
    account: owner,
    workspaceId: String(user.id),
  });
  assert.equal(foreign.status, 409);
});

test("Store license authority rejects direct callers and old public license endpoint is absent", async () => {
  for (const headers of [
    {},
    { Authorization: "Bearer " + token },
    { "X-Sandbee-Service-Key": "wrong", Authorization: "Bearer " + token },
  ]) {
    const r = await fetch(base + "/internal/v1/ocr/license", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        installationId: randomUUID(),
        label: "Direct",
        platform: "linux-x64",
      }),
    });
    assert.equal(r.status, 401);
  }
  const old = await fetch(base + "/api/v1/ocr/license", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(old.status, 404);
});
