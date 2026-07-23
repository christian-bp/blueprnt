# Staged survey detail: Överblick / Analysera / Rapport (P1 adjustment)

**Date:** 2026-07-13 · **Status:** approved design, pending spec review · **Scope:** reshape the uncommitted P1 gender-gap view into the staged survey flow from the competitor teardown, before committing.

## Problem

The P1 gender-gap view (built, uncommitted) renders as a flat survey detail page that leads with the two lika/likvärdigt tables. The competitor teardown (`docs/pay-mapping-analysis-teardown-and-plan.md`) established a staged Överblick -> Analysera -> Rapport flow with an Overview landing (headline gap, equality clock, gender split) as the primary framing. Reshaping the P1 slice now, while it is uncommitted, is cheaper than committing the flat page and refactoring later. The scope decision (confirmed) is "Full": introduce the staged shell AND pull the quick-win Overview and equality clock into this slice.

## Goal

Turn the survey detail into a three-tab shell (Överblick default, Analysera, Rapport). Överblick shows the survey metadata, the org-level headline gap, an animated equality clock, and a gender donut. Analysera holds the existing lika + likvärdigt tables plus the frozen population table. Rapport is a coming-soon panel. The Overview data comes from one added `org` aggregate on the existing `getPayMappingGap` query. No new statutory analysis (quartile, age, adjusted gap, objective reasons, scatter, report content) beyond the headline + clock + donut.

## Scope

**In:**
- A shadcn `Tabs` shell on the survey detail: Överblick (default) / Analysera / Rapport, with a survey status badge in the page header.
- Överblick: the survey metadata (moved from the always-on card), the org-level headline gap, the equality clock, the gender donut.
- Analysera: the existing `PayMappingGap` (Steg 1 lika + Steg 2 likvärdigt) plus the frozen population table (moved under here).
- Rapport: a plain-language coming-soon panel describing what the export will contain.
- An `org` aggregate added to `getPayMappingGap` (women/men counts + means + signed gap + flag over all priced rows), computed with the same pure engine.
- Lift the `getPayMappingGap` query to `PayMappingDetail`, issued once and passed to both the Överblick and Analysera tab contents (they become prop-driven).
- i18n for the new surfaces in all 5 locales; tests for the org aggregate, the clock formatting (incl. zero/reversed), and the tab structure.

**Out (later features from the teardown plan):**
- Quartile-by-gender and age-by-gender distributions (F1 full Overview).
- The adjusted (decomposed) gap (F7).
- Objective reasons + completion gate (F3/M6).
- The women-dominated cross-level likvärdigt comparison (F4).
- The per-person analysis scatter (F5).
- The actual report/export content (F6/M8); Rapport is a placeholder only.

## Decisions

1. **Tabs, not a stepper.** A kartläggning is revisited non-linearly; `Tabs` (revisit any stage) fits better than a linear wizard. This pulls forward the tabs CLAUDE.md had deferred to P2/P3, which is the intended vision shift.
2. **Population table under Analysera** (the underlag for the analysis), not Överblick.
3. **Rapport shown now** as a coming-soon panel (states its precondition in words, per the guidance rule), not omitted.
4. **Equality clock framed honestly by direction:** it states which gender is behind and reads "no measurable gap" near zero; it does not assume women are always behind.
5. **Unadjusted only.** The clock and headline use the unadjusted gap; the adjusted/decomposed version is the later F7.
6. **Org aggregate is not small-cell masked.** Unlike a small comparison group, the org-level mean is a population aggregate (not an individual salary), so its means are returned as-is; `classifyPayGap` still runs so an org with a missing gender reads as "not enough data" rather than a spurious gap. (Revision 6 note: originally "missing gender or under 4 people"; the size floor was removed in-app by the ADR-0012 amendment.)

## Design

### 1. Data: the `org` aggregate on `getPayMappingGap`

Extend the query's return with an `org` object computed once over all priced rows (the same rows already collected), via `computeGenderGap` (no per-group masking applied):

```ts
org: {
  womenCount: number
  menCount: number
  womenMeanComp: number | null
  menMeanComp: number | null
  gapPct: number | null   // signed; positive = women earn less
  flag: PayGapFlag         // classifyPayGap over the whole population
}
```

