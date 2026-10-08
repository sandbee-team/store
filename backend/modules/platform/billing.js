"use strict";
const { apps } = require("./catalog");
// Current products are free. Never infer future prices or create fake invoices.
function billingSummary(workspace) {
  const enabled = new Set(workspace.enabledApps || []);
  return {
    currency: "INR",
    plan: "Free",
    amountDueMinor: 0,
    monthlyTotalMinor: 0,
    paymentRequired: false,
    invoices: [],
    subscriptions: apps
      .filter((app) => enabled.has(app.id))
      .map((app) => ({
        appId: app.id,
        name: app.name,
        path: app.path,
        ...app.pricing,
      })),
  };
}
module.exports = { billingSummary };
