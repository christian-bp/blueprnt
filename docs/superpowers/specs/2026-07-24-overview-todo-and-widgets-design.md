# Overview redesign: todo section + data widgets

**Date:** 2026-07-24
**Status:** design approved, ready for planning
**Surface:** `apps/dashboard/app/(app)/page.tsx` (the front page, route `/`, titled Overview)

## Goal

Split the front page into two clearly separated parts: a **todo section** that lists
everything that needs doing (grouped, always visible, the working area) and a
**widgets section** of data cards below it that show the org's "pretty data" in the
shadcn Analytics-card chrome (title + headline + badge + a "View" pill, with a viz
that bleeds full width to the card's bottom edge). The widget viz is a distribution
today and a swappable seam for a real trend line once run-over-run history exists.

## Context and starting point

This revises the current **uncommitted** overview rebuild before its first commit, so
there is no legacy to keep. The data layer built during that rebuild STAYS and is
reused verbatim:

- `apps/dashboard/lib/todo.ts`: `computeCounts` (one shared counting pass), `buildTodo`
  (grouped todo, `Todo`/`TodoGroup`/item types), `buildOverviewStats` (`OverviewStats`).
- `apps/dashboard/lib/band-overview.ts`: `buildBandOverview` -> `BandOverview`
  (`{ totalRoles, bandCount, bandCounts: {band,count}[] }` or `null`).
- `apps/dashboard/lib/pay-mapping-headline.ts`: `pickHeadlineRun`.
- `apps/dashboard/lib/percent.ts`: `percentText(pct, format)` (unsigned percent).
- Hooks: `use-todo.ts` (`useTodo`, `useTodoQueries`), `use-overview-stats.ts`
  (`useOverviewStats`), `use-band-overview.ts` (`useBandOverview`),
  `use-pay-mapping-headline.ts` (`usePayMappingHeadline` -> `PayMappingHeadline | undefined | null`).
- `apps/dashboard/components/overview/welcome-greeting.tsx`, `quick-actions.tsx`.

What changes: the current `overview-widgets.tsx` merged todo item rows + narrative +
a mini bar chart into one "domain card" type. That single component is **replaced by
two**: `todo-list.tsx` (the todo section) and a leaner `overview-widgets.tsx` (the
data widgets on the new `WidgetCard` chrome). No backend/wire changes.

### Data available (confirmed)

- Live, always available: `getResults` (roles with `band`, `trackKey`, `familyName`;
  plus `bands`). People counts via the todo queries (`listPeopleByTitle`).
- Run-scoped only (a run's frozen snapshot): `getPayMappingGap` returns `org`
  (`gapPct`, `flag`), `quartiles` (4 `{women,men}` tallies, lower->upper), `age`.
- NOT available: any live org-wide gender aggregate; any time-series/trend data
  (cross-run comparison is unbuilt). Therefore widget viz is distributions, never a
  trend line, until history lands. No sample/placeholder data anywhere.

## Page structure

`page.tsx` renders, top to bottom, in a `flex flex-col gap-8` full-width column:

1. **Heading block**: `WelcomeGreeting` (left-aligned, unchanged) + the muted subtitle
   line carrying `buildTodo`'s total via the existing
   `dashboard.overview.subtitle` ICU plural. While `todo === undefined`, the subtitle
   is a `Skeleton` of the same height (already the case).
2. **Todo section** (`<TodoList todo={todo} />`): a section label ("Att göra" /
   "To do") with the total count beside it, then the grouped list (see below).
3. **Widgets section** (`<OverviewWidgets ... />`): a muted section label
   ("Översikt" / "Overview"), then the widget grid (see below).
4. **Quick actions** (`<QuickActions />`, unchanged).

## Component: TodoList (`components/overview/todo-list.tsx`)

Props: `{ todo: Todo | undefined }`. Drives entirely off `buildTodo`'s groups (the
single source; no new derivation).

Presentation: always-open grouped list, no accordion. For each group in `todo.groups`
(already in priority order), render:

- A **group header row**: the domain icon in the tinted medallion (the same
  `GROUP_ICONS` map + `bg-muted` square used before: importPeople/classifyPeople ->
  UserGroup03/Tag01, describe/evaluate -> Briefcase01, document/approve -> Layers01/
  Tick02, startPayMapping -> ChartColumn), the group title
  (`dashboard.overview.todo.groups.<key>`), and the group count right-aligned muted.
- Up to **`ROW_CAP = 3` item rows** always visible, each a full-width `Link`
  (`rounded-md px-2 py-1.5 text-sm hover:bg-muted`, truncating label + shrink-proof
  right meta), reusing the group's own items:
  - classifyPeople: title (or `dashboard.classify.noTitle`) + people-count meta.
  - describeRoles: role title + family meta.
  - evaluateRoles: role title + `rated/total` progress meta.
  - documentCriteria/approveCriteria: criterion name + `MethodStatusBadge`.
  - importPeople/startPayMapping: a single row with the group's action label, no meta.
- When `group.count > ROW_CAP`, a muted **"Visa alla N"** footer link
  (`dashboard.overview.viewAll`) to the owning surface.

When `todo.total === 0`: render the section label with `0` and a single muted
"You're all caught up" line (`dashboard.overview.todo.empty.*`, reuse existing keys),
no group rows.

Loading (`todo === undefined`): a skeleton mirroring the structure. Group header
medallions render as their real muted icons (per-row chrome is static), the title +
count + item rows are bars. Row count and heights match a loaded group so nothing
reflows.

## Component: WidgetCard (`components/overview/widget-card.tsx`)

The shadcn Analytics-card chrome, generalized so the viz is swappable. Built from our
vendored card primitives (`@workspace/ui/components/card`: `Card`, `CardHeader`,
`CardTitle`, `CardDescription`, `CardAction`) and `Button` (outline, sm) for the
"View" pill. NB: there is already an app-level `components/widget-card.tsx` used
elsewhere. To avoid a name collision this new component is `OverviewWidgetCard`,
exported from `components/overview/widget-card.tsx`. Planning MUST first read the
existing `components/widget-card.tsx`: if it is genuinely the same chrome, extend it
in place instead of adding a second (and drop the `Overview` prefix); only add the
new file if the existing one is a different thing.

Props:

```
{
  title: string
  headline: ReactNode          // the big value line (e.g. "48 roles", a gap %, a count)
  badge?: ReactNode            // optional trailing chip (band count, gap flag badge)
  action: { label: string; href: string }   // the top-right "View" pill
  viz: ReactNode               // the full-bleed body; a distribution today, a trend later
  ariaLabel: string            // accessible label for the decorative viz
}
```

Layout: `CardHeader` holds `CardTitle` (title), `CardDescription` (headline + badge),
and `CardAction` (the outline `Button` as a `Link` to `action.href`). Below the
header, the `viz` fills the card's remaining width and **bleeds to the bottom edge**:
the card's bottom padding is removed and the viz sits in a fixed-aspect area
(`aspect-[...]`) touching the border, exactly like the reference Analytics card's
`pb-0` + full-width `<svg>`. The viz node is `aria-hidden` (the header carries the
meaning); `ariaLabel` is applied to the viz container as a fallback for screen
readers.

Viz seam: because `viz` is an opaque `ReactNode`, swapping a distribution for a future
`<AreaTrend .../>` changes nothing in this chrome. Each widget supplies its own viz
component (`BandBars`, `QuartileSplitBars`, `SplitBar`), and the future trend widget
supplies an area chart, with no change here.

Viz primitives (all our tokens, no hand-picked hex; brand + `--gender-man`/
`--gender-woman` for gendered data, neutral for the rest):

- `BandBars`: one bar per model band, ascending, height scaled to the max count,
  `bg-brand/70`, bleeding to the bottom edge. (Adapt the existing `BandBars` from the
  current uncommitted `overview-widgets.tsx`.)
- `QuartileSplitBars`: four stacked man/woman bars (one per pay quartile), using the
  gender viz tokens, from the run's `quartiles` tally.
- `SplitBar`: a single two-segment horizontal bar (classified vs unclassified),
  neutral + brand.

## Widget set (`components/overview/overview-widgets.tsx`)

A stable grid (`grid gap-3 sm:grid-cols-2 lg:grid-cols-3`) of exactly three widget
cards. Every card ALWAYS renders (graceful empty state, never omitted) so the grid
never reflows. Props: `{ stats, bandOverview, payMappingHeadline }` (the same hooks'
outputs; `stats`/`bandOverview` may be `undefined` = loading, `bandOverview`/
`payMappingHeadline` may be `null` = no data yet).

1. **Workforce** -> `/people`
   - headline: total people (`stats.totalPeople`).
   - badge: none (or a muted "N unclassified" is carried in the headline's secondary
     line; keep it a single card, no rows).
   - viz: `SplitBar` of classified vs unclassified.
   - empty (0 people): headline `0`, viz omitted/flat, a muted "Import to get started"
     line; the card still occupies its grid cell.
2. **Band distribution** -> `/work`  (the hero data card)
   - headline: `dashboard.overview.cards.bands.narrative`-style "N roles · M bands".
   - viz: `BandBars` from `bandOverview.bandCounts`.
   - empty (`bandOverview === null`, no evaluated role/no bands): headline muted,
     viz replaced by a muted "Evaluate roles to see the distribution" state, same cell.
3. **Pay gap** -> the headline run's overview `/pay-mappings/<slug>` (or `/pay-mappings`)
   - when `payMappingHeadline` has a measurable gap (`gapPct !== null`, flag not
     `insufficient`): headline = `percentText(gapPct, format)`, badge =
     `PayGapFlagBadge`, viz = `QuartileSplitBars` from the run's `quartiles`. Source:
     extend `usePayMappingHeadline`'s return type with `quartiles` (it already reads
     the full `getPayMappingGap` result, so this is free and adds no subscription);
     the widget reads `payMappingHeadline.quartiles`. No duplicate query, no backend
     change.
   - no run worth headlining (`payMappingHeadline === null`): a CTA card, headline =
     "Not started", viz replaced by a muted prompt, "View" -> `/pay-mappings`.

