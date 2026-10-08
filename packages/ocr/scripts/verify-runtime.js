"use strict";
// Run on the publisher's supported Windows x64 or Linux x64 machine before
// packing/publishing. Engine loading verifies the pinned manifest and all files.
require("../backend/modules/ocr/engine-loader").loadEngine();
console.error("OCR runtime integrity verified; no credentials or documents required.");
