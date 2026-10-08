# Verification evidence

Updated 24 September 2026 (India time). This report describes local checks, not a production SLA or a claim that every document/portal challenge succeeds.

## Executed checks

- Production frontend build: passed in local Vite and Docker image build.
- Backend integration/resilience: **26 tests passed** against temporary MongoDB. Includes origin/CSRF, unverified identity rejection, scoped/global keys, concurrent key and installation limits, signed lease validation, background revoke handling, native local extraction, cache persistence after LRU eviction, per-workspace usage, service credential isolation, one-use grants, invitation identity/expiry/replay, Admin/Developer/Viewer restrictions, removal, stale-tab workspace guard, password reset, app-filtered usage reports, workspace-scoped free billing, and demo Origin rejection before authorization.
- Edge browser: **14 flows passed** against the local Docker services and real Mailpit SMTP. Covers signup/OTP/onboarding, key reveal/revoke, native Linux demo extraction, app activation/global and scoped keys, public JavaScript-free guides, authenticated package download, mobile routes, invited employee direct joining and Viewer controls, reports/CSV, Store category search, persistent minimized/contextual navigation, Settings tabs, mobile keyboard focus, password recovery, free billing, chart switching, styled dropdown keyboard controls, zero CSP violations during popup interaction, and branded loading feedback. Three affected flows passed again after a screenshot-only correction (the popup uses a viewport capture so full-page resizing does not dismiss it).
- Installed SDK smoke: downloaded the actual authenticated tarball, installed it into an isolated consumer on Windows x64, started the native engine, matched two synthetic PAN fields, confirmed `documentsUploaded: false`, and received HTTP 401 when requesting a revoked key's lease.
- The installed SDK check was previously repeated against the Store image at 23 September 2026, 21:08:36 UTC (24 September in India), with the same passing result; it did not repeat the GST portal request.
- Live GST smoke on 23 September 2026 at 07:26:59 UTC: requested **09AAFPC6958E1ZN** through the separate GST service; HTTP **200**, `success: true`, `source: live`. Earlier attempts on 22 September returned retryable portal errors. A successful check does not guarantee future portal availability.
- Local Docker builds: platform, GST and OCR-demo targets built and started. Platform is separate from document/native processing; GST has its own Mongo database; demo requires no Mongo credential.
- All five local containers reported healthy. All three production Compose definitions (platform, GST and OCR demo) passed syntax/interpolation checks with temporary validation-only values where needed; real production MongoDB, Gmail and service settings still belong in the deployment environment.
- Shared text/status palette contrast: body 15.57:1, secondary 6.17:1, placeholder 4.94:1 on white / 4.65:1 on neutral, primary button 6.36:1, semantic statuses at least 5.51:1. This is a token-pair check, not a complete accessibility certification.

## Rendered review

Desktop captures use 1440x1080; mobile 390x844. Evidence is generated in ignored `test-results/`. Inspected auth/onboarding, empty and active dashboard, grouped Apps, minimized app navigation, tabbed Settings, studio results, private/public guides, members, reports and mobile route layouts. Fixed mobile public-guide overflow, chart label scaling and drawer keyboard focus. Screenshot capture waits for loaded activity, disables finite transitions and resets document scroll before the minimized-sidebar capture.

The new chart code is loaded on demand (about 117 KB gzip); the main UI is about 132 KB gzip and CSS about 8.6 KB gzip. New dependencies were audited by npm with zero reported vulnerabilities at installation time. This is not a source-security audit. HTML requests have distinct style-only CSP nonces, matching policy headers, no unsafe-inline exception and no-store caching.

The project-local Impeccable detector ran once. Its one warning, a public-guide accent border, was replaced by a subtle complete border. Independent finish-review findings and final disposition are recorded in `interface-review.md`; the additional polish review is in `interface-review-polish.md`; final reusable visual rules are in `../DESIGN.md`.

## Practical limits

No EC2 load benchmark, external penetration test, cross-browser certification, email-client compatibility matrix or real-user usability study has been performed. Rate limits, bounded queues, memory limits and Mongo atomicity provide safeguards; they do not prove unlimited traffic capacity. Use the deployment guide to stage and measure intended EC2 workloads before cutover.

OCR supports Node 22+, Windows x64 and Linux x64/glibc. Customer code is modifiable; licensing is not tamper-proof DRM. Local extraction counts are not remotely metered. GST stores the first successful snapshot and reports its age. Completion outages can leave unconfirmed events; reports are operational, not billing-grade.

No DNS, production deployment, npm publication, source Git push or live account migration was performed. Existing GST/OCR projects remain separate.
