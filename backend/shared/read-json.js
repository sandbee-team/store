"use strict";
const { AppError } = require("./errors");
async function readJson(response, maxBytes = 16384) {
  if (!response.body)
    throw new AppError(
      502,
      "SERVICE_RESPONSE_INVALID",
      "Empty service response.",
    );
  const reader = response.body.getReader(),
    chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new AppError(
        502,
        "SERVICE_RESPONSE_INVALID",
        "Service response exceeded its allowed size.",
      );
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError(
      502,
      "SERVICE_RESPONSE_INVALID",
      "Invalid service response.",
    );
  }
}
module.exports = { readJson };
