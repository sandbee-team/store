---
name: "Sandbee Store"
description: "Compact workspace and app console at store.sandbee.in."
colors:
  canvas: "#ffffff"
  surface: "#f7f8fa"
  surface-hover: "#eef0f3"
  surface-selected: "#eaf0fc"
  ink: "#20242b"
  muted: "#596270"
  subtle: "#68717d"
  line: "#dfe3e8"
  line-strong: "#aeb6c2"
  accent: "#2459c4"
  accent-hover: "#1947a3"
  accent-ink: "#ffffff"
  success: "#247044"
  success-bg: "#edf7f0"
  warning: "#885814"
  warning-bg: "#fff6e6"
  danger: "#b3313b"
  danger-bg: "#fff0f1"
  chart-demo: "#138078"
typography:
  headline:
    fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif'
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  title:
    fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif'
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif'
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif'
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.5
  navigation:
    fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif'
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
  metric:
    fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif'
    fontSize: "24px"
    fontWeight: 500
    lineHeight: 1.3
  code:
    fontFamily: '"IBM Plex Mono", Consolas, monospace'
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.75
  reading-body:
    fontFamily: 'Plex, "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  reading-headline:
    fontFamily: 'Plex, "Segoe UI", sans-serif'
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.5px"
rounded:
  radius: "6px"
  radius-panel: "8px"
  badge: "4px"
  navigation: "5px"
  catalog: "7px"
  dialog: "10px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "24px"
  space-6: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.radius}"
    padding: "6px 11px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.radius}"
    padding: "6px 11px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.radius}"
    padding: "6px 11px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.radius}"
    padding: "6px 11px"
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.radius}"
    padding: "6px 10px"
  select-trigger:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.radius}"
    padding: "6px 10px"
  select-option-highlighted:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.accent}"
    rounded: "{rounded.badge}"
    padding: "7px 9px"
  navigation-active:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.accent}"
    rounded: "{rounded.navigation}"
    padding: "9px 10px"
  pill-success:
    backgroundColor: "{colors.success-bg}"
    textColor: "{colors.success}"
    rounded: "{rounded.badge}"
    padding: "2px 7px"
  panel:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.radius-panel}"
    padding: "16px"
  catalog-card:
    rounded: "{rounded.catalog}"
    padding: "18px"
---

# Design System: Sandbee Store

## Overview

**Creative North Star: "The Compact Service Store"**

Sandbee Store is a compact working console: a white workspace, light neutral navigation, graphite text and restrained blue actions. Global workspace tasks stay in the main rail; the active app receives its own adjacent menu. The interface makes service context, actual usage and the next permitted action readable without a promotional hero.

The system uses locally served IBM Plex, thin rules, small controls and flat panels. Public developer pages deliberately use a more spacious reading mode within the same visual identity. These rules describe the implemented code; the explicit Store revision supersedes the earlier workbook direction.

Authority: [PRODUCT.md](PRODUCT.md), [the approved Store direction](docs/interface-direction.md), and the [shipping review](docs/interface-review.md). Source extraction follows the actual import order in [app.css](frontend/src/styles/app.css): tokens, base, components, pages, layout, then [interaction.css](frontend/src/styles/interaction.css). Later interaction overrides win. The [polish review](docs/interface-review-polish.md) covers seven current captures and found documentation persistence to be its remaining fix. This record reconciles that source-backed refinement; the earlier shipping review remains historical and neither pass claims to review every auth or public-guide route.

**Key Characteristics:**

- Two levels of navigation with a persistent workspace context.
- Compact Plex typography, ruled data and restrained semantic color.
- Shared styled controls, visible focus and motion tied to state.
- Public documentation adapts the identity for sustained reading.

## Colors

The palette is cool, quiet and functional. Frontmatter values are normative and retain the names of [the CSS custom properties](frontend/src/styles/tokens.css). The additional `chart-demo` token records the literal series/outcome color shared by the chart and interaction stylesheet; it does not claim a new CSS custom property exists.

### Primary

