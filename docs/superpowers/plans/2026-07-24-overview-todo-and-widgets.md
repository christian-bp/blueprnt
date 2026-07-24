# Overview redesign: todo section + data widgets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the front page (`/`, "Overview") into a todo section (always-open grouped list off `buildTodo`) on top and a data-widgets section (Analytics-style cards with a full-bleed swappable viz) below.

**Architecture:** Reuse the existing uncommitted data layer verbatim; replace only the presentation. The current `overview-widgets.tsx` (which merged todo rows + narrative + a mini chart into one card type) is split into a new `todo-list.tsx` and a leaner `overview-widgets.tsx` built on a new `OverviewWidgetCard` chrome whose viz slot is an opaque `ReactNode` (a distribution today, a trend line later).

**Tech Stack:** Next.js 16 App Router, React 19, Convex, next-intl, Motion, HugeiconsIcon, shadcn card primitives (`@workspace/ui/components/card`), Vitest 4 + Testing Library.

## Global Constraints

- **No-commit mode.** Do NOT commit. Each task ends by running its tests green and leaving the tree for review. The whole change is committed once, after the human review + browser measurement, at the end.
- `bun run test` never `bun test`. Run a single dashboard test file with `cd apps/dashboard && bun run vitest run <path>`.
- i18n: `en.json` first, then idiomatic `sv/nb/da/fi`, **file-edit tool only** (never shell perl/sed — double-encodes non-ASCII). No em dashes anywhere. The i18n parity + en-purity suite (`packages/i18n`, `bun run vitest run` there) must stay green after every task that touches locale files. Machine translations are drafts; note them for native review.
- Constraint-only code comments; no decision-narration (no task numbers, dates, names).
- Skeletons MUST measure identical to loaded content (shared `min-h`, real static chrome, bars only for data). Verified by DOM `getBoundingClientRect` in Task 7, within 1px.
- Do NOT touch the reused data layer: `apps/dashboard/lib/todo.ts` (`computeCounts`/`buildTodo`/`buildOverviewStats`), `lib/band-overview.ts`, `lib/pay-mapping-headline.ts`, `lib/percent.ts`, `hooks/use-todo.ts`, `hooks/use-overview-stats.ts`, `hooks/use-band-overview.ts`, `components/overview/welcome-greeting.tsx`, `components/overview/quick-actions.tsx`. The one exception is Task 1 (extend `use-pay-mapping-headline.ts`).
- No backend / Convex wire-shape changes.

### Reused types (already exist, do not redefine)

```ts
// lib/todo.ts
type Todo = { groups: TodoGroup[]; total: number }
type TodoGroup =
  | { key: "importPeople"; items: { id: string; href: string }[]; count: number }
  | { key: "classifyPeople"; items: ClassifyItem[]; count: number }
  | { key: "describeRoles"; items: RoleItem[]; count: number }
  | { key: "evaluateRoles"; items: EvaluateItem[]; count: number }
  | { key: "documentCriteria"; items: CriterionItem[]; count: number }
  | { key: "approveCriteria"; items: CriterionItem[]; count: number }
  | { key: "startPayMapping"; items: { id: string; href: string }[]; count: number }
type ClassifyItem = { id: string; title: string | null; href: string; peopleCount: number }
type RoleItem = { id: string; title: string; href: string; family?: string }
type EvaluateItem = RoleItem & { ratedCount: number; totalCriteria: number }
type CriterionItem = { id: string; title: string; href: string; status: "notStarted" | "inProgress" | "documented" }
type OverviewStats = {
  totalPeople: number; unclassifiedCount: number
  describeCount: number; evaluateCount: number
  documentCount: number; approveCount: number
  payMapping:
    | { kind: "empty" }
    | { kind: "blocked"; blockerCount: number }
    | { kind: "open"; status: "active"|"paused"|"underReview"|"completed"; label: string }
    | { kind: "ready" }
}
// lib/band-overview.ts
type BandCount = { band: number; count: number }
type BandOverview = { totalRoles: number; bandCount: number; bandCounts: BandCount[] } // or null
```

