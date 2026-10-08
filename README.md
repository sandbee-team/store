# Sandbee Store

Current deployment: [Store + backend services](docs/deployment.md). npm publishing: [release steps](docs/npm-publishing.md).


One account and React console for GSTIN, customer-hosted OCR and future Sandbee products. Target console: **store.sandbee.in**. This new project is built locally; existing live projects and production databases have not been changed.

## Product workflow

1. Sign up, verify email OTP and complete workspace onboarding.
2. Enable GSTIN or Document OCR from the app catalog.
3. Create a dedicated key inside an app, or a global key from API keys. A global key works across enabled apps, including future activations. Disabled apps reject both key types.
4. Call GST at **gstapi.sandbee.in** from a backend. Install @sandbee/ocr on the customer's Node.js server; verify through **ocrapi.sandbee.in** at startup and renew in the background. The registry release is owner-published; a tarball remains available before publication.

The console includes app workspaces, document studio, field review/JSON views, token and installation revocation, usage, account settings and developer guides. Public `/developers` pages are server-rendered with canonical metadata and sitemap. Private console pages are excluded from indexing.

## Store navigation

Dashboard shows real hosted request totals, success/cache rates, enabled apps and recent key activity. Apps groups the catalog by category and supports search and enabled filtering. Opening an app adds its contextual lookup/studio, keys, usage and guide menu. The main sidebar minimizes to icons and remembers that preference.

Settings has Profile, Workspace, Members, Invitations and Security tabs. Reports offer 7/30/90-day periods, interactive area/bar charts, request-outcome distribution, seven-row pagination and full-period CSV export. Billing shows INR 0, enabled free subscriptions and an honest empty invoice state. Shared dropdowns support keyboard interaction; the Sandbee mark appears in the shell, favicon and loading feedback.

## Team access

Invite an employee from Members. They sign in with the invited email, verify it, and accept the invitation; a new employee can join directly during onboarding. Invitations expire in 7 days. Role changes and removal revoke keys created by that member. Password reset invalidates only the resetting identity's keys across workspaces.

Usage belongs to the workspace that authorized the request. Reports offer 7/30/90-day views and CSV export. Unknown completions remain explicitly unconfirmed. Customer-local OCR extractions are not sent to Sandbee.

## Services

| Component | Responsibility | Local address |
|---|---|---|
| Platform | Account, email OTP, sessions, app activation, keys, licenses, quotas, usage, guides | http://localhost:8094 |
| GST service | Hosted API, portal worker, indexed GST response store, local LRU | http://localhost:8095 |
| Store demo worker | Private Store uploads and native extraction; no independent UI | http://localhost:8096 |
| OCR license API | Backend-only verification and renewal; no documents, DB or signing key | http://localhost:8097 |
| Customer OCR SDK | Local processing; only licensing metadata reaches Sandbee | Customer Node.js server |
| MongoDB | Separate platform and GST databases | Loopback port 27024 |
| Mailpit | Local OTP inbox / SMTP | http://localhost:8029 / port 1029 |

Hosted services are separately deployable. GST, license and demo servers use distinct internal credentials and cannot authorize another product. MongoDB shares workspace quotas across replicas; local LRU caches, IP counters and worker queues stay bounded per process. No Redis is required.

## Run locally

Use Node.js 22+ and Docker Desktop with Linux x64 containers.

```sh
npm ci
npm run setup
docker compose up -d --build
```

Open http://localhost:8094, create an account and read its OTP at http://localhost:8029. Enable each app before creating keys. There is no shared demo password. Setup generates ignored `.env` service secrets and a persistent Ed25519 private signing key in `.local/`; it preserves existing values. Never regenerate production signing keys during deployment.

## Verify

```sh
npm run build
npm test
npm run test:ui
npm run package:ocr
node scripts/smoke-installed.js --live-gst
```

Backend tests use temporary MongoDB. Browser tests use local Docker, Mailpit and installed Microsoft Edge; they create disposable accounts. The installed-package smoke downloads the tarball into an isolated consumer and runs real native OCR. `--live-gst` makes a real portal request and records its outcome; inspect its report because portal availability is not guaranteed.