- **Action blue** (`accent`) marks primary actions, links and selected navigation; `accent-hover` deepens hover and `accent-ink` supplies reversed text.
- **Selection wash** (`surface-selected`) identifies the current destination without filling the entire navigation with accent color.

### Neutral

- **Workspace white** (`canvas`) is the content ground; **navigation grey** (`surface`) separates the rail, table headings and supporting regions.
- **Hover grey** (`surface-hover`) supplies low-emphasis feedback and neutral status badges.
- **Graphite** (`ink`) carries headings and primary text. `muted` carries supporting text; `subtle` is reserved for tertiary details and placeholders.
- **Fine rule** (`line`) separates sections; **control edge** (`line-strong`) makes fields and outlined controls identifiable.

Status pairs `success`/`success-bg`, `warning`/`warning-bg` and `danger`/`danger-bg` are semantic, not extra brand accents. Labels accompany status color. [ActivityChart](frontend/src/components/charts/ActivityChart.jsx) and [interaction.css](frontend/src/styles/interaction.css) distinguish hosted OCR demo activity and successful outcomes with `chart-demo` teal. Failed outcomes use danger; unconfirmed outcomes use the strong neutral rule. These are data roles, not extra brand accents. The old gray chart rule in pages.css is superseded for the current chart and legend.

**The Action Blue Rule.** Use blue for actions, selection and the hosted GST chart series; use semantic green, amber and red for status rather than decoration.

## Typography

IBM Plex Sans is the UI family and IBM Plex Mono is for code and identifiers. [main.jsx](frontend/src/main.jsx) locally imports Sans weights 400, 500 and 600 plus Mono 400. The fallback stack is a resilience mechanism, not a separate display style. [base.css](frontend/src/styles/base.css) defines the console hierarchy; [layout.css](frontend/src/styles/layout.css) supplies the final compact overrides.

- **Headline:** `headline` for console page headings; the root rem is 16px, making the headline 20px.
- **Title:** `title` for section headings (15px); smaller subordinate headings are 14px at weight 600.
- **Body / field label:** `body` and `label` share the compact 13px size; labels use weight 500.
- **Navigation / metadata:** navigation is 12px; small status and supporting labels are 11px. Page introductions stay within 75ch.
- **Metric:** tabular 24px values at weight 500, with supporting labels and notes; these are data emphasis, not a display headline.
- **Code:** 12px Plex Mono with scrollable blocks and the `code` line height. Inline identifiers can wrap.
- **Public reading mode:** `reading-body` and `reading-headline` come from [developers.css](frontend/public/developers.css). Its locally loaded Plex aliases refer to the same IBM Plex families. Public section headings are 19px; introductory text is 16px with a 68ch measure, ordinary prose 75ch. Public h1 becomes 26px at 760px and below.

Auth retains its own composition: the final Store override makes the context heading 24px and form heading 20px. In-console guide section headings are 18px; these contextual roles do not change the main console headline token.

**The Reading Mode Rule.** Keep console work compact; preserve the larger public documentation type and reading measure instead of forcing console density into long-form guides.

## Layout

[ConsoleLayout.jsx](frontend/src/layouts/ConsoleLayout.jsx) and [layout.css](frontend/src/styles/layout.css) are the shell authority.

