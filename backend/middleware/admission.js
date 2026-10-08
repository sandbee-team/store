"use strict";
const { AppError } = require("../shared/errors");
// Restricts simultaneous expensive authentication work across all client IPs.
function admission(max) {
  let active = 0;
  return async function run(task) {
    if (active >= max)
      throw new AppError(
        503,
        "SERVICE_BUSY",
        "All secure processing slots are busy. Please retry shortly.",
      );
    active++;
    try {
      return await task();
    } finally {
      active--;
    }
  };
}
module.exports = { admission };