Loading: each card renders the real header chrome (title + a headline bar + the View
pill) and a bar-shaped block in the viz area; card dimensions identical to loaded
(shared `min-h`), so no layout shift.

## Layout-shift discipline (hard requirement)

Every skeleton MUST measure identical to its loaded counterpart: a shared card
`min-h`, real static chrome (icons, titles, the View pill, section labels) rendered
for real, bars only for data-dependent lines, item-row counts matching. This is
verified by measuring rendered nodes in headless/real Chrome (as done previously for
table rows and the earlier overview cards), not by eye. `getBoundingClientRect`
heights of skeleton vs loaded cards must match within 1px.

## i18n

English (`en.json`) first, then idiomatic `sv/nb/da/fi`, file-edit tool only, no em
dashes, parity + en-purity green. Reuse existing keys where they already exist
(`dashboard.overview.subtitle`, `.todo.groups.*`, `.todo.empty.*`, `.viewAll`,
`dashboard.classify.noTitle`, `dashboard.model.method.status.*`,
`dashboard.payMapping.*`). New keys, grouped under `dashboard.overview`:

- `sectionTodo` ("To do" / "Att göra"), `sectionOverview` ("Overview" / "Översikt").
- `widgets.workforce.{label,view,importPrompt,unclassified}`.
- `widgets.bands.{label,view,narrative,empty}`.
- `widgets.gap.{label,view,notStarted,prompt}`.

