# Architecture and research

Updated 24 September 2026. Implementation is local; production cutover is a separate rollout.

## One console, independent product servers

The platform at store.sandbee.in owns identity, app enrollment, keys, licensing, quotas, usage and onboarding. GST computation and data live on the GST service; demo documents go directly from the browser to the OCR demo service. Customer integrations run OCR locally. The platform never forwards customer SDK document contents.

Routes: / (Dashboard), /apps (grouped catalog), /reports, /settings/profile, /settings/workspace, /settings/members, /settings/invitations, /settings/security, /apps/gst, /apps/gst/keys, /apps/ocr, /apps/ocr/keys, /tokens, /docs, /docs/gst, /account. App /usage and /guide routes preserve the contextual app menu. Legacy /account, /members and /invitations remain aliases. Public guides live under /developers. Each verified identity may own one personal workspace and join other team workspaces. Membership, activation, keys and usage are isolated by workspace.

A hosted request follows:

1. Caller sends a customer key to the GST service, or the console obtains a short-lived one-use demo ticket.
2. Product service authenticates to the central internal API with its own distinct credential.
3. Platform verifies the user, app activation, key scope/version/revocation or one-use grant, then atomically consumes a workspace quota in MongoDB.
4. Platform creates a usage event and returns only a workspace identifier and request identifier.
5. Product service performs work on its own host and reports completion using that request identifier.
6. Atomic authorized-to-success/failed transitions make repeated completion calls idempotent. Only successful events enter the workspace's totals.

A demo ticket is hashed, product-bound, expires after 60 seconds and is consumed once. A fresh browser ticket is required for retry. No customer service key is exposed to the browser by this flow. Internal endpoints are protected by server credentials; hiding their URL is not an authorization mechanism.

## Research decisions

| Official guidance | Application to Sandbee |
|---|---|
| AWS separates identity authorization from API Gateway usage-plan keys; usage-plan quotas are best effort | Our random customer bearer keys are hashed and explicitly authorized against user, app and scope. A gateway usage-plan key alone would not replace these checks. |
| Azure multitenant guidance separates authentication, authorization and tenant isolation | Authorized workspace IDs determine resource ownership; actor IDs identify the calling member. Caller-provided IDs never decide whose usage to update. |
| AWS recommends least privilege and temporary workload credentials | App keys are recommended for one product. Global keys are an explicit broader option. Product server credentials are distinct; future AWS IAM workload identity can replace these static internal credentials. |
| Microsoft/OAuth recommend authorization-code flow with PKCE for independent login clients | Today the console is one origin. If future apps retain independent authenticated frontends, integrate a maintained OIDC provider; do not turn OCR license JWTs into login tokens. |
| Google documents JavaScript crawling/rendering limits | Public guides contain server-rendered readable HTML, links, unique metadata, canonical URLs, sitemap and real 404s. Authenticated console pages use noindex. |