- Desktop global rail: 184px, fixed to the left; minimizing makes it 56px. Its preference persists in local storage. App routes add a 212px contextual rail immediately alongside it. The main area offsets by the sum of both rails.
- The top bar has a 48px minimum height and 6px 20px padding. The content area spans the available width with 20px padding. Global navigation lists Dashboard, Apps, Reports, API keys, Billing, Developers and Settings. The workspace picker uses the shared styled Select, with a 140px minimum and 220px maximum trigger width on desktop.
- Dashboard uses a flexible main column and 280px supporting column, with 16px gaps. Workspace and studio forms use 290px and 300px left columns respectively. Common panels use 16px padding and 20px bottom separation.
- App categories form two columns with 24px between groups. Cards use an auto-fit grid with a 280px minimum capped by available width, and 14px gaps. Settings uses two columns with a separate horizontal route-tab strip.
- At 1150px and below, the dashboard support column becomes 240px; studio/workspace columns adapt, and app-rail versions become one column. At 1000px the dashboard stacks, supporting widgets form two columns, and app-context settings stack.
- Reports use a 2.1fr chart column beside an outcome panel with a 270px minimum, separated by 16px; the report grid stacks at 1120px. Billing uses 1fr and 1.3fr columns with a 16px gap, stacking at 600px. Activity plots and loading placeholders are 242px high, becoming 220px at 600px.
- At 800px and below, both fixed rail offsets disappear. The global rail becomes a 240px sliding drawer, while app links appear above content and inside the drawer. Content padding is 18px 16px and the bar uses 12px horizontal padding. Settings stacks. The closed drawer is inert; opening makes the work area inert, locks body scrolling, focuses the drawer, loops Tab, supports Escape and restores focus to the opener.
- At 600px and below, dashboard support, app categories, studio/workspace and bottom grids become one column; content padding is 18px 14px, panels 15px, catalog cards 16px. Title actions and search stack. Settings and app tabs retain horizontal overflow. Tables have horizontal scrolling; pagination stacks. Select options grow from 34px to 40px minimum height, and the workspace trigger has a 170px maximum with no forced minimum.
- [pages.css](frontend/src/styles/pages.css) additionally makes the metric strip two columns at 750px, detail grids one column at 650px, and auth/docs single-column at 750px. Auth's context copy is hidden on this small layout.
- Public documentation intentionally uses its own 56px header and centered reading grid: 200px navigation beside a maximum 820px article, a 44px gap and a 1160px maximum container. At 760px it becomes a single column with wrapping navigation and 20px horizontal padding. It does not inherit the Store rails.

Spacing primitives retain the `space-1` through `space-6` names. The actual component rules also use 10px, 14px, 18px and 20px where compact alignment requires them; the system is not an exclusive four-pixel grid.

**The Two Contexts Rule.** Keep global workspace navigation separate from app navigation, with the workspace picker above the active work area.

## Elevation & Depth

Ordinary content is flat: white panels, light surface shifts and one-pixel borders carry hierarchy. [components.css](frontend/src/styles/components.css) gives modal dialogs the popover shadow (`0 8px 28px #20242b1f`) and a translucent backdrop (`#1b243554`). The selected catalog segmented button has a subtle lift (`0 1px 3px #20242b14`). The mobile navigation backdrop uses `#20242b66`. Shared Select menus use `0 8px 30px #20242b29`; chart tooltips reuse the popover shadow. Catalog hover adds a restrained 2px upward translation without a shadow. These are the observed vocabulary, not a general card-elevation scale.

**The Ruled Surface Rule.** Use borders and surface tone for ordinary panels; reserve shadows for overlays and the selected segmented control.

## Shapes

Shared controls and code containers use `radius`; panels use `radius-panel`. Status badges use `badge`, navigation uses `navigation`, and catalog cards/icons use `catalog`. Native modal dialogs use `dialog`. Borders are thin and generally solid; the OCR upload target deliberately uses a dashed control edge. Circular invitation dots and compact initial avatars are functional exceptions. Line icons come from Lucide as SVG, with typical 14-18px control icons and 24px app icons.

## Components

### Buttons

Compact and direct. [Button](frontend/src/components/ui.jsx) provides primary, secondary, ghost and danger variants, a 32px minimum height, frontmatter padding and shared rounding. Secondary buttons have a control-edge border; ghost buttons use muted text. Primary hover deepens blue, secondary hover uses the light surface, and ghost hover uses hover grey. Danger retains its fill on hover; no undocumented color is prescribed. Background/border feedback lasts 150ms. All variants inherit the visible focus outline: 2px accent with a 3px offset. Busy buttons disable repeat submission and add a 16px spinner; disabled controls use 0.55 opacity and a not-allowed cursor. Icon buttons are 32px square and require an accessible name.

### Inputs / Fields