Machine-translated `sv/nb/da/fi` are drafts; flag for native review.

## Testing

- `TodoList`: renders each group's header + rows + hrefs from a fixture; the >3
  "view all N" branch; the all-caught-up (total 0) state; the loading skeleton shape.
- `WidgetCard`: renders title/headline/badge, the View pill href, the viz slot,
  aria-hidden viz + ariaLabel.
- `OverviewWidgets`: the three cards with values/hrefs per fixture; each card's empty
  state; the pay-gap card's measurable-gap vs no-run branches (mocked
  `payMappingHeadline`).
- Viz primitives: `BandBars`/`QuartileSplitBars`/`SplitBar` map a fixture to the right
  number of bars/segments with the right data attributes (assert data mapping, never
  pixels).
- `page.test.tsx`: updated for the new two-section anatomy; the empty-todo state shows
  the all-caught-up line and the widgets still render.
- Timers: no widget rotates, so no fake timers needed.

Follow neighboring tests' conventions (`NextIntlClientProvider` + en messages;
`@/test/convex-mocks` where a component subscribes).

## Removed / refactored

- The current uncommitted `overview-widgets.tsx` domain-card presentation is replaced
  (rows -> `TodoList`, data -> `WidgetCard` widgets). Its `overview-widgets.test.tsx`
  is rewritten to the new widget set.
- The `BandBars` from the old file moves into the widget viz set.
- All data-layer files (lib helpers, hooks), `welcome-greeting`, `quick-actions`, and
  every deletion already made in the current tree are untouched.

## Out of scope (later)

- Real trend line viz (needs run-over-run history / M3 cross-run comparison).
- A live org-wide gender composition widget (needs a new backend aggregate).
- Any backend/wire-shape change.