`npm run dev` serves Vite on port 5194. For source development, set backend `APP_URL=http://localhost:5194`, configure the separate demo's `CONSOLE_ORIGIN` to match, and point the platform at the separate services. `npm start` runs only the central platform; it needs MongoDB and SMTP, not Python.

## Code map

```text
backend/
  config/                   Validated platform environment
  infrastructure/           Mongo indexes, atomic quotas, bounded local limiter
  middleware/               Expensive-work admission
  modules/auth/             Identity, sessions, OTP, password recovery
  modules/platform/         Catalog, activation, keys, licenses, service access,
                            usage, public developer pages and legacy linking
  modules/workspaces/       Membership, invitations, roles, conditional writes
  modules/reports/          Workspace-scoped daily usage aggregation
  modules/mail/             Branded HTML and text emails
  shared/                   Errors and bounded HTTP response reader
frontend/
  src/components/           Shared controls and app navigation
  src/pages/                Auth, dashboard, apps, settings, reports, members, GST, studio, keys, docs
  src/layouts/              Shared console shell and workspace navigation
  src/hooks/                Abortable resource loading
  src/lib/                  HTTP, CSRF, workspace context, formatting and CSV
  src/styles/               Responsive design tokens and layouts
  public/                   Developer styles and synthetic demo image
services/
  shared/                   Product HTTP setup and central authorization client
  gst/                      Independent GST API, Mongo cache, Python worker
  ocr-demo/                 Independent demo API and native worker admission
packages/ocr/
  src/                      Public SDK, startup/renewal, TypeScript definitions
  backend/modules/ocr/      Isolated engine and document pipeline
  vendor/doc-extractor/     Native binaries, models, integrity manifest, notices
deploy/                     Independent Compose and reverse-proxy examples
docs/                       Architecture, research, deployment and verification
scripts/                    Setup, packing and installed-package smoke
test/                       Integration, resilience and browser flows
artifacts/                  Generated OCR tarball (ignored)
```

See [architecture and research](docs/architecture.md), [EC2 deployment](docs/deployment.md), [verification evidence](docs/verification.md) and [SDK instructions](packages/ocr/README.md), [demo authentication](docs/demo-security.md) and [adding future products](docs/extending-apps.md).

## Move to another PC

The source ZIP contains the complete application, lockfile, bundled native OCR engine/models, tests and deployment guides. It excludes credentials, signing keys, dependencies, build output and local databases. Extract it into a new folder, then follow **Run locally** above; setup creates fresh local credentials. To create another source archive on Windows, run `powershell -NoProfile -File scripts/export-source.ps1`. The archive and its SHA-256 file are written beside the project.

Do not transfer an existing production installation by generating a new signing key: follow the deployment guide's backup and restore instructions for that separate operation.

## Current limits

- OCR supports Windows x64 and Linux x64/glibc, Node 22+. This build does not support Alpine, ARM/Graviton, macOS or browsers.
- The SDK is an authenticated downloadable tarball, **not published to npm**. Install with `npm install ./sandbee-ocr-0.1.0.tgz`.
- OCR verifies at startup, renews every 45 seconds and uses 60-second leases. Already admitted jobs may finish. Customer-controlled software is not tamper-proof; physical machine counts and local extraction counts are not independently verifiable.
- Hosted success totals cover the last 90 days. First-fetch GST snapshots can become stale. OCR field review and portal error handling remain necessary.
- Traffic limits are safeguards, not a measured capacity guarantee. Start with one GST worker replica; benchmark intended EC2 capacity before scaling.
- Owner/Admin manage workspace members, apps and all keys. Developer manages only their own keys; Viewer reads reports and guides. One owned workspace per account; up to 50 active or invited members per workspace. Paid checkout, invoicing, ownership transfer and enterprise federation are not implemented.
- Preserve and review bundled native/model redistribution notices before commercial distribution.

Research and verification updated on 24 September 2026. No DNS, production deploy, npm publication or live account migration has been executed.
