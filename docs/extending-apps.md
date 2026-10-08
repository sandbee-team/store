# Adding products to Sandbee Store

The current release has two real free apps. It does not list invented future apps, accept payments or create invoices. All verified workspace members use the same central identity; app/global keys remain constrained by app enablement and membership.

## Product registration

Add the real product to `backend/modules/platform/catalog.js` with a stable ID, name, category, description, path, delivery mode, scope and pricing metadata. Apps groups and searches these records; central navigation does not need one global item per product. Keep the 212px contextual menu for product-specific tasks. Add its icon, contextual routes, developer guide and relevant operational report. Do not reuse OCR request counts as another app's usage.

The current authorization scope enums, activation validation, service authentication and UI route mapping explicitly support GST and OCR. A new product requires corresponding server handlers, scope validation, service-specific credentials and tests. A catalog record alone is not a deployed service. Keep customer API keys out of browsers. Keep internal service credentials distinct per product.

## Paid products: required before launch

The current `billingSummary()` models only the two free apps. Do not change a label to Paid and start collecting money. Introduce server-managed plans and subscriptions, payment-provider checkout, verified and idempotent webhooks, invoice records and explicit customer acceptance first. Prices must use integer minor units and a currency. Paid activation must fail closed until the server confirms entitlement; global keys must still check that app's entitlement.

Recommended Mongo boundaries for that separate implementation: `plans` (versioned product prices), `subscriptions` (workspace/product/provider IDs and status), `invoices` (immutable provider references and currency totals), and `payment_events` (unique provider event IDs for replay-safe processing). Keep these out of the identity document. Define cancellation, payment failure, grace periods, refunds, taxation and reconciliation before paid release. Current usage events are operational reports, not billing-grade metering.

## Capacity and deployment

Central Store handles identity, permissions, licenses and operational reports. Each product owns its processing, worker limits and data store. Native OCR executes on customer servers; the hosted demo has bounded upload sizes, inflight slots, per-workspace concurrency and cache memory. GST coalesces duplicate lookups and keeps a local marker LRU in front of its indexed response collection.

Mongo quotas coordinate account limits across replicas; process LRUs, IP limits and worker queues are local. Start with one GST replica because its portal concurrency bound is per process. Do not multiply replicas and assume a global portal limit. For measured growth, benchmark cached requests and synthetic licensing traffic on the chosen EC2, track authorization latency and Mongo writes, then introduce shared admission or durable queues where the measured bottleneck requires them. Do not load-test the government portal. Redis is not a requirement for this release.

There is no unlimited-traffic guarantee. Define a measured service-level target, backups, restore tests, alerts and capacity budget per product before public paid commitments.
