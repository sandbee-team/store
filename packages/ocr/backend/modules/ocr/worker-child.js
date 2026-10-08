'use strict';
const { loadEngine } = require('./engine-loader');
const { pipeline } = require('./pipeline');
let engine;
try {
  engine = loadEngine();
  process.send({ ready: true, capabilities: engine.capabilities() });
} catch {
  process.send({ startupError: true });
  process.exit(1);
}
process.on('message', async ({ id, job }) => {
  try {
    process.send({ id, result: await pipeline(job, engine) });
  } catch (error) {
    process.send({
      id,
      error: {
        code: ['MULTIPAGE_IMAGE', 'EXTRACTION_FAILED'].includes(error.code)
          ? error.code
          : 'EXTRACTION_FAILED',
        message: 'This file could not be read. Check its format, image size, and any PDF password.',
      },
    });
  }
});