The existing `currency`, `lika`, `likvardigt`, `unbandedCount` stay. The wire validator gains `org`, a dedicated `orgAggregateShape` validator (`womenCount`, `menCount`, `womenMeanComp`, `menMeanComp`, `gapPct`, `flag`). Requires `bunx convex codegen` and staging `_generated/api.d.ts`. The org means are the population averages of FTE-adjusted total comp; the donut counts are `org.womenCount` / `org.menCount`.

### 2. The tab shell (`PayMappingDetail`)

`PayMappingDetail` becomes the shell:
- `PageHeader` (breadcrumb + title) gains a survey **status badge** next to the title (`t("status.<status>")`, the existing key).
- A shadcn `Tabs` with three triggers (Överblick default, Analysera, Rapport). Tab labels are new i18n keys.
- `PayMappingDetail` issues `getPayMappingGap` once (it holds the resolved `run.runId`) and passes the result (or `undefined` while loading) to the Överblick and Analysera contents. Each renders its own content-shaped skeleton while `gap` is `undefined`.
- `PayMappingGap` changes from issuing the query to receiving `gap` as a prop (presentational); its skeleton, flag tables, summary, and unbanded note are unchanged otherwise.

### 3. Överblick (`PayMappingOverview`)

Receives `run` (metadata) and `gap` (for `gap.org`). Renders, top to bottom:
- The survey **metadata** grid (reference date, started by, population / with-pay / excluded counts), reusing the existing `MetaField`.
- The **headline gap**: the org gap % shown large in its flag colour (via the flag mapping already built), the women mean and men mean (money-formatted with `gap.currency`), and a plain-language sentence. When `gap.org.flag === "insufficient"` (a gender is missing; the under-4 floor was removed by revision 6), show a "not enough data for an org-level gap" line instead of a gap.
- The **equality clock** (`EqualityClock`), see below.
- The **gender donut**: a recharts pie (from our chart kit) using the `--gender-man` / `--gender-woman` tokens, labelled women/men with count + percent, centered total = the population count.

Skeleton mirrors this layout (static labels/headers real, data as bars), per the skeleton rule.

### 4. The equality clock (`EqualityClock`)

Pure derivation + an animated display. Given the signed `gapPct`:
- Unpaid daily time = `|gapPct| / 100 * WORKDAY_SECONDS`, where `WORKDAY_SECONDS = 8 * 3600` (an 8-hour workday, the explainable convention). Formatted `HH:MM:SS`.
- Direction from the sign: positive -> women are behind ("women effectively work HH:MM:SS per day unpaid compared to men"); negative -> men behind; `gapPct === null` or `|gapPct|` rounding to 0 seconds -> "no measurable pay gap".
- Animated count (Motion), respecting reduced motion. A one-line inline explanation + a HelpMorphButton for the concept.
- The formatting (seconds -> HH:MM:SS, direction, zero case) is a pure helper, unit-tested without the DOM.

### 5. Rapport (`PayMappingReport` placeholder)

A single panel: a heading plus a plain-language description of what the report will contain (the summary for union/employer sign-off, the per-employee and actions exports, the Art. 9 filing) and that it is coming. All i18n. No download controls yet.

### 6. i18n

New keys (all 5 locales, en first): `dashboard.payMapping.tabs.{overview,analysis,report}`; `dashboard.payMapping.overview.{headlineGapLabel,womenMean,menMean,headlineSentence,insufficient,donutTitle,women,men}`; `dashboard.payMapping.clock.{label,womenBehind,menBehind,noGap,explanation}`; `dashboard.payMapping.report.{comingSoonTitle,comingSoonBody}`; help keys `dashboard.help.{equalityClockLabel,equalityClockBody,headlineGapLabel,headlineGapBody}`. Nordic strings are drafts flagged for native review. Locale JSON edited with the Edit tool only.

### File structure

