'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
let loaded;
function loadEngine() {
  if (loaded) return loaded;
  const root = path.join(__dirname, '../../../vendor/doc-extractor');
  const manifestBytes = fs.readFileSync(path.join(root, 'MANIFEST.json'));
  if (
    createHash('sha256').update(manifestBytes).digest('hex') !==
    '809ecf981446cd194f5a8f3545d68cf8d98bdf5c6c5ab83971a3bc7ea2dbb7cb'
  )
    throw Error('Engine manifest integrity check failed');
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  for (const [relative, record] of Object.entries(manifest.files)) {
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) throw Error('Invalid engine manifest');
    if (createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== record.sha256)
      throw Error('Engine integrity check failed');
  }
  loaded = require(path.join(root, 'dist/index.js'));
  return loaded;
}
module.exports = { loadEngine };
