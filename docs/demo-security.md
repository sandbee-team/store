# OCR demo request authentication

The browser contains no shared server secret. A frontend ENV value is part of a downloadable JavaScript bundle and cannot establish that an HTTP caller is trusted.

1. The user signs in to Store using the HttpOnly session cookie and completes email verification and onboarding.
2. `POST /api/apps/ocr/demo-ticket` requires the expected Origin, CSRF token, current workspace, an allowed member role and enabled OCR app. Mongo limits ticket issuance. It returns an opaque, one-use token with a 60-second expiry.
3. The browser sends that token as a bearer credential directly to the demo server with the upload. The demo rejects missing or foreign Origins before authorization. Exact-origin CORS restricts browser access.
4. The demo authenticates to Store using its server-only `OCR_DEMO_SERVICE_SECRET` / `SERVICE_SECRET`. Store atomically consumes the hashed request grant and rechecks membership version, account version and app access. A reused, expired or revoked-access grant fails. Customer app/global API keys cannot substitute for a demo ticket.
5. Only admitted requests enter the bounded upload and native-worker pipeline. Completion accounting belongs to the authorizing workspace.

Configure `CONSOLE_ORIGIN=https://store.sandbee.in` on the demo host. Configure the same demo **server** credential on the central and demo hosts. It must never be a `VITE_*` value or appear in public docs, browser storage or application logs. Origin checking is defense in depth, not authentication: non-browser clients can forge Origin but still need a valid one-use ticket issued to an authenticated, authorized account. An authenticated user can automate their own requests within enforced limits; there is no reliable proof that a request originated from a human clicking the panel.

The UI's Radix menus need a small generated stylesheet. The HTML response receives a random style-only CSP nonce; `get-nonce` passes it to the library. The script policy remains self-only and no blanket `unsafe-inline` exception is added. HTML is not cached; static hashed assets retain immutable caching.

Sources: [OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html), [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [Radix Select](https://www.radix-ui.com/primitives/docs/components/select).
