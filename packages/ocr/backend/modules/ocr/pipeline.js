'use strict';
const path = require('node:path'),
  sharp = require('sharp');
const { catalog, validated } = require('./catalog');
sharp.cache(false);
sharp.concurrency(1);
function mergeResults(results, type) {
  const spec = catalog.find((x) => x.id === type),
    fields = {},
    conflicts = [];
  for (const key of spec.fields) {
    const candidates = results.flatMap(({ result, variant, fileIndex }) => {
      const value = result.data?.[key];
      if (value === null || value === undefined || value === '') return [];
      return [
        {
          value: String(value),
          confidence: Math.max(
            0,
            Math.min(1, result.fieldDetails?.[key]?.confidence ?? result.confidence ?? 0),
          ),
          valid: validated(result, key),
          source: result.fieldDetails?.[key]?.validationSource || 'ocr',
          variant,
          fileIndex,
        },
      ];
    });
    const originals = candidates.filter((candidate) => candidate.variant !== 'enhanced');
    const ranked = [...candidates].sort(
      (a, b) => Number(b.valid) - Number(a.valid) || b.confidence - a.confidence,
    );
    // Preserve the native reading; recovery fills gaps and flags disagreements.
    // Confidence is not a calibrated probability and must not silently overwrite a field.
    const winner = originals.find((candidate) => candidate.valid) || originals[0] || ranked[0];
    const conflict =
      winner &&
      candidates.some(
        (c) =>
          c.valid &&
          winner.valid &&
          c.confidence >= 0.75 &&
          c.value.trim().toUpperCase() !== winner.value.trim().toUpperCase(),
      );
    if (conflict) conflicts.push(key);
    fields[key] = winner
      ? {
          ...winner,
          status: conflict
            ? 'conflict'
            : winner.valid && winner.confidence >= 0.75
              ? 'extracted'
              : 'review',
        }
      : { value: null, confidence: null, valid: false, status: 'missing', source: null };
  }
  const needsReview =
    conflicts.length > 0 ||
    [spec.identifier, spec.person].some((k) => fields[k].status !== 'extracted');
  return {
    documentType: type,
    status: needsReview ? 'needs_review' : 'ready',
    fields,
    conflicts,
    documentAuthenticity: 'not_verified',
  };
}
async function pipeline(job, engine) {
  const started = Date.now(),
    results = [],
    files = [];
  let enhancementCount = 0;
  const options = {
    enableQr: true,
    enableOcr: true,
    enablePreprocessing: true,
    enableNeural: true,
    neuralThreads: 1,
    maxPages: 3,
    timeoutMs: 12000,
    returnRawText: job.includeText === true,
    pdfPassword: job.pdfPassword || '',
  };
  for (let i = 0; i < job.files.length; i++) {
    const input = job.files[i];
    let filePath = input.path,
      metadata;
    if (input.kind !== 'pdf') {
      metadata = await sharp(filePath, { limitInputPixels: 25000000, failOn: 'error' }).metadata();
      if ((metadata.pages || 1) > 1)
        throw Object.assign(Error('Upload each image page separately, or use a PDF.'), {
          code: 'MULTIPAGE_IMAGE',
        });
      if (metadata.orientation && metadata.orientation !== 1) {
        filePath = path.join(job.directory, `oriented-${i}.png`);
        await sharp(input.path, { limitInputPixels: 25000000 }).autoOrient().png().toFile(filePath);
        enhancementCount++;
      }
    }
    const result = await engine.extract({ filePath, documentType: job.documentType, options });
    results.push({
      result,
      variant: filePath === input.path ? 'original' : 'orientation_corrected',
      fileIndex: i,
    });
    files.push({ index: i, quality: result.quality || null, source: result.source || null });
    const spec = catalog.find((x) => x.id === job.documentType);
    const missingCritical = [spec.identifier, spec.person].some(
      (k) => !result.data?.[k] || !validated(result, k),
    );
    if (
      input.kind !== 'pdf' &&
      (job.mode === 'accurate' || missingCritical || result.confidence < 0.8) &&
      Date.now() - started < 17000
    ) {
      const enhanced = path.join(job.directory, `enhanced-${i}.png`);
      await sharp(filePath, { limitInputPixels: 25000000 })
        .flatten({ background: '#ffffff' })
        .resize({
          width: 2400,
          height: 2400,
          fit: 'inside',
          withoutEnlargement: Math.max(metadata.width, metadata.height) >= 1800,
        })
        .grayscale()
        .normalise({ lower: 1, upper: 99 })
        .sharpen({ sigma: 0.6 })
        .png()
        .toFile(enhanced);
      const retry = await engine.extract({
        filePath: enhanced,
        documentType: job.documentType,
        options,
      });
      results.push({ result: retry, variant: 'enhanced', fileIndex: i });
      enhancementCount++;
    }
  }
  const output = mergeResults(results, job.documentType);
  const fatalCodes = results.flatMap((x) => x.result.errors || []).map((e) => e.code);
  if (
    results.every((x) => !Object.values(x.result.data || {}).some(Boolean)) &&
    fatalCodes.some((c) =>
      [
        'TIMEOUT',
        'OCR_FAILED',
        'INTERNAL_ERROR',
        'QUEUE_FULL',
        'UNSUPPORTED_FILE_TYPE',
        'INVALID_INPUT',
        'FILE_NOT_FOUND',
      ].includes(c),
    )
  )
    throw Object.assign(
      Error(
        'This document could not be processed. Check its format and PDF password, then try again.',
      ),
      { code: 'EXTRACTION_FAILED' },
    );
  return {
    ...output,
    files,
    meta: {
      processingMs: Date.now() - started,
      filesProcessed: job.files.length,
      enhancementPasses: enhancementCount,
      pdfPageLimit: 3,
      retention: 'deleted_after_request',
    },
    ...(job.includeText
      ? {
          text: results
            .filter((x) => x.variant !== 'enhanced')
            .map((x) => x.result.rawText || '')
            .join('\n\n'),
        }
      : {}),
  };
}
module.exports = { pipeline, mergeResults };