---

## Task 1: Extend `usePayMappingHeadline` with quartiles

**Files:**
- Modify: `apps/dashboard/hooks/use-pay-mapping-headline.ts`
- Test: `apps/dashboard/hooks/use-pay-mapping-headline.test.tsx` (create if absent; else add a case)

**Interfaces:**
- Produces: `PayMappingHeadline` now additionally carries `quartiles: { women: number; men: number }[]` (four entries, lower→upper), read from the same `getPayMappingGap` result the hook already subscribes to. `null`/`undefined` semantics unchanged.

- [ ] **Step 1: Write the failing test** — mock `listPayMappingRuns` to return one active run and `getPayMappingGap` to return `{ org: { gapPct: 4.2, flag: "elevated" }, quartiles: [{women:3,men:1},{women:2,men:2},{women:1,men:3},{women:0,men:4}] }`; assert the hook returns `quartiles` with 4 entries and `quartiles[0]` `{women:3,men:1}`. Follow `use-band-overview.test.tsx` / neighboring hook-test mock conventions (`@/test/convex-mocks` `onQuery`).

- [ ] **Step 2: Run it, verify it fails** — `cd apps/dashboard && bun run vitest run hooks/use-pay-mapping-headline.test.tsx` → FAIL (`quartiles` undefined).

- [ ] **Step 3: Implement** — add to the type and the returned object:

```ts
export type PayMappingHeadline = {
  slug: string
  label: string
  status: "active" | "paused" | "underReview" | "completed"
  gapPct: number | null
  flag: PayGapFlag
  quartiles: { women: number; men: number }[]
}
// ...in the return:
  return {
    slug: target.slug,
    label: target.label,
    status: target.status,
    gapPct: gap.org.gapPct,
    flag: gap.org.flag,
    quartiles: gap.quartiles,
  }
```

- [ ] **Step 4: Run tests, verify pass** — same command → PASS.

- [ ] **Step 5: Typecheck** — `cd /Volumes/development/blueprnt/frontend && bunx tsc -p apps/dashboard --noEmit` → clean. (No commit; leave for review.)

---

## Task 2: Widget viz primitives

**Files:**
- Create: `apps/dashboard/components/overview/widget-viz.tsx`
- Test: `apps/dashboard/components/overview/widget-viz.test.tsx`

**Interfaces:**
- Produces:
  - `BandBars({ counts }: { counts: { band: number; count: number }[] })` — one `[data-testid="band-bar"][data-band][data-count]` per entry, height scaled to the max count, `bg-brand/70`, ascending, bleeding to the bottom edge.
  - `QuartileSplitBars({ quartiles }: { quartiles: { women: number; men: number }[] })` — one stacked column per quartile; each column has a `[data-testid="q-women"]` and `[data-testid="q-men"]` segment sized by share, using the gender viz tokens `bg-gender-woman` / `bg-gender-man` (the `--color-gender-*` tokens in `globals.css`, per the `chart-gender-colors` convention). Field names are `women`/`men` (matches `genderTallyShape`).
  - `SplitBar({ done, remaining }: { done: number; remaining: number })` — a single horizontal two-segment bar, `[data-testid="split-done"]` (brand) + `[data-testid="split-remaining"]` (muted), widths by share; when `done+remaining===0`, render a single flat muted track.
- All three are decorative: root `aria-hidden="true"`.

- [ ] **Step 1: Write the failing tests** — render each with a fixture; assert: `BandBars` with `[{band:1,count:2},{band:2,count:0},{band:3,count:4}]` → 3 `band-bar` nodes, the `data-band=3` node has the tallest inline height and `data-count="4"`; `QuartileSplitBars` with 4 entries → 4 columns, first column `q-women`/`q-men` present; `SplitBar` with `{done:3,remaining:9}` → both segments present, `{done:0,remaining:0}` → the flat-track branch (no `split-done`).

