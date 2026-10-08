"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  BoundedRateStore,
} = require("../backend/infrastructure/rate-limit-store");
const { ExtractionService } = require("../services/ocr-demo/service");
const {
  AppError: NativeError,
} = require("../packages/ocr/backend/shared/errors");
const { AppError } = require("../backend/shared/errors");
const { readConfig } = require("../backend/config/env");
const { LicenseClient } = require("../packages/ocr/src/license");
const { generateKeyPairSync, sign, randomUUID } = require("node:crypto");
test("demo rejects missing or foreign origins before authorization; correct origin still requires authentication", async () => {
  const { createDemoApp } = require("../services/ocr-demo/server");
  let checks = 0;
  const demo = createDemoApp({
    config: {
      trustProxy: false,
      consoleOrigin: "https://store.sandbee.in",
      cacheEntries: 2,
      cacheMaxBytes: 1024,
      cacheTtlMs: 1000,
    },
    worker: { ready: true },
    control: {
      authenticate: (_req, _res, next) => {
        checks++;
        next(new AppError(401, "TOKEN_REQUIRED", "Missing request token."));
      },
      complete: async () => {},
    },
  });
  const server = demo.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/demo/extract`;
  try {
    for (const origin of [
      null,
      "https://other.example",
      "https://store.sandbee.in.evil.example",
    ]) {
      const response = await fetch(url, {
        method: "POST",
        headers: origin ? { Origin: origin } : {},
      });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).error.code, "ORIGIN_DENIED");
    }
    assert.equal(checks, 0);
    const response = await fetch(url, {
      method: "POST",
      headers: { Origin: "https://store.sandbee.in" },
    });
    assert.equal(response.status, 401);
    assert.equal(checks, 1);
  } finally {
    demo.locals.rateStore.shutdown();
    demo.locals.extraction.clear();
    await new Promise((resolve) => server.close(resolve));
  }
});
test("service errors preserve account quotas and map portal network failures to retryable responses", async () => {
  const express = require("express");
  const { finishApp } = require("../services/shared/http");
  const app = express();
  app.get("/quota", () => {
    throw Object.assign(
      new AppError(429, "RATE_LIMITED", "Account limit reached."),
      { retryAfter: 12 },
    );
  });
  app.get("/portal", () => {
    throw Object.assign(new Error("socket reset"), { code: "ECONNRESET" });
  });
  finishApp(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const quota = await fetch(base + "/quota");
    assert.equal(quota.status, 429);
    assert.equal(quota.headers.get("retry-after"), "12");
    assert.equal((await quota.json()).error.code, "RATE_LIMITED");
    const portal = await fetch(base + "/portal");
    assert.equal(portal.status, 503);
    assert.equal((await portal.json()).error.code, "GST_UNAVAILABLE");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test("background renewal detects revoke before an otherwise valid cached lease expires", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const pair = generateKeyPairSync("ed25519"),
    installationId = randomUUID(),
    issuer = "https://license.example";
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "EdDSA", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({
      iss: issuer,
      aud: "@sandbee/ocr",
      scope: "ocr:local",
      sub: "account",
      tokenId: "token",
      platform: "win32-x64",
      installationId,
      iat: now,
      exp: now + 60,
    }),
  ).toString("base64url");
  const lease =
    header +
    "." +
    body +
    "." +
    sign(null, Buffer.from(header + "." + body), pair.privateKey).toString(
      "base64url",
    );
  let revoked = false,
    calls = 0;
  const original = global.fetch;
  global.fetch = async () => {
    calls++;
    return new Response(JSON.stringify(revoked ? {} : { lease }), {
      status: revoked ? 403 : 200,
    });
  };
  const client = new LicenseClient({
    issuer,
    installationId,
    platform: "win32-x64",
    token: "sb_all_" + "a".repeat(43),
    label: "test",
    publicKey: pair.publicKey.export({ type: "spki", format: "pem" }),
  });
  try {
    await client.start();
    assert.equal(calls, 1);
    revoked = true;
    t.mock.timers.tick(45000);
    await new Promise((r) => setImmediate(r));
    assert.equal(calls, 2);
    await assert.rejects(client.ensure(), (e) => e.code === "LICENSE_DENIED");
    assert.equal(client.lease, null);
  } finally {
    client.close();
    global.fetch = original;
    t.mock.timers.reset();
  }
});
test("full rate store rejects new identities without evicting live abuse counters", async () => {
  const store = new BoundedRateStore(2);
  store.init({ windowMs: 60000 });
  try {
    await store.increment("a");
    await store.increment("b");
    await assert.rejects(
      store.increment("c"),
      (e) => e.code === "SERVICE_BUSY",
    );
    assert.equal((await store.increment("a")).totalHits, 2);
  } finally {
    store.shutdown();
  }
});
test("packaged worker failure maps to a retryable demo response and is not cached", async () => {
  let attempts = 0;
  const service = new ExtractionService({
    worker: {
      run: async () => {
        attempts++;
        throw new NativeError(503, "ENGINE_UNAVAILABLE", "child details");
      },
    },
    config: {
      secret: "test",
      cacheTtlMs: 300000,
      cacheEntries: 5,
      cacheMaxBytes: 1024 * 1024,
    },
  });
  const job = {
    documentType: "PAN",
    mode: "balanced",
    includeText: false,
    files: [],
  };
  try {
    for (let n = 0; n < 2; n++)
      await assert.rejects(
        service.extract("account", job),
        (e) =>
          e instanceof AppError &&
          e.status === 503 &&
          !e.message.includes("child details"),
      );
    assert.equal(attempts, 2);
    assert.equal(service.pending.size, 0);
  } finally {
    service.clear();
  }
});
test("legacy connector cannot be pointed at the central identity database by accident", () => {
  assert.throws(
    () =>
      readConfig({
        MONGODB_URI: "mongodb://localhost",
        SESSION_SECRET: "x".repeat(40),
        LEGACY_GST_DB: "sandbee_platform",
      }),
    /separate/,
  );
});
