# @sandbee/ocr

Local document extraction for Node.js 22+. Documents stay on the customer server. Sandbee receives license checks containing installation ID, label and platform. Startup verifies access, then background renewal runs every 45 seconds. Signed Ed25519 leases last 60 seconds, with no offline grace after expiry. No extraction telemetry is sent.

After the owner publishes the npm release, install with the command below. Before publication, use the versioned tarball download from Store (see Release availability).

```sh
npm install @sandbee/ocr@0.1.0
```

Enable Document OCR in your console. Generate a persistent installation ID once: `node -e "console.log(require('node:crypto').randomUUID())"`. Save it as `SANDBEE_INSTALLATION_ID`. Create an OCR app token (or a global token) and save it as `SANDBEE_OCR_TOKEN`. Download `sandbee-public.pem` from the same console and pin it with your deployment configuration. Keep the token and UUID stable across restarts.

```js
const { SandbeeOCR } = require('@sandbee/ocr');
const fs = require('node:fs');
const path = require('node:path');
const ocr = new SandbeeOCR({
  token: process.env.SANDBEE_OCR_TOKEN,
  installationId: process.env.SANDBEE_INSTALLATION_ID,
  label: 'Production document service',
  issuer: 'https://ocrapi.sandbee.in',
  publicKey: fs.readFileSync('./sandbee-public.pem', 'utf8'),
});
async function main() {
  try {
    await ocr.start(); // Verify access and start renewal before accepting application traffic.
    const result = await ocr.extract({ documentType: 'PAN', files: [path.resolve('pan-card.png')], mode: 'balanced' });
    console.log(result.fields);
  } finally { ocr.close(); }
}
main().catch(console.error);
```

Use one client per long-running server process; close only on shutdown. The `finally` example is for a one-off script. Keep all secrets in backend environment variables, never `VITE_` or `NEXT_PUBLIC_` values.

## Supported inputs

- Windows x64; Linux x64 **glibc**, e.g. Debian/Ubuntu. **No Alpine, ARM/Graviton, macOS or browsers** in this engine build.
- Document types: AADHAAR, PAN, VOTER_ID, DRIVING_LICENSE, RATION_CARD, PASSPORT.
- One or two **absolute local file paths**, JPEG/PNG/WebP/TIFF/PDF, 10 MB/file, 25 MP images, first 3 PDF pages.
- Options: `mode: 'balanced' | 'accurate'`, `includeText: boolean`, `pdfPassword: string`.
- Original caller files are never deleted. Temporary processing copies are removed in `finally`; an OS/process crash may leave temporary files. Use encrypted ephemeral storage and a retention cleanup job if your deployment requires crash cleanup.
- At most two requests admitted per client; one native child worker, bounded wait. Add a bounded queue in your application.

Read `result.status`, field statuses and conflicts before trusting a result. Confidence is not a calibrated probability; document authenticity is not verified. Local OCR is not guaranteed perfectly accurate.

## License behavior

Each token supports five lifetime installation identities, including revoked identities. A renewal that returns 401/403 blocks new work immediately. If Sandbee is unreachable, new work is blocked once the existing 60-second lease expires; jobs already admitted may finish. Disabling OCR also denies renewal. Revoked installation IDs cannot reactivate under that token. Rotate a token to reset its installation slots. Password resets invalidate keys created by that identity across workspaces. Removing a workspace member or changing their role revokes their keys. These guarantees apply to the unmodified SDK with a correct system clock.

The package verifies signature, issuer, audience, scope, installation ID, platform, issue time and expiration against the configured public key. It refuses HTTP except loopback with `allowLocalDevelopment: true`. It never follows license HTTP redirects. No token is written to disk by this package. There is no offline grace period after lease expiry.

Customer-controlled software can be modified; this is access control for the shipped client, not tamper-proof DRM. Do not bill by independently verified local extraction counts; the service cannot observe them. Never accept arbitrary browser-provided filesystem paths in your own application: upload to a controlled directory and pass its absolute path.

For local development set `issuer: 'http://localhost:8097'`, `allowLocalDevelopment: true` and pin the local public key. Keep the installation UUID stable.

The native engine and its bundled third-party notices are included under `vendor/doc-extractor`. Public registry availability does not grant an open-source license. Review engine ownership, model rights and all notices before external commercial distribution.

## Release availability

The package source is prepared for npm publication; this build does not publish it automatically. Until the owner publishes version 0.1.0, install the Store download with `npm install ./sandbee-ocr-0.1.0.tgz`. The Sandbee API token is not an npm registry token. Documents are processed locally; only installation metadata goes to https://ocrapi.sandbee.in/api/v1/ocr/license. Manage activation, keys, installations and revocation in Store.