- Modify `packages/backend/convex/payMapping/gap.ts` (+ `gap.test.ts`): add the `org` aggregate; codegen + stage `api.d.ts`.
- Modify `apps/dashboard/components/pay-mapping/pay-mapping-gap.tsx`: `PayMappingGap` takes `gap` as a prop (presentational).
- Modify `apps/dashboard/components/pay-mapping/pay-mapping-detail.tsx`: the tab shell + status badge; issue `getPayMappingGap` once; host the tabs; population under Analysera.
- Modify `apps/dashboard/app/(app)/pay-mappings/[slug]/page.tsx`: update `PayMappingDetailSkeleton` (shown while the run query loads) to mirror the new tab shell (the tab bar renders real; Överblick's default content shaped as the loading skeleton).
- Create `apps/dashboard/components/pay-mapping/pay-mapping-overview.tsx` (+ test): headline + donut + metadata, hosting the clock.
- Create `apps/dashboard/components/pay-mapping/equality-clock.tsx` (+ a pure formatter + test).
- Create `apps/dashboard/components/pay-mapping/pay-mapping-report.tsx`: the placeholder.
- Modify the five `packages/i18n/messages/*.json`.

### Testing

- **Backend `gap.test.ts`:** the `org` aggregate over a known population (means, signed gap, flag); the insufficient case (missing a gender -> flag insufficient, no spurious gap); org means are NOT masked (a valid population returns real means).
- **`equality-clock` pure test:** seconds/format for a positive gap, a negative gap (men behind), and a near-zero gap (no gap); `HH:MM:SS` formatting incl. > 1 hour.
- **`pay-mapping-overview` test:** the headline gap + donut render; the insufficient branch shows the not-enough-data line; static labels present.
- **`pay-mapping-detail` test:** the three tabs render; Överblick is default; the population table lives under Analysera; the status badge shows. Update the existing detail test for the new structure.
- **`pay-mapping-gap` test:** now prop-driven (pass `gap` directly), existing assertions preserved.

New code ships with tests in the same commit; the pre-commit hook runs Biome + typecheck + the full `turbo run test`.

## Revision 2026-07-15: routed sub-pages instead of in-page tabs

Review feedback: the stages should be pages in the top bar, matching the app's other sections (People, Organization, Model), not an in-page `Tabs` component. The staged structure, content, and data flow above stand; the shell changed:

- **Routes:** `/pay-mappings/[slug]` (Overview, the index), `/pay-mappings/[slug]/analysis`, `/pay-mappings/[slug]/report`.
- **Top bar:** a `PayMappingTabs` header nav (mirrors `PeopleTabs`: Link tabs, sliding underline, `aria-current`), mounted by `SiteHeader` only inside a run (a slug segment exists); the `/pay-mappings` list keeps its plain header. Labels reuse `dashboard.payMapping.tabs.*`.
- **Shared chrome + data:** `[slug]/layout.tsx` is a thin `use(params)` wrapper around `PayMappingRunShell`, which resolves the run by slug, issues `getPayMappingGap` once (skipped until the run resolves), renders the `PageHeader` (breadcrumb, title, status badge, help) and the not-found state, and provides `{run, gap}` to the pages via `PayMappingRunProvider` / `usePayMappingRun()`. The layout persists across sub-page navigation, so the Convex subscriptions stay mounted and switching pages never re-fetches or flashes a skeleton.
- **Pages:** thin wrappers; the Overview and population loading shapes moved next to the components they mirror (`PayMappingOverviewSkeleton`, `PayMappingPopulationSkeleton`). `PayMappingDetail` and the in-page `Tabs` shell were deleted (no legacy pre-launch); the shared types stay in `pay-mapping-gap-types.ts`.
- A bonus over the in-page tabs: the header tab bar derives from the URL, so it is real static chrome from the first paint, even while the run loads.

## Revision 2026-07-15 (2): the Överblick becomes a widget grid

Review feedback against the competitor's overview: the Överblick should be a grid of smaller, widget-like stat components (one focal statistic or chart per compact card), not stacked full-width sections. `PayMappingOverview` was refactored to a responsive grid (2-up on md, 3-up on xl) of five widgets, each a card with a real static title + inline help and its own honest loading/insufficient state:

1. **Lönegap**: the signed org gap % + the severity flag chip, with two mini gender-mean bars (gender tokens) and the money-formatted means.
2. **Jämställdhetsklocka**: restyled to competitor-style digit boxes (hours : minutes : seconds, unit labels beneath; a shared pure `clockUnits` drives both the boxes and the sentence). Gated as before: renders only with a real computed gap.
3. **Flaggade grupper** (our addition, not in the competitor's overview): the analysed lika + likvärdigt groups counted per severity flag, the unbanded remainder, and a link into the analysis page. Ties the overview to the statutory P1 work.
4. **Könsfördelning**: the donut + a text legend (shared gender-row component) + the priced-population total.
5. **Kartläggningen**: the survey facts (reference date, started by, population, with-pay, excluded) as label/value rows.

Consequences: `PayMappingOverview` now takes `run: PayMappingRunDetail | undefined` and every widget renders its real title while loading with bars only for values, so the separate `PayMappingOverviewSkeleton` and the `MetaField` component were deleted (the Overview page renders the component unconditionally). New i18n keys: `overview.flagSummaryTitle` / `surveyTitle` / `viewAnalysis`, `clock.hours` / `minutes` / `seconds` (all 5 locales). The flag-scale help is reused on the flag widget; quartile/age (F1) and the adjusted gap + adjusted clock (F7) are follow-up widgets that slot into the same grid.

## Revision 2026-07-16 (3): shadcn-dashboard shape, WidgetCard, distributions

Further review feedback: graphs should say enough without much text, widget sizes should vary, the survey-facts card is unnecessary, and the layout should read as a shadcn dashboard rather than a copy of the competitor's uniform mosaic. Changes:

1. **Layout**: a KPI strip (Lönegap, Jämställdhetsklocka, Flaggade grupper) over a row of three expandable distribution charts (Hela kartläggningen, Könsfördelning utifrån lönenivå, Åldersfördelning).
2. **The Kartläggning facts widget was cut**; the donut card became "Hela kartläggningen": the whole frozen population's gender donut with a prominent headcount beside it (a new `population` gender tally on the wire; the donut total IS the survey population). `PayMappingOverview` now takes only `gap`.
3. **Flaggade grupper became a KPI**: the red+amber count as the big figure with a needs-attention line, the critical/elevated chips with counts, the unbanded note, and the analysis link (ok/insufficient detail lives in the analysis).
4. **New distributions** (the remaining F1): per-pay-quartile gender split (pure `quartileGenderTallies` in core; horizontal stacked bars, upper quartile on top, with glass-ceiling help) and age-by-gender (pure `ageGenderTallies` + `AGE_BUCKETS`; ages at the frozen `referenceDate`; unknown birth dates stated). Headcounts only, no masking.
5. **The equality clock** became competitor-style digit boxes (hours : minutes : seconds) whose sentence names only the direction (an sr-only HH:MM:SS keeps the value for assistive tech); i18n shortened in all locales.
6. **`WidgetCard`**, a new app primitive at the components root: title + inline help + a trailing header slot + an optional expand affordance opening a large dialog with a bigger render (`expandedChildren`, falling back to the card children). Used by all overview widgets and by the person page's pay-comparison plotter (always expandable there so its header chrome stays static across loading/precondition/chart states). Every future chart gets fullscreen for free.

## Revision 2026-07-16 (4): standard shadcn charts

A custom chart family (dumbbell, person-waffle, share-dot rows, population pyramid) was explored to differentiate from the competitor, then rolled back on review feedback: it forced novel forms where standard ones read more easily. Final decision: the distribution charts use **standard shadcn chart types with their normal anatomy** (ChartContainer + `ChartTooltip`/`ChartTooltipContent` on hover + `ChartLegend`), keeping simplicity as the point:

1. **Hela kartläggningen**: the standard gender donut, with the prominent headcount and count/share rows beside it.
2. **Könsfördelning utifrån lönenivå**: the standard horizontal stacked bar chart (upper quartile on top), exact counts on hover.
3. **Åldersfördelning**: the standard multiple bar chart per age band, counts on hover.
4. **Lönegap (KPI)**: no mini chart; the signed percent + flag chip with the two money-formatted means as text rows.

Differentiation comes from the dashboard shape (the KPI strip incl. the flag summary), the WidgetCard fullscreen expand, inline plain-language help, and the shadcn look with our tokens, not from exotic chart forms. Unchanged: the equality clock digit boxes, the flag KPI, the plotter. Gender is never color-alone (axis labels, legends, text rows).

## Revision 2026-07-16 (5): master-detail analysis

Review feedback against the competitor's Analysera screens: they have no long flat tables; the analysis is a master-detail split into Lika arbeten and Likvärdiga arbeten, a group worklist beside one selected group's analysis, which is also the surface the objective-reasons workflow lives on. The Analysis page was rebuilt accordingly (`PayMappingAnalysis` replaces the two flat gap tables; no backend changes):

- **Sub-tabs** Lika arbeten / Likvärdigt arbete on the page (a view switch, not a route), each with its one-line description + concept help.
- **The worklist** (left): every group with its flag chip, searchable, sorted **attention-first** (worst flag, then widest gap; better than the competitor's alphabetical list). The Ej klara/Klara done-state arrives with M6, turning this list into the ADR-0012 completion checklist.
- **The detail** (right): the selected group's figures as a stat grid (counts, means, signed gap; the masked explanation for ⚪ groups). Lika adds the group's own frozen members (scoped and short, no pagination); likvärdigt adds the band's composition, the lika groups the evaluation weighs as equivalent, each with counts/gap/flag. The unbanded note sits under the likvärdigt worklist. The M6 reasons form + Klarmarkerad slot into the detail panel.
- The full population register stays below as the underlag. The `gap.summary` key retired with the flat tables; new keys `gap.searchGroups`, `groupMembers`, `bandRoles` (all 5 locales).

## Revision 2026-07-16 (6): routed analysis sub-nav, header run indicator, loose in-app masking

Five adjustments after reviewing the master-detail analysis live:

1. **The population table is gone.** "Personer som ingår" under the analysis was deleted outright (`PayMappingPopulation` + its test + its i18n keys `detail.searchPlaceholder`, `detail.columns.role/band/level`); the lika detail's scoped member list is the only person-level surface the analysis needs. No other consumer existed.
2. **Single-gender groups are hidden from the worklist, honestly.** ⚪ groups no longer appear in the left list (there is no woman-man comparison to work through); a note under the list always states the hidden count (`gap.singleGenderHidden`, ICU plural, all 5 locales). They stay visible in the likvärdigt band composition, and they return as documentable entries with M6 (the ADR-0012 gate still requires motivating them).
3. **The in-app masking threshold dropped to at least 1 woman + 1 man** (ADR-0012 amendment 2026-07-16). `MIN_GROUP_SIZE` was deleted from the core engine; `classifyPayGap` returns ⚪ only when a gender is missing. The full small-cell minimums (4 total, 2 per gender) move wholesale to the Art. 9 export boundary (go-live checklist entry updated). The GroupStats masked branch and the `gap.masked` key retired with it.
4. **The analysis sub-tabs became routes in a header submenu.** `/analysis` (lika index) and `/analysis/likvardigt` are real pages sharing `PayMappingAnalysis` via a `view` prop; the in-page Tabs switch is gone. The site header grows a second row (`PayMappingAnalysisTabs`) that unfolds with an AnimatePresence height animation (per docs/ui-animation.md rule 2: geometry only on the motion wrapper, border/padding on the inner div) whenever the path is inside the run's Analysis section.
5. **The site header owns the whole workspace chrome; the pages carry only a sub-page title.** The run's name and status sit in the header's right corner (`PayMappingRunIndicator`, the competitor's period-indicator corner; the run query is shared with the run shell's subscription; hidden below sm, where the sidebar item remains the way back; no HelpMorphButton since the concept help stays on the list page where the term is introduced). The corner doubles as the **run switcher** (the GitHub/Vercel context-switcher pattern): clicking the label + status + chevron opens a DropdownMenu listing the org's kartläggningar (`listPayMappingRuns`, mount-time subscription so the menu is complete when opened; the active run marked with a tick and `aria-current`), each item linking to the SAME sub-page in the chosen run (comparing a view across years is the point), plus a separated "All pay mappings" item (`switcher.all`; `switcher.label` heads the group; both new keys in all 5 locales) back to the list. A standalone back arrow was tried and removed in favor of this. The run pages have NO breadcrumb: the kartläggning trail is always exactly two levels and the leaf duplicated the corner, so the switcher replaces it, while roles/person pages keep breadcrumbs (their trails encode real hierarchies, e.g. Roller > Familj > Roll). Each page renders the standard `PageHeader` with the SUB-PAGE's name as the title (Överblick/Analys/Rapport via `payMappingSubPageKey` from the tabs' single source of truth; static i18n so it is real from the first paint). Identity and navigation in the corner, sub-page in the title: nothing repeats.

## Follow-ups (tracked)

- The full Overview (quartile-by-gender, age-by-gender) is F1; the adjusted gap is F7; objective reasons + the completion gate are F3/M6; the report content is F6/M8. Rapport stays a placeholder until F6.
- Nordic overview/clock/report strings -> native review.
- Update the roadmap tracker after this lands (Overview + equality clock move from queued to built on M5).
