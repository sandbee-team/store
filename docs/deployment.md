# Store and backend-only services — October 3, 2026

| Component | Public address | Responsibility |
| --- | --- | --- |
| Store | store.sandbee.in | Only customer panel: login, OTP, apps, keys, settings, reports and demo |
| GST API | gstapi.sandbee.in | GET /api/v1/gstin/:gstin; backend only |
| OCR license API | ocrapi.sandbee.in | POST /api/v1/ocr/license; backend only, no document uploads |
| Store demo worker | Store /api/demo/extract | Loopback-only worker; one-use Store tickets |
| @sandbee/ocr | Customer Node.js server | Local extraction, startup license verification, background renewal |

Store owns Mongo workspace/key state and the original Ed25519 signing key. OCR API relays only installation metadata to Store /internal/v1/ocr/license using its distinct server credential. It needs no Mongo, SMTP or signing key. Signed leases use issuer https://ocrapi.sandbee.in, expire after 60 seconds, and renew every 45 seconds. Revoked/expired leases block new work; already admitted work may finish.

## Store

Use Node 22+, Linux x64/glibc and Docker. Preserve production .env and .local/license-private.pem. Run node scripts/setup.js; it adds a missing OCR_LICENSE_SERVICE_SECRET without replacing existing secrets. Keep SESSION_SECRET, GST_SERVICE_SECRET, OCR_DEMO_SERVICE_SECRET and OCR_LICENSE_SERVICE_SECRET distinct.

Set authenticated MONGODB_URI, MONGODB_DB=sandbee_platform, GMAIL_USER, GMAIL_APP_PASSWORD, MAIL_FROM and GST_SERVICE_URL=https://gstapi.sandbee.in. Production Compose fixes Store, GST and license domains. Leave OCR_NPM_PUBLISHED=false until npm publication/install verification succeeds.

```sh
chmod 600 .env
sudo chown 10001:10001 .local/license-private.pem
sudo chmod 400 .local/license-private.pem
export RELEASE_TAG=2026-10-03
docker compose -f compose.production.yaml config --quiet
docker compose -f compose.production.yaml build app demo
docker compose -f compose.production.yaml up -d --no-build
curl --fail http://127.0.0.1:8094/api/health
curl --fail http://127.0.0.1:8096/api/health
```

Store production Compose includes the demo worker. Do not start the old separate demo Compose on the same port. Add the exact /api/demo/extract proxy location from deploy/nginx.products.conf.example to Store's HTTPS vhost, upstream 8096. Remaining Store traffic uses 8094. No shared secret belongs in frontend ENV.

## Backend repository replacements

The final kit includes gst-api and ocr-api with independent package/lockfiles, Dockerfiles, Compose, ENV examples and only backend source. Replace tracked application content in the old GST repository with gst-api; replace the old OCR app with ocr-api. Preserve .git/history, secure backups and credentials outside the code transfer. Do not overlay old frontend, server.js or dependencies onto these new folders. This delivery runs no Git commands and does not change production.

GST ENV: CONTROL_URL=https://store.sandbee.in; SERVICE_SECRET equals Store GST_SERVICE_SECRET; MONGODB_URI only for GST data; MONGODB_DB=sandbee_gst_data; TRUST_PROXY=1. OCR API ENV: CONTROL_URL=https://store.sandbee.in; SERVICE_SECRET equals Store OCR_LICENSE_SERVICE_SECRET; TRUST_PROXY=1. It needs no Mongo/Gmail configuration.

In each backend folder:

```sh
chmod 600 .env
export RELEASE_TAG=2026-10-03
docker compose -f compose.production.yaml config --quiet
docker compose -f compose.production.yaml build app
docker compose -f compose.production.yaml up -d --no-build
```

GST loopback port is 8095; OCR license is 8097. Route the entire respective TLS domain to its port. Both expose /api/health; / and unknown routes intentionally return JSON 404. Set DNS and TLS for the NEW ocrapi.sandbee.in domain. Keep database and application ports private. Examples assume one host Nginx proxy replacing X-Forwarded-For; adapt explicitly for Cloudflare/ALB/container proxy chains. OCR health proves process readiness, not Store connectivity.

## Cutover acceptance

1. Back up old environments, databases, Store signing key, Admin vault/backup keys and proxy configs off-host. Code replacement is not data deletion.
2. Stage the new Store and services on isolated ports. Verify real Gmail OTP/recovery and app activation.
3. Create Store GST keys: verify success, cached repeat, account usage, wrong scope and revocation. Never load-test the external GST portal.
4. Install the OCR package on a customer-like Node server. Set Store token, stable installation UUID, pinned public key and issuer=https://ocrapi.sandbee.in. Check startup, local extraction, renewal, expiry and revocation.
5. Verify Store demo at its SAME origin /api/demo/extract. Missing/foreign Origin, replayed tickets and oversized uploads must fail.
6. Switch the GST vhost only after acceptance. Old keys/password sessions are not Store keys. Existing OCR clients using Store as issuer must update; Store's old public /api/v1/ocr/license is removed.
7. Retire old GST/OCR web apps after migrating clients. ocr.sandbee.in is no longer a required product service. Optionally redirect identified GET UI paths to Store; do not redirect old extraction POST requests to a UI.

Optional legacy linking uses read-only old user databases and imports ownership receipts/historical counters, not passwords, keys, sessions or GST records. Keep old DB backups until migration is complete. New sandbee_gst_data is the default; verify schema before any cache migration.

## Operation

No Redis. Mongo workspace quotas are shared; bounded LRU/IP counters/queues are process-local. Start with one GST replica; benchmark actual EC2 resources using cached/synthetic traffic. OCR API bounds concurrent authority calls, payloads, response sizes and timeouts. No positive authorization cache extends a revoked lease. Traffic capacity is not guaranteed by container limits.

Keep previous image tags and secrets for rollback. Revert affected proxy/image only; never delete Mongo volumes or rotate signing/vault keys to roll back. Test off-host backup restores. Usage completion can remain unconfirmed during prolonged control outages; current counters are not a billing ledger.

See npm-publishing.md. Export backend folders reproducibly with node scripts/export-services.js <new-directory>, then generate each lockfile with npm install --package-lock-only --ignore-scripts.
