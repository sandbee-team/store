# October 2 launch review

26 backend/integration tests, 14 browser scenarios against local Docker, Vite production build and Linux Docker/package build pass. Production npm audit reports zero advisories. The app container is healthy; unauthenticated workspace endpoints deny access.

Mobile navigation initially failed its focus regression test: computed visibility could still be hidden at the scheduled focus attempt. Focus now uses bounded, cancellable frame retries until the drawer is focusable and avoids stealing focus once it is inside. Tab trapping also handles focus outside the drawer. The original test and full browser suite pass.

Local browser coverage includes signup/OTP, recovery, team roles, scoped/global keys, revocation, document extraction, package download, reports/CSV, billing and responsive navigation. Email testing uses Mailpit, not production Gmail. GST portal/production keys were not exercised. Preserve the persistent signing key and match downstream service credentials before production acceptance.

Fresh extraction exposed a packaging defect: a generic dist exclusion omitted the vendored OCR JavaScript entry point. The exporter now explicitly preserves packages/ocr/vendor/doc-extractor/dist while excluding generated app builds. Package creation verifies every engine-manifest file and confirms required runtime files are present in the tarball. This prevents shipping a download that builds successfully but cannot load the engine.

The deployment ZIP includes required native OCR binaries/models and vendored runtime but excludes .env, signing keys, local databases and generated application outputs. See deployment.md and the release START-HERE guide. No production deployment was performed; actual EC2 capacity and real external integrations still require acceptance.
