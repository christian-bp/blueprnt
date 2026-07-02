# Dashboard layout enrichment: two-column grid, side cards, and a chart

**Goal:** Make the front page use its horizontal space and feel like a real dashboard: keep the welcome greeting on top, put the To-do widget in a 2/3 column with a 1/3 side column of supporting cards beside it, and add a full-width chart card below, drawing visual inspiration from the reference (grouped to-do left, informational cards right, chart at the bottom). Lean harder on the brand color for the kind of value the reference brand-tints (the To-do count).

**Context:** This builds directly on the just-shipped `welcome greeting + To-do widget` (commits `f568152..c153cd2`). The page already sits in the standard `max-w-6xl` shell container (`app-shell.tsx`), so "same max-width as other pages" is already satisfied; the single-column To-do simply wasn't using the width. recharts 3.9.0 and the shadcn `chart.tsx` are already installed, so the chart is a real shadcn chart with placeholder data (not a CSS fake), ready to swap to live data later.

## Global constraints

- Audience is HR/comp professionals only.
- All user-facing text via i18n (en source, mirrored to sv/nb/da/fi; nb/da/fi machine drafts flagged for native review). No em dashes. Terminology: **Evaluate/Evaluated**; a role's descriptive fields are its **profile**; Band 1 = highest.
- Derive, never store aggregates. Minimize layout shift; data-loading surfaces use content-shaped skeletons. Animate legitimate transitions per `docs/ui-animation.md`; respect reduced motion.
- Brand rose (`--brand`) is allowed on titles/links/CTAs and on judgement values + data viz (per the brand convention). Neutral counts stay ink UNLESS they are the primary To-do count (see below).
- Internal navigation uses the `Link` component. shadcn vendor files (`packages/ui/src/*`) are not modified.

## Layout

Inside the existing `max-w-6xl` shell container. The page becomes:

```
God morgon, Christian                          ← WelcomeGreeting (full width, unchanged)
┌───────────────────────────────┬──────────────┐
│ Att göra · 15        (lg: 2/3) │ side (1/3)   │  ← grid: lg:grid-cols-3, gap md:gap-6
│ [To-do groups]                │ [cards]      │     To-do spans 2, side spans 1
├───────────────────────────────┴──────────────┤
│ [ Roles-per-band chart card, full width ]     │
└───────────────────────────────────────────────┘
```

- Grid: one column on small screens (To-do, then side cards, then chart, stacked), `lg:grid-cols-3` on large (To-do `lg:col-span-2`, side column `lg:col-span-1`). The chart card spans the full width in its own row below.
- Uses the shell's existing vertical rhythm (`gap-4 md:gap-6`); the page wrapper stays `space-y-6` for greeting → grid → chart.

## Brand usage

- **To-do count → brand rose.** The `Att göra · N` total renders in `text-brand` (mirrors the brand-tinted count in the reference). Per-group counts stay `text-muted-foreground` (subordinate).
- The greeting stays brand (via `PageHeading`, consistent with every page title). This settles the earlier open color question.
- Chart bars use the brand palette: a single series in `--brand` rose (the reference's two blues were two years of revenue; "roles per band" is naturally one series, so one series is clearer here).

## New components (`components/overview/`)

1. **`model-readiness-card.tsx`** (real data). A compact card summarizing method documentation progress from `getMethodModel().progress` (`documented`, `approved`, `total`): a title, a small progress bar (documented and approved out of total), and a `Link` to `/model/method`. This is a progress widget, not a resurrected count card. Renders a skeleton while loading; hidden if there is no model.
2. **`getting-started-card.tsx`** (informational, the reference's support-card analog). A short guidance blurb (product ethos: guide the user) with a `Link` to the most useful next step (e.g. the model or roles). Static i18n copy; no data.
3. **`roles-per-band-chart.tsx`** (placeholder now, real later). A full-width card with a shadcn `ChartContainer` + recharts `BarChart` showing role distribution across bands 1-9, using clearly-labelled **sample** placeholder data (a small "Exempel"/"Sample" badge or muted caption so it never reads as live numbers). Brand-palette bars. Wiring to real results (each role's band from `getResults`) is a deferred follow-up.

The side column stacks `<ModelReadinessCard />` then `<GettingStartedCard />`.

## Data

No new backend. The page's existing `useTodo` already reads `listRoles` + `getMethodModel`. Provide the side-column data from the SAME two queries (Convex dedupes identical `useQuery` calls, so no extra network): either extend the overview hook to return `{ todo, stats }` or add a sibling `useOverviewStats` hook that derives `{ documented, approved, total }` (and, if used, role counts) from the same queries. The plan picks one; the aggregate is never stored. The chart uses static placeholder data (a module constant), not a query.

## i18n keys (new, under `dashboard.overview`)

- `modelReadiness.title`, `modelReadiness.documented` ("{documented}/{total} documented"), `modelReadiness.approved` ("{approved}/{total} approved"), `modelReadiness.cta` ("Open the method").
- `gettingStarted.title`, `gettingStarted.body`, `gettingStarted.cta`.
- `chart.title` ("Roles per band"), `chart.sampleBadge` ("Sample"), `chart.roles` (the series/tooltip label, "Roles"), `chart.bandAxis` ("Band") if an axis label is shown.
- Authored in en, mirrored to sv/nb/da/fi (nb/da/fi flagged for native review in the go-live checklist).

## Testing

- Component test for `ModelReadinessCard` (renders documented/approved out of total from a fixed progress prop; skeleton when loading; nothing when no model).
- Component test for `GettingStartedCard` (renders title/body/cta).
- Component test for `RolesPerBandChart` (renders the card, the sample badge, and a chart region for the placeholder data). Recharts needs a sized container in jsdom; assert on the card chrome + sample badge + presence of the chart container, not on rendered SVG bar geometry.
- Page smoke test updated for the new composition (greeting + grid + chart present).
- Any new derivation (the stats builder) is a pure function with its own unit test.

## Decisions and non-goals (this iteration)

- **Chart uses placeholder data**, clearly labelled as a sample; wiring the real band distribution from `getResults` is a separate follow-up.
- **Side column = one real progress card + one informational card**, NOT a return of the removed roles/rated/criteria count cards (that would re-introduce the overload we just cleared). If simple stat tiles are wanted instead, that is a small swap.
- **No new backend query, no stored aggregate, no max-width change** (already inherited from the shell).
- **No Prio toggle / dedicated To-do page** (still V2).
- Reduced-motion: the shadcn Accordion and Chart use CSS animation (not Motion), shared app-wide; out of scope to change here.
