"use strict";
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const code = (value) => `<pre><code>${escape(value)}</code></pre>`;
const pages = [
  {
    slug: "",
    label: "Start here",
    title: "Build with Sandbee",
    description:
      "Integrate the Sandbee GSTIN API and local Node.js document OCR. Explore app activation, API keys, code examples and service limits.",
    body: () =>
      `<h1>Build with Sandbee</h1><p class="lead">Business data and document intelligence, connected by one Sandbee account. Enable the services you need and start building.</p><div class="cards"><a href="/developers/gst"><h2>GSTIN</h2><p>Business details, one GST number away. Call the dedicated API from your backend.</p><strong>Explore the GST API →</strong></a><a href="/developers/ocr"><h2>Document OCR</h2><p>Extract document fields on your own server. Your documents stay with you.</p><strong>Explore local OCR →</strong></a></div><h2>Integration steps</h2><ol><li><strong>Create your account.</strong> Verify your email and finish workspace setup.</li><li><strong>Enable your apps.</strong> Disabled apps reject app keys and global keys.</li><li><strong>Create the right key.</strong> Choose app-specific or global access.</li><li><strong>Integrate on your backend.</strong> Keep credentials out of frontend code.</li></ol>`,
  },
  {
    slug: "gst",
    label: "GSTIN API",
    title: "GSTIN API integration guide",
    description:
      "Use the Sandbee GSTIN REST API with scoped or global API keys. Learn the request format, cache behavior, response metadata and limits.",
    body: (c) =>
      `<h1>GSTIN API</h1><p class="lead">Enable GSTIN, create a GST key or global key, and call the dedicated service from your server.</p><h2>Make a request</h2>${code(`curl '${c.services.gst.publicUrl}/api/v1/gstin/09AAFPC6958E1ZN' --header "Authorization: Bearer $SANDBEE_API_KEY"`)}<h2>Response contract</h2>${code(JSON.stringify({ success: true, data: { gstin: "<queried GSTIN>", legalName: "<business name>" }, meta: { source: "database", fetchedAt: "<ISO timestamp>", elapsedMs: 0 } }, null, 2))}<p>This is an illustrative envelope, not a live business result. Cached records retain their first-fetch timestamp and can become outdated.</p><h2>Access and limits</h2><ul><li>Use a <code>gst:read</code> key or a global key with GSTIN enabled.</li><li>60 authorized requests per minute per workspace, shared through MongoDB.</li><li>Separate local IP limits and bounded queues also apply.</li><li>Respect Retry-After on 429 responses. Keep retries bounded.</li><li>Successful usage covers a rolling 90-day window.</li></ul><h2>Source failures</h2><p>Handle invalid GSTINs, not-found results and temporary portal failures. CAPTCHA success is not guaranteed; a failure never becomes fabricated business data.</p>`,
  },
  {
    slug: "ocr",
    label: "Document OCR",
    title: "Local Node.js OCR package guide",
    description:
      "Install Sandbee OCR, configure your API token once, verify at startup and extract document fields locally with background license renewal.",
    body: (c) =>
      `<h1>Local document OCR</h1><p class="lead">Documents stay on your Node.js server. Only installation metadata travels to Sandbee for license checks.</p><h2>1. Enable and install</h2><p>Enable Document OCR in Store and create an OCR or global API key. After the npm release is published, install @sandbee/ocr. Until then, use the versioned package download from Store.</p>${code(c.ocrNpmPublished ? "npm install @sandbee/ocr@0.1.0" : "npm install ./sandbee-ocr-0.1.0.tgz")}<h2>2. Configure once</h2><p>Save an OCR key or global key in <code>SANDBEE_OCR_TOKEN</code>. Generate a persistent UUID once as <code>SANDBEE_INSTALLATION_ID</code>. Download and pin <code>sandbee-public.pem</code> from your authenticated console.</p>${code(`node -e "console.log(require('node:crypto').randomUUID())"`)}<h2>3. Verify at server startup</h2>${code(["const { SandbeeOCR } = require('@sandbee/ocr');", "const fs = require('node:fs');", "const path = require('node:path');", "", "const ocr = new SandbeeOCR({", "  token: process.env.SANDBEE_OCR_TOKEN,", "  installationId: process.env.SANDBEE_INSTALLATION_ID,", "  label: 'Production document service',", `  issuer: '${c.licenseIssuer}',`, ...(c.licenseIssuer.startsWith("http:") ? ["  allowLocalDevelopment: true,"] : []), "  publicKey: fs.readFileSync('./sandbee-public.pem', 'utf8'),", "});", "", "async function startServer() {", "  await ocr.start(); // Verify before accepting OCR work.", "  // Start your HTTP server and reuse this client.", "}", "async function readDocument(filePath) {", "  return ocr.extract({ documentType: 'PAN', files: [path.resolve(filePath)] });", "}", "// Call ocr.close() during graceful shutdown.", "startServer().catch(error => { console.error(error.code); process.exitCode = 1; });"].join("\n"))}<h2>Automatic renewal</h2><p>The client renews in the background every 45 seconds. Signed leases last 60 seconds. Revoke or disable stops new work within that window; already admitted jobs may finish. Network failure never extends an expired lease.</p><h2>Supported environment</h2><ul><li>Node.js 22+, Windows x64 or Linux x64 with glibc.</li><li>No Alpine, ARM/Graviton, macOS or browser runtime in this build.</li><li>PAN, Aadhaar, Voter ID, Driving License, Ration Card and Passport.</li><li>One or two local files, 10 MB each; first three PDF pages.</li><li>Review field flags and conflicts. OCR does not verify authenticity.</li></ul><div class="callout">The hosted demo uploads files to the private Store demo worker. The package does not upload documents or extracted text. Customer-controlled code cannot provide tamper-proof licensing or independently verified remote extraction counts.</div>`,
  },
  {
    slug: "authentication",
    label: "Keys & authentication",
    title: "App keys, global keys and service access",
    description:
      "Understand Sandbee account verification, app enablement, global keys, service-specific permissions and secure server integration.",
    body: () =>
      `<h1>Keys and workspace access</h1><p class="lead">Authentication identifies your account. App enablement and key permissions determine what an integration can use.</p><table><thead><tr><th>Key</th><th>Access</th><th>Use case</th></tr></thead><tbody><tr><td>App key</td><td>One enabled app</td><td>A service-specific project</td></tr><tr><td>Global key</td><td>All enabled apps, including future activations</td><td>A trusted multi-product backend</td></tr></tbody></table><h2>Create keys where you work</h2><p>Use App keys inside each service. The central API keys page also creates global keys. Secrets are shown once; only hashes are stored. Disabling an app blocks both key types.</p><h2>Workspace roles</h2><p>Owner and Admin manage members, app activation and all workspace keys. Developer can use enabled services and manage only keys they created. Viewer has read-only access. An invitation must be accepted by its verified email recipient. Role changes and removal revoke that member's keys.</p><h2>Protect your credentials</h2><ul><li>Use environment variables or a secret manager.</li><li>Never put keys in URLs, frontend bundles or logs.</li><li>Separate development and production keys.</li><li>Rotate by deploying a new key, verifying it, then revoking the old one.</li><li>Password changes invalidate your sessions and keys you created across workspaces. Other members' keys stay active.</li></ul><h2>Service separation</h2><p>Hosted services have distinct server credentials and authorize only their own product. These credentials are different from customer global keys. Authorization fails closed when the central authority is unavailable.</p>`,
  },
  {
    slug: "errors",
    label: "Errors & limits",
    title: "API errors and retry guidance",
    description:
      "Handle Sandbee rate limits, disabled apps, OCR licensing errors and temporary service failures safely.",
    body: () =>
      `<h1>Errors and limits</h1><p class="lead">Handle errors explicitly and keep retry queues bounded.</p><table><thead><tr><th>Code</th><th>Next step</th></tr></thead><tbody>${[
        [
          "INVALID_TOKEN",
          "Check the key, revocation and password-reset history.",
        ],
        ["SCOPE_DENIED", "Use the matching app key or a global key."],
        ["APP_DISABLED", "Enable the app in your workspace."],
        ["RATE_LIMITED", "Wait for Retry-After; back off with jitter."],
        ["AUTHORITY_UNAVAILABLE", "Retry later; access fails closed."],
        ["LICENSE_DENIED", "Check the key and installation status."],
        ["LICENSE_INVALID", "Check issuer, pinned key and system clock."],
        ["PLATFORM_UNSUPPORTED", "Use supported x64 Windows or glibc Linux."],
        ["GST_UNAVAILABLE", "Retry after the source portal recovers."],
        [
          "EXTRACTION_FAILED",
          "Check document quality, format and PDF password.",
        ],
      ]
        .map(([a, b]) => `<tr><td><code>${a}</code></td><td>${b}</td></tr>`)
        .join(
          "",
        )}</tbody></table><h2>Shared and local limits</h2><p>MongoDB-backed workspace quotas are shared across product servers. IP abuse counters, LRU caches and native queues have separate local bounds. More replicas do not imply unlimited capacity.</p><h2>Usage visibility</h2><p>Hosted success counts cover the last 90 days. Local extraction counts are not observed by Sandbee. Installations and license checks are reported separately.</p>`,
  },
];
function mountDeveloperPages(app, config) {
  const base = config.production ? config.appUrl : "https://store.sandbee.in";
  app.get("/robots.txt", (_req, res) =>
    res
      .type("text/plain")
      .send(
        `User-agent: *\nDisallow: /\nAllow: /developers\nAllow: /developers.css\nAllow: /fonts/\nSitemap: ${base}/sitemap.xml\n`,
      ),
  );
  app.get("/sitemap.xml", (_req, res) =>
    res
      .type("application/xml")
      .send(
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map((p) => `<url><loc>${escape(base + "/developers" + (p.slug ? "/" + p.slug : ""))}</loc></url>`).join("")}</urlset>`,
      ),
  );
  function render(req, res) {
    const slug = req.params.slug || "",
      page = pages.find((p) => p.slug === slug);
    if (!page)
      return res
        .status(404)
        .type("html")
        .send(
          '<!doctype html><title>Guide not found | Sandbee</title><h1>Guide not found</h1><a href="/developers">Developer center</a>',
        );
    const canonical = base + "/developers" + (slug ? "/" + slug : "");
    res.set("Cache-Control", "public, max-age=300");
    if (!config.production) res.set("X-Robots-Tag", "noindex, nofollow");
    res
      .type("html")
      .send(
        `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(page.title)} | Sandbee Developers</title><meta name="description" content="${escape(page.description)}"><link rel="canonical" href="${escape(canonical)}"><meta property="og:type" content="website"><meta property="og:title" content="${escape(page.title)}"><meta property="og:description" content="${escape(page.description)}"><meta property="og:url" content="${escape(canonical)}"><meta name="twitter:card" content="summary"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="stylesheet" href="/developers.css"></head><body><a href="#content" class="skip">Skip to guide</a><header><a class="brand" href="/developers">sandbee <span>developers</span></a><nav><a href="/developers">Guides</a><a href="/" class="button">Open console ↗</a></nav></header><div class="layout"><aside><small>BUILD WITH SANDBEE</small><nav aria-label="Developer guides">${pages.map((p) => `<a ${p.slug === slug ? 'aria-current="page"' : ""} href="/developers${p.slug ? "/" + p.slug : ""}">${p.label}</a>`).join("")}</nav><div class="aside-note"><strong>Your next step</strong><p>Enable an app and create a key in your workspace.</p><a href="/">Open Sandbee Store →</a></div></aside><main id="content"><nav class="crumb" aria-label="Breadcrumb"><a href="/developers">Developers</a><span>/</span><span>${escape(page.label)}</span></nav>${page.body(config)}<section class="cta"><div><h2>Ready to build?</h2><p>Your apps, keys and setup in one workspace.</p></div><a class="button" href="/">Open your workspace ↗</a></section></main></div><footer><strong>sandbee</strong><span>Developer documentation · v0.1.0</span><a href="/developers/authentication">Security & access</a></footer></body></html>`,
      );
  }
  app.get("/developers", render);
  app.get("/developers/:slug", render);
}
module.exports = { mountDeveloperPages };
