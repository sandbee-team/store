#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PKG = __dirname;

function fail(msg) {
  console.error(`[doc-extractor selfcheck] FAIL: ${msg}`);
  process.exit(1);
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function platformKey() {
  const base = `${process.platform}-${process.arch}`;
  if (process.platform === 'linux' && fs.existsSync('/etc/alpine-release')) return `${base}-musl`;
  return base;
}

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PKG, 'MANIFEST.json'), 'utf8'));
  const key = platformKey();
  const supported = Object.keys(manifest.platforms || {}).sort();
  if (!supported.includes(key)) {
    fail(`platform ${key} not supported; prebuilts exist for: ${supported.join(', ') || '(none)'}`);
  }

  const relevant = Object.keys(manifest.files).filter((rel) =>
    !rel.startsWith('prebuilds/') || rel.startsWith(`prebuilds/${key}/`));
  if (!relevant.length) fail('manifest lists no files');
  for (const rel of relevant) {
    const abs = path.join(PKG, ...rel.split('/'));
    if (!fs.existsSync(abs)) fail(`manifested file missing: ${rel}`);
    const expected = manifest.files[rel];
    if (fs.statSync(abs).size !== expected.bytes) fail(`size mismatch: ${rel}`);
    if (sha256(abs) !== expected.sha256) fail(`sha256 mismatch: ${rel}`);
  }

  const expectedSpec = JSON.parse(fs.readFileSync(path.join(PKG, 'selfcheck', 'expected.json'), 'utf8'));
  const fixture = path.join(PKG, 'selfcheck', expectedSpec.fixture);
  if (!fs.existsSync(fixture)) fail(`fixture missing: ${expectedSpec.fixture}`);

  const dx = require('./dist/index.js');
  const result = await dx.extract({
    filePath: fixture,
    documentType: expectedSpec.documentType,
  });

  const conformance = dx.checkEnvelopeConformance(result);
  if (!conformance.ok) {
    fail(`envelope conformance: unknown=[${conformance.unknown}] missing=[${conformance.missing}]`);
  }
  if (result.success !== true) {
    fail(`extraction failed on fixture: ${JSON.stringify(result.errors)}`);
  }

  const NUM_FIELDS = ['aadhaarNumber', 'panNumber', 'epicNumber', 'dlNumber', 'cardNumber'];
  const num = NUM_FIELDS.map((f) => result.data[f]).find((v) => v != null) || null;
  const got = { num, name: result.data.name ?? null, dob: result.data.dob ?? null };
  for (const [k, want] of Object.entries(expectedSpec.expect)) {
    if (want != null && got[k] !== want) fail(`fixture value drift: ${k} expected "${want}", got "${got[k]}"`);
  }

  // A missing engine on a platform whose manifest promises it is a packaging regression, never a silent skip.
  const tier = manifest.platforms[key].tier;
  if (!result.engines) fail('engines report missing on a successful extraction');
  if (!result.engines.tesseract || !result.engines.pdfium || !result.engines.zxing) {
    fail(`base engines unavailable: ${JSON.stringify(result.engines)}`);
  }
  if (tier === 'neural' && (!result.engines.onnxruntime || !result.engines.neuralModels)) {
    fail(`manifest promises tier "neural" on ${key} but engines=${JSON.stringify(result.engines)}`);
  }

  console.log(JSON.stringify({
    selfcheck: 'doc-extractor',
    ok: true,
    platform: key,
    tier,
    filesVerified: relevant.length,
    fixture: expectedSpec.fixture,
    engines: result.engines,
  }));
})().catch((e) => fail(`unexpected: ${e && e.stack || e}`));
