# Interface research and decisions

Reviewed 22-23 September 2026. This is a product console for repeated developer and team tasks, not a campaign landing page. The user's explicit brief was compact, professional, coherent UI with reusable components and no oversized decorative treatment.

## Evidence applied

- [IBM Carbon productive typography](https://carbondesignsystem.com/elements/typography/type-sets/) distinguishes productive interfaces from expressive layouts. Applied: a 14px body, restrained heading scale, IBM Plex Sans served locally, Plex Mono only for code, and tabular numbers for reports. This is a deliberate Sandbee choice, not a claim that one font increases conversion.
- [Fluent color](https://fluent2.microsoft.design/color) and [semantic design tokens](https://fluent2.microsoft.design/design-tokens) support separate neutral, brand and status roles. Applied: cool white/light neutral surfaces, graphite text, blue selection/actions, semantic green/amber/red. Colors and spacing are shared CSS tokens rather than page-specific palettes.
- [Carbon data table guidance](https://carbondesignsystem.com/components/data-table/usage/) informed compact member/key/report tables, local actions and horizontal table scrolling on narrow screens. Reports use real UTC events and an accessible daily table rather than illustrative dashboard numbers.
- [WCAG 2.2 text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [minimum target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) informed readable secondary text, visible focus and control sizing. The AA target criterion is 24 CSS pixels with specified exceptions; it is not a universal 44px requirement. This work is not a certified WCAG audit.
- Tuch et al., 2012, [full paper](https://static.googleusercontent.com/media/research.google.com/en/us/pubs/archive/38315.pdf): reviewed the study design, findings, discussion and limitations. Lower visual complexity and familiar website structure were associated with better aesthetic first impressions in the studied screenshots. The study used passive viewing of company websites, with demographic and stimulus limits; it does not establish operational usability or a universally best color combination. Our application is an inference: keep navigation familiar, group related controls and remove decoration that competes with the task.

## Skills and references reviewed

- [Impeccable](https://impeccable.style/) / [source](https://github.com/pbakaus/impeccable): installed project-locally at `.agents/skills/impeccable`, version 4.3.1. Applied its Operate/Read modes, direction contract, bounded rendered inspection, detector, independent finish review and design-system documentation.
- [Owl-Listener designer-skills](https://github.com/Owl-Listener/designer-skills): reviewed the collection as a source of design workflows; did not import the whole collection.
- [MengTo skills](https://github.com/MengTo/skills): reviewed its UI anti-slop guidance as a quality reference; no generated assets or unrelated runtime dependencies were introduced.
- [Theme Factory](https://github.com/composio-community/awesome-codex-skills/tree/master/theme-factory): reviewed as a theme reference. Presentation themes did not define this operational console; the final tokens were selected for its own tasks.

## Resulting information architecture

Workspace selection stays in the navigation rail. Overview answers which services are enabled and what happened recently. Usage & reports separates operational history and export. Each service keeps its own workspace, app keys and guide. API keys is the cross-service key destination. Members exposes role management and invitations; My account contains identity/password controls. Public developer guides are readable without login or JavaScript.

Auth has account creation, email verification, workspace naming and service selection as distinct steps. An invited employee can join directly after verification. Document studio separates file input, extraction and structured review; the local-package installation path is explicit. Motion is limited to dialog/disclosure transitions and actual processing state, with reduced-motion support.

See `interface-direction.md` for the committed direction and `../DESIGN.md` for the final reusable system. See `verification.md` for measured checks and remaining limits.

## Store navigation revision (24 September)

The user selected a compact global rail plus a separate app menu. [Azure portal elements](https://learn.microsoft.com/en-us/azure/azure-portal/azure-portal-overview) describe the distinction between a persistent portal shell and contextual service menu. Applied: Apps is a global destination; each app owns lookup/studio, keys, usage and guide pages. This does not imply Azure feature or availability parity.

[Fluent navigation guidance](https://fluent2.microsoft.design/components/web/react/core/nav/usage) emphasizes short labels, clear grouping and minimized navigation. Its React Nav component explicitly does not provide an icon-only variant. Sandbee therefore implements its own labeled, tooltip-supported rail to meet the user's specific icon-only requirement, instead of claiming this is a supported Fluent Nav configuration.

## Store polish references

[Radix Select](https://www.radix-ui.com/primitives/docs/components/select) provides controlled/uncontrolled selection, listbox semantics, typeahead and keyboard focus handling. The Store applies its existing tokens rather than adopting a separate visual theme. Portal containment is adapted to the existing native dialogs.

[Recharts responsive containers](https://recharts.github.io/api/ResponsiveContainer/) and [accessibility guidance](https://github.com/recharts/recharts/blob/main/storybook/stories/API/Accessibility.mdx) informed the responsive, keyboard-enabled area/bar chart. Exact values remain available in the daily table and CSV; a chart is not the only way to read usage. The chart bundle is loaded on demand.

The geometric Sandbee bee comes from the user's existing website source (`src/components/site/brand-mark.tsx`), with the source website unchanged. Its monochrome Store rendition is shared between header and loading state; the favicon uses the same geometry. Fonts stay locally served IBM Plex rather than adding another family for novelty. Billing and app badges reflect the actual free product configuration.
