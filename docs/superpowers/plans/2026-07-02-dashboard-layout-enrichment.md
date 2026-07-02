# Dashboard layout enrichment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the front page into a two-column grid (To-do 2/3 + a side column 1/3) with a full-width sample chart below, brand-tint the To-do count, and add two side cards, so the dashboard uses its width and looks like a real dashboard.

**Architecture:** Pure presentational additions in `components/overview/`. A self-contained `ModelReadinessCard` reads the existing `getMethodModel` query (deduped by Convex with the To-do's identical call, so no extra network); a `GettingStartedCard` is static; a `RolesPerBandChart` renders a shadcn/recharts bar chart over a module-constant sample dataset. `page.tsx` composes them in a responsive grid. No new backend, no stored aggregate.

**Tech Stack:** Next.js 16 client components, Convex `useQuery`, next-intl, shadcn `Chart` (recharts 3.9.0), `Progress`, `Card`, `Badge`, Vitest 4 + @testing-library/react.

## Global Constraints

- All user-facing text via i18n (en source, mirrored to sv/nb/da/fi; nb/da/fi machine drafts flagged for native review). No em dashes. Terminology: Evaluate/Evaluated; a role has a profile; Band 1 = highest.
- Derive, never store aggregates. Minimize layout shift; loading uses content-shaped skeletons. Respect reduced motion (use shared components' built-in behavior; author no custom Motion here).
- Brand rose (`--brand`) is used on the To-do count and the chart bars (data viz); other counts stay ink. `text-brand` is the class.
- Internal navigation uses `Link` from `next/link`. Do NOT modify shadcn vendor files (`packages/ui/src/*`).
- Tests: Vitest 4 (`bunx vitest run` from `apps/dashboard`); new code ships with tests in the same commit; pre-commit runs Biome + full typecheck + full tests and must pass without `--no-verify`. Work on `main`; do NOT push.
- The page already sits in the shell's `max-w-6xl` container — do not add a max-width wrapper.

---

### Task 1: i18n keys for the new cards + chart

**Files:**
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (inside `dashboard.overview`)
- Modify: `docs/go-live-checklist.md`

**Interfaces:**
- Produces the keys Tasks 2-4 read: `dashboard.overview.chart.*`, `dashboard.overview.modelReadiness.*`, `dashboard.overview.gettingStarted.*`.

Add these blocks INSIDE the existing `"overview"` object (alongside `greeting`/`todo`). Parity requires the same key set in every locale.

- [ ] **Step 1: Add to `en.json`**

```json
"chart": {
  "title": "Roles per band",
  "sampleBadge": "Sample",
  "roles": "Roles"
},
"modelReadiness": {
  "title": "Method",
  "documented": "{documented}/{total} documented",
  "approved": "{approved}/{total} approved",
  "cta": "Open the method"
},
"gettingStarted": {
  "title": "Getting started",
  "body": "Build your model, describe your roles, then evaluate them against the criteria.",
  "cta": "Go to the model"
}
```

- [ ] **Step 2: `sv.json`**

```json
"chart": { "title": "Roller per band", "sampleBadge": "Exempel", "roles": "Roller" },
"modelReadiness": {
  "title": "Metod",
  "documented": "{documented}/{total} dokumenterade",
  "approved": "{approved}/{total} godkända",
  "cta": "Öppna metoden"
},
"gettingStarted": {
  "title": "Kom igång",
  "body": "Bygg din modell, beskriv dina roller och utvärdera dem sedan mot kriterierna.",
  "cta": "Gå till modellen"
}
```

- [ ] **Step 3: `nb.json`** (machine draft)

```json
"chart": { "title": "Roller per band", "sampleBadge": "Eksempel", "roles": "Roller" },
"modelReadiness": {
  "title": "Metode",
  "documented": "{documented}/{total} dokumentert",
  "approved": "{approved}/{total} godkjent",
  "cta": "Åpne metoden"
},
"gettingStarted": {
  "title": "Kom i gang",
  "body": "Bygg modellen din, beskriv rollene dine, og vurder dem mot kriteriene.",
  "cta": "Gå til modellen"
}
```

- [ ] **Step 4: `da.json`** (machine draft)

```json
"chart": { "title": "Roller per band", "sampleBadge": "Eksempel", "roles": "Roller" },
"modelReadiness": {
  "title": "Metode",
  "documented": "{documented}/{total} dokumenteret",
  "approved": "{approved}/{total} godkendt",
  "cta": "Åbn metoden"
},
"gettingStarted": {
  "title": "Kom godt i gang",
  "body": "Byg din model, beskriv dine roller, og vurder dem mod kriterierne.",
  "cta": "Gå til modellen"
}
```

- [ ] **Step 5: `fi.json`** (machine draft)

```json
"chart": { "title": "Roolit bändeittäin", "sampleBadge": "Esimerkki", "roles": "Roolit" },
"modelReadiness": {
  "title": "Menetelmä",
  "documented": "{documented}/{total} dokumentoitu",
  "approved": "{approved}/{total} hyväksytty",
  "cta": "Avaa menetelmä"
},
"gettingStarted": {
  "title": "Aloitus",
  "body": "Rakenna mallisi, kuvaa roolisi ja arvioi ne kriteerien mukaan.",
  "cta": "Siirry malliin"
}
```

Write the strings with the Edit/Write tool as UTF-8 (never shell sed/perl — mojibake risk). Preserve the ICU `{documented}/{total}` placeholders exactly.

- [ ] **Step 6: Go-live flag** — add under "Content and localization" in `docs/go-live-checklist.md`:

```markdown
- [ ] **Native review of the dashboard side-card + chart strings.** `dashboard.overview.chart.*`, `dashboard.overview.modelReadiness.*`, and `dashboard.overview.gettingStarted.*` (sv/nb/da/fi) were machine-drafted from English. Have a native speaker review before launch.
```

- [ ] **Step 7: Verify + commit**

Run: `bunx biome check --write packages/i18n/messages/*.json`; `cd packages/i18n && bunx vitest run` (parity PASS); `bunx turbo typecheck --filter=dashboard` (PASS).

```bash
git add packages/i18n/messages docs/go-live-checklist.md
git commit -m "feat(i18n): add dashboard side-card and chart strings"
```

---

### Task 2: `RolesPerBandChart`

**Files:**
- Create: `apps/dashboard/components/overview/roles-per-band-chart.tsx`
- Test: `apps/dashboard/components/overview/roles-per-band-chart.test.tsx`

**Interfaces:**
- Consumes: `dashboard.overview.chart.*` (Task 1); `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartConfig` (`@workspace/ui/components/chart`); `Card*`, `Badge`; recharts.
- Produces: `<RolesPerBandChart />` (no props).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/dashboard/components/overview/roles-per-band-chart.test.tsx
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { RolesPerBandChart } from "@/components/overview/roles-per-band-chart"

describe("RolesPerBandChart", () => {
  afterEach(cleanup)

  it("renders the titled card, the sample badge, and a chart region", () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <RolesPerBandChart />
      </NextIntlClientProvider>
    )
    expect(screen.getByText("Roles per band")).toBeDefined()
    expect(screen.getByText("Sample")).toBeDefined()
    // The shadcn ChartContainer renders a [data-slot="chart"] wrapper; recharts
    // itself does not lay out in jsdom (zero-size container), so assert on the
    // container chrome, not on rendered bar geometry.
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd apps/dashboard && bunx vitest run components/overview/roles-per-band-chart.test.tsx`
Expected: FAIL (cannot find the component).

- [ ] **Step 3: Implement**

```tsx
// apps/dashboard/components/overview/roles-per-band-chart.tsx
"use client"

import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart"
import { useTranslations } from "next-intl"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

// Placeholder role-per-band distribution. Wiring to real results (each role's
// band from getResults) is a deferred follow-up; the "Sample" badge makes clear
// these are not live numbers. Bands run 1 (highest) to 9.
const SAMPLE_DATA = [
  { band: "1", roles: 1 },
  { band: "2", roles: 2 },
  { band: "3", roles: 4 },
  { band: "4", roles: 7 },
  { band: "5", roles: 9 },
  { band: "6", roles: 6 },
  { band: "7", roles: 4 },
  { band: "8", roles: 2 },
  { band: "9", roles: 1 },
]

export function RolesPerBandChart() {
  const t = useTranslations("dashboard.overview.chart")
  const config = {
    roles: { label: t("roles"), color: "var(--brand)" },
  } satisfies ChartConfig

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{t("title")}</CardTitle>
          <Badge variant="outline" className="text-muted-foreground">
            {t("sampleBadge")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* aspect-auto overrides the container's default aspect-video so the
            full-width card gets a fixed, reasonable height instead of a tall
            16:9 box. */}
        <ChartContainer config={config} className="aspect-auto h-64 w-full">
          <BarChart accessibilityLayer data={SAMPLE_DATA}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="band" tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="roles" fill="var(--color-roles)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd apps/dashboard && bunx vitest run components/overview/roles-per-band-chart.test.tsx`
Expected: PASS (1 test). Recharts may log a zero-dimension warning in jsdom; the `[data-slot="chart"]` assertion still holds.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/overview/roles-per-band-chart.tsx apps/dashboard/components/overview/roles-per-band-chart.test.tsx
git commit -m "feat(overview): add the roles-per-band sample chart"
```

---

### Task 3: `ModelReadinessCard`

**Files:**
- Create: `apps/dashboard/components/overview/model-readiness-card.tsx`
- Test: `apps/dashboard/components/overview/model-readiness-card.test.tsx`

**Interfaces:**
- Consumes: `dashboard.overview.modelReadiness.*` (Task 1); `getMethodModel` query; `Card*`, `Progress`, `Skeleton`, `Link`.
- Produces: `<ModelReadinessCard orgId={string} />`. Self-contained (reads `getMethodModel`, deduped with the To-do's identical call). `undefined` → skeleton; `null` (no model) → renders nothing.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/dashboard/components/overview/model-readiness-card.test.tsx
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const hoisted = vi.hoisted(() => ({
  value: undefined as unknown,
}))
vi.mock("convex/react", () => ({ useQuery: () => hoisted.value }))

import { ModelReadinessCard } from "@/components/overview/model-readiness-card"

function renderCard() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ModelReadinessCard orgId="org1" />
    </NextIntlClientProvider>
  )
}

describe("ModelReadinessCard", () => {
  afterEach(cleanup)

  it("shows a skeleton while loading", () => {
    hoisted.value = undefined
    const { container } = renderCard()
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull()
  })

  it("renders nothing when there is no model", () => {
    hoisted.value = null
    const { container } = renderCard()
    expect(container.firstChild).toBeNull()
  })

  it("renders documented and approved progress out of total", () => {
    hoisted.value = { progress: { documented: 9, approved: 5, total: 9 } }
    renderCard()
    expect(screen.getByText("9/9 documented")).toBeDefined()
    expect(screen.getByText("5/9 approved")).toBeDefined()
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd apps/dashboard && bunx vitest run components/overview/model-readiness-card.test.tsx`
Expected: FAIL (cannot find the component).

- [ ] **Step 3: Implement**

```tsx
// apps/dashboard/components/overview/model-readiness-card.tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"

// Compact method-documentation progress for the overview side column. Reads the
// same getMethodModel query the To-do derives from (Convex dedupes identical
// calls, so no extra network). undefined = loading (skeleton); null = no model
// (render nothing). Not a resurrected count card: it shows progress, not a bare
// total.
export function ModelReadinessCard({ orgId }: { orgId: string }) {
  const t = useTranslations("dashboard.overview.modelReadiness")
  const locale = useLocale()
  const method = useQuery(api.evaluationModel.method.getMethodModel, {
    orgId,
    locale,
  })

  if (method === undefined) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    )
  }
  if (method === null) return null

  const { documented, approved, total } = method.progress
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-1.5">
          <span className="text-muted-foreground">
            {t("documented", { documented, total })}
          </span>
          <Progress value={pct(documented)} />
        </div>
        <div className="space-y-1.5">
          <span className="text-muted-foreground">
            {t("approved", { approved, total })}
          </span>
          <Progress value={pct(approved)} />
        </div>
        <Link
          href="/model/method"
          className="inline-block text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          {t("cta")}
        </Link>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd apps/dashboard && bunx vitest run components/overview/model-readiness-card.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/overview/model-readiness-card.tsx apps/dashboard/components/overview/model-readiness-card.test.tsx
git commit -m "feat(overview): add the method-readiness side card"
```

---

### Task 4: `GettingStartedCard`

**Files:**
- Create: `apps/dashboard/components/overview/getting-started-card.tsx`
- Test: `apps/dashboard/components/overview/getting-started-card.test.tsx`

**Interfaces:**
- Consumes: `dashboard.overview.gettingStarted.*` (Task 1); `Card*`, `Link`.
- Produces: `<GettingStartedCard />` (no props, static).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/dashboard/components/overview/getting-started-card.test.tsx
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { GettingStartedCard } from "@/components/overview/getting-started-card"

describe("GettingStartedCard", () => {
  afterEach(cleanup)

  it("renders the title, body, and a link to the model", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <GettingStartedCard />
      </NextIntlClientProvider>
    )
    expect(screen.getByText("Getting started")).toBeDefined()
    expect(
      screen.getByText(
        "Build your model, describe your roles, then evaluate them against the criteria."
      )
    ).toBeDefined()
    const link = screen.getByRole("link", { name: "Go to the model" })
    expect(link.getAttribute("href")).toBe("/model")
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd apps/dashboard && bunx vitest run components/overview/getting-started-card.test.tsx`
Expected: FAIL (cannot find the component).

- [ ] **Step 3: Implement**

```tsx
// apps/dashboard/components/overview/getting-started-card.tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useTranslations } from "next-intl"
import Link from "next/link"

// Static guidance card for the overview side column (the reference's support-card
// analog): a short "what to do" blurb and a link into the model. Guidance is the
// product's primary goal, so the front page states the flow in plain language.
export function GettingStartedCard() {
  const t = useTranslations("dashboard.overview.gettingStarted")
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("body")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link
          href="/model"
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          {t("cta")}
        </Link>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd apps/dashboard && bunx vitest run components/overview/getting-started-card.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/overview/getting-started-card.tsx apps/dashboard/components/overview/getting-started-card.test.tsx
git commit -m "feat(overview): add the getting-started side card"
```

---

### Task 5: Page layout grid + brand To-do count

**Files:**
- Modify: `apps/dashboard/app/(app)/page.tsx` (full rewrite of the JSX layout)
- Modify: `apps/dashboard/components/overview/todo-widget.tsx` (count color)
- Modify: `apps/dashboard/app/(app)/page.test.tsx` (update the smoke tests)

**Interfaces:**
- Consumes: `WelcomeGreeting`, `TodoWidget`, `ModelReadinessCard`, `GettingStartedCard`, `RolesPerBandChart`, `useTodo`, `useOrganization`, `useLocale`, `usePageTitle`.

- [ ] **Step 1: Brand the To-do count in `todo-widget.tsx`**

Change the total-count span from ink to brand. Find:

```tsx
        {t("heading")}
        <span className="text-foreground tabular-nums">{todo.total}</span>
```

Replace with:

```tsx
        {t("heading")}
        <span className="text-brand tabular-nums">{todo.total}</span>
```

- [ ] **Step 2: Rewrite the page layout in `apps/dashboard/app/(app)/page.tsx`**

```tsx
"use client"

import { useLocale, useTranslations } from "next-intl"
import { GettingStartedCard } from "@/components/overview/getting-started-card"
import { ModelReadinessCard } from "@/components/overview/model-readiness-card"
import { RolesPerBandChart } from "@/components/overview/roles-per-band-chart"
import { TodoWidget } from "@/components/overview/todo-widget"
import { WelcomeGreeting } from "@/components/overview/welcome-greeting"
import { useOrganization } from "@/components/org-context"
import { usePageTitle } from "@/hooks/use-page-title"
import { useTodo } from "@/hooks/use-todo"

// Front page: a welcome greeting over a dashboard grid. The To-do fills two of
// three columns with a supporting side column beside it (model readiness +
// getting started), and a full-width sample chart sits below. Everything is a
// derived view; nothing is stored.
export default function OverviewPage() {
  const tNav = useTranslations("dashboard.nav")
  usePageTitle(tNav("home"))
  const { orgId } = useOrganization()
  const locale = useLocale()
  const todo = useTodo(orgId, locale)

  return (
    <div className="space-y-6">
      <WelcomeGreeting />
      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TodoWidget todo={todo} />
        </div>
        <div className="space-y-4 md:space-y-6">
          <ModelReadinessCard orgId={orgId} />
          <GettingStartedCard />
        </div>
      </div>
      <RolesPerBandChart />
    </div>
  )
}
```

- [ ] **Step 3: Update `apps/dashboard/app/(app)/page.test.tsx`**

The file already mocks `convex/react` via `@/test/convex-mocks` (a `useQueryMock(ref, args)` where `ref` is the dotted string, e.g. `"assessment.roles.listRoles"` / `"evaluationModel.method.getMethodModel"`), plus `org-context` and `auth-client`. The **existing two tests remain valid and unchanged**: in the skeleton test both queries return `undefined` (so both `TodoSkeleton` and `ModelReadinessCard`'s skeleton render); in the empty test `listRoles → []` and `getMethodModel → null` (so `ModelReadinessCard` renders nothing and the To-do shows its empty title). The new page also mounts the static `RolesPerBandChart`, so add ONE test asserting the chart renders. Insert this `it(...)` after the existing two (uses the already-imported `messages`):

```tsx
  it("renders the sample chart card", () => {
    // The chart uses static sample data, so it renders regardless of queries.
    useQueryMock.mockReturnValue(undefined)
    renderPage()
    expect(
      screen.getByText(messages.dashboard.overview.chart.title)
    ).toBeDefined()
  })
```

Do not change the existing tests, imports, mocks, or the `renderPage` helper.

- [ ] **Step 4: Verify**

Run: `cd apps/dashboard && bunx vitest run components/overview "app/(app)/page.test.tsx"`
Expected: PASS.
Run (repo root): `bunx turbo typecheck --filter=dashboard` — Expected: PASS.
Run: `bunx biome check --write "apps/dashboard/app/(app)/page.tsx" apps/dashboard/components/overview/todo-widget.tsx "apps/dashboard/app/(app)/page.test.tsx"`

- [ ] **Step 5: Commit**

```bash
git add "apps/dashboard/app/(app)/page.tsx" "apps/dashboard/app/(app)/page.test.tsx" apps/dashboard/components/overview/todo-widget.tsx
git commit -m "feat(overview): two-column dashboard grid with side cards and chart"
```

---

## Self-review notes (author)

- **Spec coverage:** grid layout 2/3+1/3 + full-width chart (T5); brand To-do count (T5) + brand chart bars (T2, via `--color-roles: var(--brand)`); model-readiness card real data (T3); getting-started card (T4); sample chart labelled "Sample" (T2); i18n all locales + go-live flag (T1); max-width unchanged (inherited). Covered.
- **Type/name consistency:** `ModelReadinessCard({orgId})`, `GettingStartedCard()`, `RolesPerBandChart()`, i18n namespaces `dashboard.overview.{chart,modelReadiness,gettingStarted}` are identical across tasks. `getMethodModel().progress = {documented, approved, total}` matches the card's destructure. `ChartConfig` color `var(--brand)` → `--color-roles` → `fill="var(--color-roles)"` chain is correct per `chart.tsx`.
- **Open confirmations for the implementer:** `Card`/`CardContent`/`CardDescription` and `Badge` are exported from their shadcn modules (they are); `Progress({value})` clamps via `translateX` (0-100 int is correct); the page's existing `page.test.tsx` helper/mocks (adapt Step 3 to its actual shape).
