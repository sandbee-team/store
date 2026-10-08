# Sandbee Store

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers integrating GST APIs and local document OCR, business account owners, and invited employees. Confirmed roles: Owner, Admin, Developer and Viewer. Developers manage only their own keys; Owner/Admin manage workspace keys and members. Viewer has read-only access.

## Product Purpose

One Sandbee account gives access to enabled products in a shared workspace. Hosted GST runs on a separate product server. Customer OCR runs inside the customer's Node.js server; Sandbee issues startup and periodically renewed licenses. The console makes app activation, integration, document trials and access management understandable.

## Operating Context

React frontend, Node.js backend, MongoDB and Docker on existing EC2 infrastructure. Central domain store.sandbee.in; GST gstapi.sandbee.in; license API ocrapi.sandbee.in; document demo under Store origin. Use local LRU, no Redis. Original live repositories remain unchanged while this project is built locally.

## Capabilities and Constraints

Email/password identity, Gmail SMTP OTP verification and recovery, onboarding, app-specific/global keys, app activation, developer documentation and SEO. OCR token configured once, startup verification and background renewal; revoked access blocks new work within the signed lease window. No guaranteed perfect OCR, unlimited capacity or tamper-proof client licensing.

Workspace invitations, role permissions, membership removal and workspace selection are implemented. Reports must use actual events and meaningful date windows. Do not invent traffic, customers, revenue or uptime.

## Brand Commitments

Sandbee brand. User explicitly rejected the current oversized green/beige SaaS design. Replace the full UI, including auth, onboarding, dashboard, docs and studio. Maintain a compact professional product interface with reusable controls, consistent typography/colors and purposeful animation. The user delegates final design decisions after research.

## Evidence on Hand

Working local platform and product containers; integration/browser tests; synthetic PAN example. No production throughput benchmark or user usability study. Official design-system guidance and published research inform choices, not claims of measured user outcomes.

## Product Principles

- Show what a user can do next within the current workspace and role.
- Separate identity, workspace authority and product access.
- Make service-specific integration paths explicit.
- Use actual usage, distinguish hosted work from local OCR.
- Preserve original documents and existing production services.

## Confirmed Store revision (24 September 2026)

The user selected store.sandbee.in and the name Sandbee Store. Main sidebar: Dashboard, Apps, Reports, API keys, Developers, Settings. Apps must show category-grouped cards; opening an app adds its own sidebar beside the global rail. Support icon-only rail minimization, compact fonts and controls, focused Settings tabs, useful real report widgets and responsive layouts. This explicit topology supersedes the earlier overview/service-row navigation.

## Confirmed polish revision

Keep the compact Store layout and IBM Plex typography. Widen app navigation to 212px; use shared styled dropdowns, interactive request charts, a Billing destination with INR 0 and Free labels for current apps, and the existing geometric Sandbee mark in shell/favicon/loading feedback. Use small purposeful animations with reduced-motion support. Future paid services must share the workspace but require a separate payment and entitlement implementation; do not invent products, invoices or revenue. Demo authentication must use server secrets and authenticated one-use browser grants, not a publicly bundled shared secret.
