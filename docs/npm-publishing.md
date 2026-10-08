# Publish @sandbee/ocr

The npm package source is **packages/ocr** inside Store. It has public publishConfig, an explicit files allowlist, TypeScript declarations, bundled engine notices and a prepack runtime integrity check. It contains no Store server, private signing key, account data or frontend. This delivery does not publish to npm or claim ownership of the @sandbee scope.

1. Use an npm account with publication permission for @sandbee and the registry-required authentication/2FA. If the name is unavailable, update package imports, lease audience, documentation and tests together before release.
2. Review redistribution rights for the native engine and bundled models/notices. Public publication exposes the client code/binaries; the shipped client's license checks are not tamper-proof DRM on a customer-controlled machine.
3. From Store root, run `npm ci` and `npm run package:ocr` on supported Windows x64 or Linux x64 with Node 22+. Inspect the contents for secrets/customer data.
4. From packages/ocr:

```sh
npm login
npm whoami
npm publish --dry-run --access public
npm publish --access public
npm view @sandbee/ocr@0.1.0 dist.integrity
```

Enter publishing credentials privately in the CLI. The Store OCR token is not an npm token. For CI use npm's documented trusted publishing workflow instead of hardcoding long-lived publishing credentials.

5. On a customer-like server, run `npm install @sandbee/ocr@0.1.0`. Set Store-issued OCR/global token, stable installation UUID, pinned public key and issuer=https://ocrapi.sandbee.in. Verify startup, local extraction, renewal and revocation against the real services.
6. Only after publication/install verification set OCR_NPM_PUBLISHED=true in Store .env and recreate its app. Store then shows npm installation first. Until publication it offers its versioned tarball download. npm tarball integrity metadata is not a separate cryptographic publisher signature.

Do not overwrite a published version. For a later release increment the SDK version and update Store's download/version metadata and lockfile together.

Official guidance reviewed October 3, 2026: [Scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/), [Publishing authentication](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/), [Trusted publishing](https://docs.npmjs.com/trusted-publishers/).