- [ ] **Step 2: Run, verify fail** — `cd apps/dashboard && bun run vitest run components/overview/widget-viz.test.tsx` → FAIL (module not found).

- [ ] **Step 3: Implement** — port `BandBars` from the current `overview-widgets.tsx` (same scaling: `max = Math.max(1, ...counts.map(c=>c.count))`, `height: (count/max)*100%`, `min-h-1 flex-1 rounded-t-sm bg-brand/70`, container `flex h-14 items-end gap-1 aria-hidden`). Add `QuartileSplitBars` (per column: `flex flex-col-reverse` with two segments whose `flex-grow`/height reflects women/men share of the column total; a zero-total column renders a flat muted track) and `SplitBar` (a `flex h-2 w-full overflow-hidden rounded-full` with the two width-percent segments). Use only tokens (brand, gender tokens, muted); no hex.

- [ ] **Step 4: Run, verify pass** — same command → PASS.

- [ ] **Step 5: Typecheck + biome** — `bunx tsc -p apps/dashboard --noEmit` and `bunx biome check apps/dashboard/components/overview/widget-viz.tsx apps/dashboard/components/overview/widget-viz.test.tsx` → clean.

---

## Task 3: `OverviewWidgetCard` chrome

**Files:**
- Create: `apps/dashboard/components/overview/widget-card.tsx`
- Test: `apps/dashboard/components/overview/widget-card.test.tsx`

**Interfaces:**
- Produces:

```ts
export function OverviewWidgetCard(props: {
  title: string
  headline: React.ReactNode
  badge?: React.ReactNode
  action: { label: string; href: string }
  viz: React.ReactNode
  vizLabel: string
  minH?: string // default the shared CARD_MIN_H
}): JSX.Element
```

- The card's shared min height is exported as `OVERVIEW_CARD_MIN_H` (a Tailwind class string) so the widgets and their skeletons share one value.

- [ ] **Step 1: Write the failing test** — render with `title="Band distribution"`, `headline={<>48 roles</>}`, `badge={<span>6 bands</span>}`, `action={{label:"View", href:"/work"}}`, `viz={<svg data-testid="viz"/>}`, `vizLabel="Roles per band"`. Assert: title text present; headline text present; the "View" control is a link with `href="/work"`; the viz node renders; the viz container has `aria-hidden="true"` and its labelled wrapper exposes `vizLabel` (e.g. `aria-label`).

- [ ] **Step 2: Run, verify fail** — `cd apps/dashboard && bun run vitest run components/overview/widget-card.test.tsx` → FAIL.

- [ ] **Step 3: Implement** — compose the shadcn Analytics anatomy on our primitives:

```tsx
"use client"
import { buttonVariants } from "@workspace/ui/components/button"
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import type { ReactNode } from "react"

export const OVERVIEW_CARD_MIN_H = "min-h-[188px]" // re-measured in Task 7

export function OverviewWidgetCard({
  title, headline, badge, action, viz, vizLabel, minH = OVERVIEW_CARD_MIN_H,
}: {
  title: string; headline: ReactNode; badge?: ReactNode
  action: { label: string; href: string }; viz: ReactNode; vizLabel: string; minH?: string
}) {
  return (
    <Card className={cn("flex flex-col gap-4 overflow-hidden pb-0", minH)}>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription className="flex items-center gap-2 text-foreground">
          {headline}
          {badge}
        </CardDescription>
        <CardAction>
          <Link href={action.href} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {action.label}
          </Link>
        </CardAction>
      </CardHeader>
      <div aria-label={vizLabel} className="mt-auto w-full">
        <div aria-hidden="true">{viz}</div>
      </div>
    </Card>
  )
}
```

Notes: `pb-0` + `mt-auto` push the viz to bleed to the card's bottom edge (the reference Analytics-card behavior). The "View" control is a `<Link>` styled with `buttonVariants({ variant: "outline", size: "sm" })` — the repo's existing link-as-button idiom (see `app/(app)/work/page.tsx:189`, `people-section.tsx:524`), which avoids a nested-interactive `<a><button>`.

