"use strict";
const apps = [
  {
    id: "gst",
    name: "GSTIN",
    category: "Business data",
    description: "Registered business details through a hosted API.",
    path: "/apps/gst",
    mode: "Hosted API",
    scope: "gst:read",
    pricing: { type: "free", label: "Free", currency: "INR", amountMinor: 0 },
  },
  {
    id: "ocr",
    name: "Document OCR",
    category: "Document intelligence",
    description: "Structured document extraction on your Node.js server.",
    path: "/apps/ocr",
    mode: "Local Node.js package",
    scope: "ocr:local",
    pricing: { type: "free", label: "Free", currency: "INR", amountMinor: 0 },
  },
];
const serviceForScope = (scope) => apps.find((app) => app.scope === scope)?.id;
module.exports = { apps, serviceForScope };