Quiet and explicit. [Field](frontend/src/components/ui.jsx) binds its label and hint to the control with generated IDs. Standard inputs and textareas have a 34px minimum height, white ground, control-edge border and shared rounding. Focus changes the border to accent and retains the global focus-visible outline. Checkbox controls are 16px with accent selection. Do not prescribe an unimplemented per-field error border: the shared error notice is the established alert treatment.

[Select](frontend/src/components/ui/Select.jsx) is the shared Radix control used for workspace, report and form selection. Its trigger follows `select-trigger`, with a 34px minimum height, 12px internal gap, ellipsized value and 14px chevron. Hover uses the light surface; open state changes the border to accent; keyboard focus retains the common outline. The popover sits 5px from the trigger with 12px collision padding, at least trigger width, no wider than viewport minus 24px and no taller than the lesser of 320px or available space. The options viewport has 5px padding; highlighted options use the selected wash, checked options use weight 500 and a check, disabled options use 0.5 opacity. Options are 12px text with 34px minimum height (40px on small screens). Scroll controls expose overflow. The wrapper preserves labels, keyboard interaction and native form value semantics; it portals into the nearest native dialog when present and supplies the CSP nonce to the viewport. New dropdowns reuse this component rather than restyling browser-owned option menus.

### Chips

Status, not decoration. [Pill](frontend/src/components/ui.jsx) uses an 11px, weight-500 label, 1.7 line height and the `pill-success` dimensions. Green, neutral and amber variants combine meaningful text with their matching semantic backgrounds. These spans are not interactive controls; they do not acquire fabricated hover or focus behavior.

### Cards / Containers

Ruled and flat. [Section](frontend/src/components/ui/Section.jsx) groups a heading, optional description/action and children in a `panel`. [Apps](frontend/src/pages/Apps.jsx) uses category-grouped catalog cards with a 40px icon tile, status pill, linked name, description, service mode and a secondary action. Card hover strengthens the border over 150ms and translates upward 2px over 180ms using the shared easing; reduced motion removes the translation. The linked name turns accent. Catalog cards and app status include the server-provided Free pricing label. The card itself is not a clickable button. The All apps/Enabled segmented filter exposes its selection with `aria-pressed`; catalog search filters the actual name, category and mode.

### Navigation

Context is explicit. Global links pair line icons and 12px labels; selection uses a pale blue fill plus blue text and `aria-current`. The minimized rail retains accessible names and reveals text tooltips on hover or keyboard focus. Contextual app links lead to the primary tool, app keys, usage and developer guide. Settings uses a fine rule and a 2px accent underline for its current route. The mobile drawer's 200ms transform uses the shared easing curve; rail minimization itself has no invented animation. See Layout for focus and responsive behavior.

### Metrics, tables and charts

Factual and scannable. [MetricStrip](frontend/src/components/MetricStrip.jsx) uses four ruled cells on desktop, tabular values and optional notes. [UsageChart](frontend/src/components/UsageChart.jsx) lazily loads [ActivityChart](frontend/src/components/charts/ActivityChart.jsx), built with Recharts. Area/Bars segmented controls expose `aria-pressed`; the chart uses real successful-request series with blue GSTIN and teal OCR demo colors, visible legends, UTC dates and date/value tooltips. Keyboard accessibility supports arrow-key date navigation, while exact values remain available in the daily table. Stacked area uses a 0.12 fill opacity and 2px stroke; bars use solid fill, a 28px maximum size and 3px top corners. The horizontal grid uses a 3 5 dash pattern; integer axes start at zero with a minimum upper bound of two. Changes animate for 450ms unless reduced motion is requested. The on-demand loading placeholder keeps plot height stable. [ReportInsights](frontend/src/components/ReportInsights.jsx) presents real successful, failed and unconfirmed outcomes in a 12px stacked bar and ruled count/percentage list. Tables use a light header ground, 10px 12px header padding, 12px cells and fine row separators. Report tables paginate in seven daily rows while export covers the whole selected period; unavailable rates show a dash. A missing completion remains unconfirmed, not failed. Successful work may count even if a client disconnects afterward; reports retain 90 days and do not meter customer-hosted OCR. Area/bar visuals do not invent activity for empty dates. These content behaviors are recorded in [the Store direction](docs/interface-direction.md), not as fabricated sample metrics.

