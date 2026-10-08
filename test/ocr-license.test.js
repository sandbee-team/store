"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { createLicenseApp } = require("../services/ocr-license/server");
const token = "sb_ocr_" + "a".repeat(43);
const input = () => ({
  installationId: randomUUID(),
  label: "Test",
  platform: "linux-x64",
});
async function using(fetchImpl, run) {
  const config = {
    url: "https://store.example.test",
    secret: "s".repeat(48),
    trustProxy: false,
  };
  const app = createLicenseApp({ config, fetchImpl });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(base, config);
  } finally {
    await new Promise((r) => server.close(r));
    app.locals.rateStore.shutdown();
  }
}
function post(base, body, bearer = token) {
  return fetch(base + "/api/v1/ocr/license", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearer}`,
      "X-Sandbee-Service-Key": "untrusted-client-value",
      Cookie: "untrusted-cookie=1",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
test("OCR API has no UI, signup or extraction routes and validates input before authority calls", async () => {
  let calls = 0;
  await using(
    async () => {
      calls++;
      throw Error("unexpected");
    },
    async (base) => {
      for (const path of ["/", "/login", "/signup", "/api/demo/extract"]) {
        const r = await fetch(base + path);
        assert.equal(r.status, 404);
        assert.match(r.headers.get("content-type"), /application\/json/);
      }
      assert.equal((await post(base, input(), "invalid")).status, 401);
      assert.equal(
        (await post(base, input(), "sb_gst_" + "a".repeat(43))).status,
        403,
      );
      assert.equal(
        (await post(base, { ...input(), uploadedDocument: "forbidden" }))
          .status,
        400,
      );
      assert.equal((await post(base, "{")).status, 400);
      assert.equal(
        (await post(base, JSON.stringify({ text: "x".repeat(3000) }))).status,
        413,
      );
      assert.equal(calls, 0);
    },
  );
});
test("OCR API forwards only installation fields and supplies its own service credential", async () => {
  let received;
  await using(
    async (url, options) => {
      received = { url, options };
      return Response.json({ lease: "signed.test.lease", expiresIn: 60 });
    },
    async (base, config) => {
      const body = input(),
        result = await post(base, body);
      assert.equal(result.status, 200);
      assert.match(result.headers.get("cache-control"), /no-store/);
      assert.equal(received.url, config.url + "/internal/v1/ocr/license");
      assert.deepEqual(JSON.parse(received.options.body), body);
      assert.equal(
        received.options.headers["X-Sandbee-Service-Key"],
        config.secret,
      );
      assert.equal(received.options.headers.Authorization, `Bearer ${token}`);
      assert.equal(received.options.headers.Cookie, undefined);
      assert.equal(received.options.redirect, "error");
    },
  );
});
test("OCR API preserves revocation/rate denial and fails closed on corrupt or unreachable authority", async () => {
  for (const [stub, expected] of [
    [
      async () =>
        Response.json(
          { error: { message: "private internal detail" } },
          { status: 403 },
        ),
      403,
    ],
    [
      async () =>
        Response.json({}, { status: 429, headers: { "Retry-After": "23" } }),
      429,
    ],
    [async () => new Response("not-json"), 502],
    [async () => Response.json({ lease: "x", expiresIn: 9999 }), 503],
    [
      async () => {
        throw Error("private network detail");
      },
      503,
    ],
  ])
    await using(stub, async (base) => {
      const result = await post(base, input());
      assert.equal(result.status, expected);
      if (expected === 429)
        assert.equal(result.headers.get("retry-after"), "23");
      assert.equal((await result.text()).includes("private"), false);
    });
});