- [ ] **Step 4: Run, verify pass** — same command → PASS.

- [ ] **Step 5: Typecheck + biome** — clean on the two files.

---

## Task 4: `OverviewWidgets` (the three data cards)

**Files:**
- Modify (full rewrite): `apps/dashboard/components/overview/overview-widgets.tsx`
- Modify (rewrite): `apps/dashboard/components/overview/overview-widgets.test.tsx`
- Modify (i18n ×5): `packages/i18n/messages/{en,sv,nb,da,fi}.json`

**Interfaces:**
- Consumes: `OverviewWidgetCard`/`OVERVIEW_CARD_MIN_H` (Task 3), `BandBars`/`QuartileSplitBars`/`SplitBar` (Task 2), `PayMappingHeadline` (Task 1), `OverviewStats`, `BandOverview`, `percentText`, `PayGapFlagBadge` (`components/pay-mapping/pay-gap-flag-badge.tsx`).
- Produces:

```ts
export function OverviewWidgets(props: {
  stats: OverviewStats | undefined
  bandOverview: BandOverview | undefined | null
  payMappingHeadline: PayMappingHeadline | undefined | null
}): JSX.Element
```

- Renders a `grid gap-3 sm:grid-cols-2 lg:grid-cols-3` of exactly THREE `OverviewWidgetCard`s (Workforce, Band distribution, Pay gap); every card always renders (graceful empty state, never omitted). Loading (`stats===undefined`) shows three skeleton cards with the real header chrome + a viz-shaped bar, all at `OVERVIEW_CARD_MIN_H`.

- [ ] **Step 1: i18n keys (en first, then sv/nb/da/fi)** — add under `dashboard.overview`:

```json
"sectionTodo": "To do",
"sectionOverview": "Overview",
"widgets": {
  "workforce": { "label": "Workforce", "view": "People", "headcount": "{count, plural, one {# person} other {# people}}", "unclassified": "{count} unclassified", "allClassified": "All classified", "importPrompt": "Import to get started" },
  "bands": { "label": "Band distribution", "view": "Job architecture", "headline": "{roles, plural, one {# role} other {# roles}} across {bands, plural, one {# band} other {# bands}}", "empty": "Evaluate roles to see the distribution" },
  "gap": { "label": "Pay gap", "view": "Open", "notStarted": "Not started", "prompt": "Start your first pay mapping", "line": "{label}" }
}
```

Mirror into `sv/nb/da/fi` (idiomatic; drafts). Run `cd packages/i18n && bun run vitest run` → parity + purity PASS.

- [ ] **Step 2: Write the failing tests** — in `overview-widgets.test.tsx` (NextIntlClientProvider + en messages), assert per a fixture:
  - Workforce card: shows headcount, the `SplitBar`, `href="/people"`; with `totalPeople:0` shows the import prompt and no split segments.
  - Band card: shows the "N roles across M bands" headline, `BandBars` with the right bar count, `href="/work"`; with `bandOverview:null` shows the empty line and no bars.
  - Pay-gap card: with a headline `{gapPct:4.2, flag:"elevated", quartiles:[...4], slug:"pay-2026", label:"Pay 2026"}` shows the percent + `PayGapFlagBadge` + `QuartileSplitBars` + `href="/pay-mappings/pay-2026"`; with `payMappingHeadline:null` shows "Not started" + the prompt + `href="/pay-mappings"`.
  - Loading: `stats:undefined` renders 3 cards with the real titles and no data values.

- [ ] **Step 3: Run, verify fail** — `cd apps/dashboard && bun run vitest run components/overview/overview-widgets.test.tsx` → FAIL.