### Billing

Free access is explicit. [Billing](frontend/src/pages/Billing.jsx) reads the [server billing summary](backend/modules/platform/billing.js) and [catalog pricing](backend/modules/platform/catalog.js): the current free apps show INR 0, Free labels, enabled subscriptions and an empty invoices state. The balance uses 42px tabular type at weight 500 with a 1.2 line height and -1.5px tracking, reducing to 36px on small screens; the dashboard summary uses 28px. These localized money roles do not enlarge general console headings. There is no payment control or invented paid product: future paid entitlements require their own implementation.

### Brand and loading

[BrandMark and BrandLoader](frontend/src/components/Brand.jsx) reuse the existing geometric Sandbee bee vector, with its website source recorded in that file. The monochrome 64-unit SVG uses currentColor, with a 27px shell mark; [index.html](frontend/index.html) uses its SVG favicon. The loader places a 44px mark in a 76px neutral tile with 20px rounding, followed by a status label and a 100px by 2px progress track. Compact loading uses a 58px tile with 14px rounding and a 200px minimum region. `role="status"` and polite live announcement convey pending work; no artificial delay is introduced. Loading animates wing scale from 0.8 to 1 over 900ms alternating, body accent fill over 1800ms, and a 35%-width track segment from -120% to 390% over 1.5s. Only the loading instance animates; the shell mark is steady.

### Dialogs, code and task feedback

Native and contained. [Modal](frontend/src/components/ui/Modal.jsx) uses a labeled native dialog, `showModal()`, a close control and a 460px maximum width constrained to viewport width minus 32px. Maximum height is viewport minus 48px with internal scrolling. Entry translates upward from 6px over 200ms with `cubic-bezier(0.22, 1, 0.36, 1)`; busy state prevents dismissal. [Code](frontend/src/components/ui.jsx) combines a language label, copy control and scrollable code. Copy feedback changes to Copied or a manual-copy instruction. ErrorNotice uses `role="alert"`; Empty and Skeleton give purpose-specific non-data states.

[interaction.css](frontend/src/styles/interaction.css) adds a 150ms menu reveal from 0.5 opacity and -3px translation, plus a 180ms content settle from 3px below. The spinner rotates once per second while busy. The OCR scan indicator moves 60px over 1.5 seconds with ease-in-out and alternation only while processing. [base.css](frontend/src/styles/base.css) reduces animation/transition durations to 0.01ms, one animation iteration, and automatic scrolling when reduced motion is requested. The later interaction override disables loader, menu and page animations plus catalog transitions/translation entirely under reduced motion; the chart independently disables Recharts animation. Public docs disable transitions and smooth scrolling under the same preference. The sidecar records these motion extensions and self-contained samples of ten existing primitives, with synthesized swatch ramps explicitly identified as preview metadata rather than new application tokens.

## Do's and Don'ts

### Do:

- Do reuse the shared Button, Field, Select, Section, Pill, Code, Modal, MetricStrip and Brand components.
- Do retain labeled icon controls, visible focus, drawer focus management and reduced-motion behavior.
- Do display actual usage, explicit empty states and a dash for unavailable rates.
- Do keep category-grouped app cards and app-specific routes within the contextual navigation.

### Don't:

- Don't return to oversized green/beige console surfaces or decorative heroes.
- Don't invent traffic, customer counts, revenue, uptime, success rates, paid products or invoices.
- Don't replace the intentional public documentation reading layout with the console rail shell.
- Don't make collapsed navigation a source of authorization or hide its accessible labels.

Not canonized or repaired: the unreviewed public stylesheet retains a legacy `.icon` selector with text-glyph sizing. It is not a reusable icon rule; new surfaces inherit the existing SVG component practice. Hidden legacy eyebrow selectors are also not a style to inherit. Public reading density is intentional, not drift. No UI or source changes belong to this documentation pass.
