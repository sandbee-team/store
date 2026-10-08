'use strict';
const fs = require('node:fs/promises'),
  path = require('node:path'),
  os = require('node:os');
async function removeUploadDirectory(directory) {
  const resolved = path.resolve(directory),
    root = path.resolve(os.tmpdir());
  if (path.dirname(resolved) !== root || !path.basename(resolved).startsWith('sandbee-ocr-'))
    throw Error('Refused cleanup outside upload directory');
  await fs.rm(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
module.exports = { removeUploadDirectory };
