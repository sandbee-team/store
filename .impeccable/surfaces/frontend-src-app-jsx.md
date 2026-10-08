# Sandbee Store interface direction

Updated 24 September 2026 from the user's explicit revision. Product name: Sandbee Store. Production console: store.sandbee.in. The user selected the navigation topology and asked for smaller controls, useful dashboard widgets, grouped app cards, contextual app navigation, tabbed settings, responsive layouts and an icon-only minimization option.

## Direction contract

THESIS: A compact service store that keeps global workspace tasks separate from the app currently being used.

OWN-WORLD: White workspace, light neutral navigation, graphite type and restrained blue actions. Locally served IBM Plex Sans at 13px body / 20px page headings; Plex Mono for code. Small 32-34px desktop controls, 16-20px section spacing, semantic status colors and subtle rules. No decorative hero, fictitious metrics or promotional filler.

STORY: Read actual usage on Dashboard; choose Apps to browse category groups; open GSTIN or Document OCR to work within that app's own menu. Manage identity and workspace access through Settings tabs.

FIRST VIEWPORT: A persistent 184px main rail, optional 212px app rail next to it, 48px top bar with workspace selection, and full-width work area. Minimize changes the main rail to 56px with labeled icon controls. Mobile replaces both rails with an inert-when-closed, focus-managed drawer and app links above content.

FORM: The latest user explicitly selected global navigation plus contextual app navigation and grouped app cards. This supersedes the earlier team-workbook composition (historical concept seed 6e512ebd, candidate 6). No new random composition or raster comp overrides the user's instructions. Code-led execution; real data and existing authorized services determine content.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Behavior and content

Dashboard period selection updates actual 7/30/90-day aggregates. Unknown success/cache rates display a dash, not fabricated percentages. Reports use bounded seven-row pagination with complete-period CSV export. The Apps search and enabled filter operate on the actual catalog. Contextual guides and usage stay under app routes. Settings provides Profile, Workspace, Members, Invitations and Security; legacy routes remain compatible aliases.

Navigation state persists only as a local display preference. It is not authorization. Backend workspace roles, key creator permissions, app activation, rate limits and one-use grants still enforce access. Keyboard users can enter and dismiss mobile navigation; focus returns to the opener. Reduced-motion preference suppresses transitions.

## User-directed polish

The latest request preserves the compact interface while widening the app rail, replacing browser-default dropdown menus, improving reports, adding a free Billing destination and using the Sandbee mark in the shell, favicon and loading state. Recharts provides an on-demand chart bundle with area/bar selection, keyboard navigation and date/value tooltips. Outcome distribution uses real successful/failed/unconfirmed counts; no sample traffic is inserted into an account. Billing shows INR 0 for the current free apps and no fictitious invoices. Future paid products are a separate entitlement/payment implementation, not an enabled checkout in this release.

Radix Select is styled through shared controls and supports labels, keyboard selection and native form values. Its portal stays inside native dialogs when necessary. The existing geometric Sandbee bee vector is reused from the user's website, with a brief wing/body/loading-track animation only while work is pending. No artificial loading delay is introduced. IBM Plex remains the established locally served font. Motion honors reduced-motion preferences.