Sources: [AWS API Gateway usage plans](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-usage-plans.html), [Azure identity architecture](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/identity), [AWS IAM practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html), [Microsoft code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [OAuth security BCP](https://www.rfc-editor.org/rfc/rfc9700), [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

These are design choices inferred for Sandbee, not a claim of Microsoft/AWS parity, enterprise SSO compliance or guaranteed SEO ranking. Managed customer identity such as [Cognito User Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/what-is-amazon-cognito.html) is a future option. [IAM Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html) primarily addresses workforce access. [Keycloak OIDC](https://www.keycloak.org/securing-apps/oidc-layers) is a self-hosted alternative with additional provider operations.

## Identity and permissions

Scrypt password hashing, HMAC-protected email OTP, one-use password recovery, hash-only sessions, exact Origin plus CSRF on browser mutations, and production Secure/HTTP-only/host-only cookies are implemented. The production __Host- cookie does not span sibling domains. These browser cookie restrictions are defined by [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).

App activation is separate from authentication. App scopes are gst:read and ocr:local. A global key can access every enabled app, including apps activated later, but does not bypass activation. Password changes/reset increment the identity authVersion, invalidating its sessions and every key it created across workspaces, without affecting other creators. Ten active keys per workspace, five sessions per identity and bounded activity are enforced. Revoked keys are pruned during later key creation; this activity list is not a compliance audit log.

Key creation uses a token revision condition to protect concurrent updates. Installation changes use explicit array filters to avoid Mongo positional ambiguity when enabledApps and tokens are both arrays. Product services never receive the signing private key or full user documents.

## Workspace authorization

Owner and Admin can manage all workspace keys, enabled apps and members. Developer can use services and create/revoke only their own keys and installations. Viewer can read workspace reports, members and guides. The owner cannot be removed or demoted. Administrators cannot change their own role.

Invitations are addressed to a verified email, expire after 7 days, and are accepted once. They do not grant access merely by opening an email link. Conditional workspace revisions prevent concurrent membership writes from overwriting each other. Role changes increment member versions and revoke their keys; removal deletes membership and revokes their keys atomically in the workspace document. Held browser grants also recheck member versions at consumption. New OCR work stops within its 60-second lease boundary after revocation.

Workspace selection belongs to a browser session. The UI pins requests to its displayed workspace with X-Workspace-Id; a stale tab gets 409 instead of mutating a newly selected workspace. Server permissions always derive from membership. Identity mutations use separate account routes. Workspace and identity writes are not a multi-document transaction: a concurrent session invalidation can leave an accepted invitation without a switched session, recoverable by signing in and selecting the workspace.

First access migrates earlier local-release embedded app/key data into a personal workspace with the same ID, retaining usage ownership. This is distinct from optional read-only linking of the older live GST/OCR accounts. Back up MongoDB before rollout.

Reports aggregate actual admitted events by UTC day, with a maximum 90-day query window and workspace/time index. CSV export uses the same data. These are operational reports, not billable metering.

## MongoDB layout

| Database / collection | Purpose | Bounds and indexes |
|---|---|---|
| sandbee_platform.users | Identity, password/OTP, sessions, onboarding profile, legacy receipts | Unique normalized email; sparse unique session hashes and legacy source keys; five sessions |
| sandbee_platform.workspaces | Owner, embedded membership/invitations, enabled apps, keys/installations, recent key activity, license checks | Unique ownerId and sparse token hashes; membership and invitation email indexes; 50 active/invited members; 10 active keys; 5 lifetime installations/key; activity capped at 30 |
| sandbee_platform.rate_limits | Atomic fixed-window counters for workspace quotas and authentication attempts | Window-specific primary key, TTL expiresAt |
| sandbee_platform.request_grants | Hashed, one-use, 60-second product tickets | Primary key hash, TTL expiresAt; expiry checked in query |
| sandbee_platform.usage_events | Authorized/completed service requests, no document body | Primary key request UUID; workspace/time and workspace/state/time compound indexes; TTL 90 days |
| sandbee_gst_data.gst_records | GSTIN, first successful response, fetchedAt | Unique GSTIN |

The product databases can use one Mongo cluster with distinct credentials/database permissions. GST needs only its data DB; OCR demo needs no Mongo access. The platform alone needs the central identity DB. Optional legacy linking uses a read-only source credential.

Mongo single-document conditional writes provide the atomic operations used here; unique indexes enforce identity constraints. TTL deletion is asynchronous, so authorization and aggregation check expiration/time explicitly. [Mongo atomicity](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/), [Mongo unique indexes](https://www.mongodb.com/docs/manual/core/index-unique/).

Hosted success totals are computed over a rolling 90-day window. License checks are a separate cumulative counter. Completed service work is the accounting event; a client disconnect after completion does not undo it. Completion is retried once with the same request ID. A prolonged control-plane outage can leave events authorized and not counted; this release does not claim billing-grade exactly-once delivery or provide a durable completion outbox.

## Customer OCR

1. Enable OCR, download the versioned tarball, create an OCR app key or global key.
2. Save token and stable UUID once in server environment; pin the public Ed25519 key.
3. Await ocr.start() before accepting OCR traffic.
4. Startup verifies the license; a background timer renews every 45 seconds.
5. Signed leases last 60 seconds. 401/403 renewal blocks new work immediately; network failure cannot extend expiry. Already admitted jobs may finish.
6. Extract local files in an isolated native child with a deadline. Caller files are preserved; temporary copies are removed normally.
7. Return fields and review/conflict status locally. Sandbee receives only installation ID, label and platform for licensing, not document bytes or extraction telemetry.

Validation pins algorithm, key, issuer, audience, installation, platform, issue time and expiry; it forbids redirects and production plain HTTP. [Node crypto](https://nodejs.org/api/crypto.html) provides signing primitives. Native compatibility is explicit, as [Node addons](https://nodejs.org/api/addons.html) do not imply every OS/CPU is supported.

Supported: Node 22+, Windows x64, Linux x64/glibc. Five lifetime installation IDs per token, including revoked IDs; these are not hardware-attested machine counts. Customer-controlled software can be modified. No tamper-proof DRM or independently verified local extraction usage is claimed. Signing key rotation requires coordinated customer public-key updates.

## Package distribution

An authenticated download produces sandbee-ocr-0.1.0.tgz, approximately 70 MB. [npm supports tarball installation](https://docs.npmjs.com/cli/v11/commands/npm-install/). This package has not been published.

A runtime Sandbee token is not an npm registry credential. A [private npm package](https://docs.npmjs.com/creating-and-publishing-private-packages/) would require separate registry permissions and distribution planning. Preserve native/model notices and verify redistribution rights. At higher download volume, use authorized short-lived object-store URLs for immutable artifacts and CDN delivery.

## Capacity and failures

| Control | Current limit / storage |
|---|---|
| GST requests | 60/min/workspace, shared Mongo |
| Demo extraction | 10/min/workspace, shared Mongo |
| Demo tickets | 12/min/workspace, shared Mongo |
| OCR license issuance | 120/min/workspace, shared Mongo |
| Package downloads | 3/min/workspace, shared Mongo |
| Auth attempts | 15/15 minutes/IP in production, shared Mongo; local development override 100 |
| API IP limiter | 300/min/process, bounded local store |
| Legacy linking | 5/15 minutes/account/process |
| Internal service traffic | 10,000/min/IP/process, after service authentication |
| Demo admission | 5 uploads/process, 2/workspace/process, 1 native job at a time, queue 4 |
| GST live portal work | 1 active/process, queue 4, queue wait 10 seconds |
| Customer SDK | 2 admitted requests/client, 1 native worker, bounded deadlines |

GST LRU stores GSTIN -> 1. A marker miss still checks indexed Mongo because eviction/restart is not proof of absence. First successful records persist; same-key in-flight work is coalesced locally. Cross-replica portal coalescing is not implemented: begin with one GST worker replica.

Demo cache is per-workspace, bounded to 256 entries / 16 MB / 300 seconds. Uploads allow two files, 10 MB each, 25 MP images and first three PDF pages. No permanent document collection exists. Crash leftovers require container recreation or a bounded temp cleanup policy.

Services fail closed if central authorization is unavailable. OCR SDK may continue only within an existing valid lease. Worker failures, full queues and portal failures yield bounded errors. Local IP limits are per replica; Mongo workspace quotas are shared. Edge WAF/IP protection remains useful before DB traffic; [OWASP brute-force guidance](https://community.owasp.org/controls/Blocking_Brute_Force_Attacks) supports layered controls.

Measure target EC2 p95/p99, CPU/RSS, Mongo latency and queue rejection using synthetic/cached workloads. Do not flood the government portal. This release has functional concurrency tests, not a demonstrated production throughput/SLA.

## Existing users and future apps

Legacy self-link requires verified central email, same verified source email and old password. It records historical counters separately, without modifying old DBs or importing old sessions/keys. See deployment.md for coexistence routes and rollback.

To add a product: define catalog ID/scope, explicit service credentials and authorization mapping, enablement UI, service implementation, quotas, developer guide and ownership/isolation tests. A future app must implement those checks before it is exposed to global keys. No placeholders are shown for the two unspecified future ideas.

Team access is implemented. Billing needs durable metering and payment reconciliation; enterprise federation needs a maintained identity provider. Ownership transfer, team deletion and SCIM provisioning are future extensions.


## Free billing and product growth

Current GST/OCR catalog entries carry explicit free pricing metadata in INR minor units. The central authenticated billing endpoint derives enabled subscriptions from the current workspace and returns zero charges and no invoices. It does not create a payment, fake a subscription-provider object or add redundant billing collections for free apps. The frontend consumes this server-owned summary for Billing and the Dashboard plan widget. Future paid plans require the independent entitlement/payment work described in extending-apps.md.

Demo origin checks now reject missing/foreign browser origins before ticket authorization. This supplements the existing one-use 60-second grant and server-to-server credential checks; it does not treat CORS or a frontend ENV key as proof of identity. See demo-security.md.