- [ ] **Step 4: Implement** — rewrite `overview-widgets.tsx`: delete the old domain-card/rows/narrative code; keep NONE of the item-row logic (that moves to Task 5). Compose the three `OverviewWidgetCard`s. Workforce: `headline = t("workforce.headcount", {count: stats.totalPeople})`, secondary muted line `unclassified`/`allClassified`, `viz = <SplitBar done={classified} remaining={stats.unclassifiedCount} />` (classified = `stats.totalPeople - stats.unclassifiedCount`), empty when `totalPeople===0`. Band: `headline = t.rich("bands.headline", ...)` or plain `t("bands.headline", {roles, bands})`, `viz = <BandBars counts={bandOverview.bandCounts} />`, empty when `bandOverview===null`. Pay gap: measurable-gap branch (`payMappingHeadline != null && gapPct !== null && flag !== "insufficient"`) → `headline = percentText(gapPct, format)`, `badge = <PayGapFlagBadge flag=... />`, `viz = <QuartileSplitBars quartiles={payMappingHeadline.quartiles} />`, action → `/pay-mappings/${slug}`; else → `headline = t("gap.notStarted")`, prompt line, action → `/pay-mappings`. Loading branch renders 3 skeleton cards (real header via `OverviewWidgetCard` with `headline={<Skeleton .../>}` and a bar-shaped viz), all `OVERVIEW_CARD_MIN_H`.

- [ ] **Step 5: Run, verify pass** — same command → PASS.

- [ ] **Step 6: Typecheck + biome** — clean.

---

## Task 5: `TodoList` (always-open grouped list)

**Files:**
- Create: `apps/dashboard/components/overview/todo-list.tsx`
- Test: `apps/dashboard/components/overview/todo-list.test.tsx`
- Reuse i18n only (no new keys beyond `sectionTodo` added in Task 4): `dashboard.overview.todo.groups.*`, `.viewAll`, `.todo.empty.*`, `dashboard.classify.noTitle`, `dashboard.model.method.status.*`.

**Interfaces:**
- Consumes: `Todo`/group item types (`lib/todo.ts`), `MethodStatusBadge` (`components/model/method-status-badge.tsx`).
- Produces: `export function TodoList({ todo }: { todo: Todo | undefined }): JSX.Element`.

- [ ] **Step 1: Write the failing tests** — with a fixture holding a `classifyPeople` group (count 12, 2 items) and a `describeRoles` group (count 1, 1 item): assert both group headers render (icon medallion present via `.bg-muted`, title, count), the item rows render as links with correct hrefs + meta (people count / family), and the classify group shows a "view all 12" link (`count > 3`). Separately: `todo:{groups:[],total:0}` renders the all-caught-up line, no group headers. `todo:undefined` renders a skeleton (`[data-slot="skeleton"]` present, group medallion icons real).

- [ ] **Step 2: Run, verify fail** — `cd apps/dashboard && bun run vitest run components/overview/todo-list.test.tsx` → FAIL.

- [ ] **Step 3: Implement** — port the `GROUP_ICONS` map and the medallion + item-row rendering from the pre-split `overview-widgets.tsx` history (importPeople/classify→UserGroup03/Tag01, describe/evaluate→Briefcase01, document/approve→Layers01/Tick02, startPayMapping→ChartColumn; medallion = `flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4`). For each group: header (medallion + `t(\`todo.groups.${key}\`)` + right-aligned muted `group.count`), then up to 3 item rows (each a `Link`, `rounded-md px-2 py-1.5 text-sm hover:bg-muted`, truncating label + shrink-proof meta), then a "view all N" link when `group.count > 3`. classify meta = people count; describe meta = family; evaluate meta = `rated/total`; document/approve meta = `MethodStatusBadge`; importPeople/startPayMapping = single label row, no meta. `total===0` → the `todo.empty.*` line. `undefined` → skeleton with real medallions and barred titles/rows.

- [ ] **Step 4: Run, verify pass** — same command → PASS.

- [ ] **Step 5: Typecheck + biome** — clean.

---

## Task 6: Wire `page.tsx` + section labels + subtitle

**Files:**
- Modify: `apps/dashboard/app/(app)/page.tsx`
- Modify: `apps/dashboard/app/(app)/page.test.tsx`

**Interfaces:**
- Consumes: `WelcomeGreeting`, `TodoList` (Task 5), `OverviewWidgets` (Task 4), `QuickActions`, `useTodo`/`useOverviewStats`/`useBandOverview`/`usePayMappingHeadline`.

- [ ] **Step 1: Write the failing test** — update `page.test.tsx`: with a work-having fixture (mock the four `useQuery` refs as `page.test.tsx` already does), assert the "To do" section label + a todo group render AND the "Overview" section label + a widget title (e.g. Band distribution or Workforce) render. With the all-clear fixture, assert the all-caught-up line and that the widgets still render.

- [ ] **Step 2: Run, verify fail** — `cd apps/dashboard && bun run vitest run "app/(app)/page.test.tsx"` → FAIL.

- [ ] **Step 3: Implement** — rewrite the page body:

```tsx
return (
  <div className="flex flex-col gap-8">
    <div>
      <WelcomeGreeting />
      {todo === undefined ? (
        <Skeleton className="mt-2 h-4 w-64" />
      ) : (
        <p className="mt-1 text-muted-foreground text-sm">{t("subtitle", { count: todo.total })}</p>
      )}
    </div>
    <section className="flex flex-col gap-3">
      <h2 className="font-medium text-sm">{t("sectionTodo")}</h2>
      <TodoList todo={todo} />
    </section>
    <section className="flex flex-col gap-3">
      <h2 className="font-medium text-muted-foreground text-sm">{t("sectionOverview")}</h2>
      <OverviewWidgets stats={stats} bandOverview={bandOverview} payMappingHeadline={payMappingHeadline} />
    </section>
    <QuickActions />
  </div>
)
```

Keep the existing hook calls and `usePageTitle(tNav("home"))`.

- [ ] **Step 4: Run, verify pass** — same command → PASS.

- [ ] **Step 5: Full dashboard gate** — `cd /Volumes/development/blueprnt/frontend && bunx turbo run test --filter=dashboard --force` → all pass; `bunx tsc -p apps/dashboard --noEmit` → clean; `bunx biome check` on every touched file → clean. Leave uncommitted.

---

## Task 7: Layout-shift measurement + polish

**Files:**
- Adjust (if needed): `apps/dashboard/components/overview/widget-card.tsx` (`OVERVIEW_CARD_MIN_H`), `todo-list.tsx`, `overview-widgets.tsx` skeleton dimensions.

- [ ] **Step 1: Measure** — with `bun dev` running, open `/` in Chrome and, via `javascript_tool`, capture `getBoundingClientRect().height` of each widget card and todo group during the loading (skeleton) frame and after data settles (reload + immediate vs delayed measure, as done for the earlier overview cards). Also measure the tallest loaded card.

- [ ] **Step 2: Reconcile** — set `OVERVIEW_CARD_MIN_H` to the measured tallest loaded widget-card height so skeleton == loaded within 1px; confirm the todo skeleton's group/row heights match a loaded group. Re-measure to confirm no per-card growth on data arrival.

- [ ] **Step 3: Re-run the gate** — `bunx turbo run test --filter=dashboard --force`, typecheck, biome, i18n parity/purity → all green. Leave the whole change uncommitted for human review.

---

## Self-review notes

- **Spec coverage:** page structure (Task 6), TodoList (Task 5), OverviewWidgetCard chrome + swappable viz (Tasks 2-3), 3-widget set with empty states (Task 4), quartiles source via headline hook (Task 1), i18n keys (Task 4), layout-shift measurement (Task 7), reuse + no backend change (Global Constraints). No spec requirement is unmapped.
- **Removed/refactored:** the old `overview-widgets.tsx` presentation is fully rewritten (Task 4); its item-row logic moves to `TodoList` (Task 5); `BandBars` moves to `widget-viz.tsx` (Task 2). Data layer untouched.
- **Out of scope (spec):** real trend viz, live gender composition widget, any backend change.
