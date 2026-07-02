# Dashboard welcome greeting + "To do" widget — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the front page's passive count cards with a personal welcome greeting and one actionable "To do" widget (roles to describe, roles to evaluate, criteria to document, criteria to approve), grouped and deep-linked.

**Architecture:** Pure `buildTodo` over the existing `listRoles` + `getMethodModel` reactive queries (no new backend, no stored aggregate); a thin `useTodo` hook wires it; presentational `components/overview/*` render the greeting and the grouped, expandable list.

**Tech Stack:** Next.js 16 (App Router, client components), Convex (`useQuery`), next-intl, better-auth (`authClient.useSession`), shadcn `Accordion`/`Empty`/`Badge`, Motion (via the vendor Accordion's CSS animation), Vitest 4 + @testing-library/react.

## Global Constraints

- All user-facing text via i18n; English source in `packages/i18n/messages/en.json`, mirrored to sv, nb, da, fi. New nb/da/fi are machine drafts flagged for native review.
- No em dashes in copy. The act is **Evaluate/Evaluated** (per locale: en "Evaluate", sv "Utvärdera", nb/da "Vurder", fi "Arvioi"); a role's descriptive fields are its **profile**.
- Never store the aggregate (derive only). Minimize layout shift; loading uses a content-shaped skeleton. Counts render in ink (foreground), not brand (matches the old overview rule).
- Internal navigation uses `Link` from `next/link` (matches the current page; locale is not in these paths).
- Tests: Vitest 4 only (`bun run test`); every package with tests has its own `vitest.config.ts`. New code ships with tests in the same commit. Pre-commit runs Biome + typecheck + full test suite.
- Audience is HR only. `MAX_ITEMS = 4` per group.

---

### Task 1: `greetingBucket` pure function

**Files:**
- Create: `apps/dashboard/lib/greeting.ts`
- Test: `apps/dashboard/lib/greeting.test.ts`

**Interfaces:**
- Produces: `type GreetingBucket = "morning" | "afternoon" | "evening"` and `greetingBucket(hour: number): GreetingBucket`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/dashboard/lib/greeting.test.ts
import { describe, expect, it } from "vitest"
import { greetingBucket } from "./greeting"

describe("greetingBucket", () => {
  it("maps the hour to a bucket at the boundaries", () => {
    expect(greetingBucket(4)).toBe("evening")
    expect(greetingBucket(5)).toBe("morning")
    expect(greetingBucket(11)).toBe("morning")
    expect(greetingBucket(12)).toBe("afternoon")
    expect(greetingBucket(16)).toBe("afternoon")
    expect(greetingBucket(17)).toBe("evening")
    expect(greetingBucket(23)).toBe("evening")
    expect(greetingBucket(0)).toBe("evening")
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd apps/dashboard && bunx vitest run lib/greeting.test.ts`
Expected: FAIL (cannot find `./greeting`).

- [ ] **Step 3: Implement**

```ts
// apps/dashboard/lib/greeting.ts
// Time-of-day bucket for the front-page welcome greeting. Boundaries match the
// midday reference: morning 5-11, afternoon 12-16, evening 17-4. Pure so it is
// deterministic and unit-tested; the component supplies the browser-local hour.
export type GreetingBucket = "morning" | "afternoon" | "evening"

export function greetingBucket(hour: number): GreetingBucket {
  if (hour >= 5 && hour < 12) return "morning"
  if (hour >= 12 && hour < 17) return "afternoon"
  return "evening"
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd apps/dashboard && bunx vitest run lib/greeting.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/lib/greeting.ts apps/dashboard/lib/greeting.test.ts
git commit -m "feat(overview): add the greeting time-of-day bucket helper"
```

---

### Task 2: `buildTodo` pure function + types

**Files:**
- Create: `apps/dashboard/lib/todo.ts`
- Test: `apps/dashboard/lib/todo.test.ts`

**Interfaces:**
- Produces the To do contract consumed by Tasks 4-6:

```ts
type TodoGroupKey = "describeRoles" | "evaluateRoles" | "documentCriteria" | "approveCriteria"
type RoleItem = { id: string; title: string; href: string; family?: string }
type EvaluateItem = { id: string; title: string; href: string; family?: string; ratedCount: number; totalCriteria: number }
type CriterionItem = { id: string; title: string; href: string; status: "notStarted" | "inProgress" | "documented" }
type TodoGroup =
  | { key: "describeRoles"; items: RoleItem[]; count: number }
  | { key: "evaluateRoles"; items: EvaluateItem[]; count: number }
  | { key: "documentCriteria"; items: CriterionItem[]; count: number }
  | { key: "approveCriteria"; items: CriterionItem[]; count: number }
type Todo = { groups: TodoGroup[]; total: number }
buildTodo(input: BuildTodoInput): Todo
```
- Consumes: shapes that the Convex results structurally satisfy (see `TodoRole`/`TodoMethod` below). The Convex return types are supersets, so `useTodo` (Task 6) passes them directly.

- [ ] **Step 1: Write the failing test**

```ts
// apps/dashboard/lib/todo.test.ts
import { describe, expect, it } from "vitest"
import { buildTodo, MAX_ITEMS } from "./todo"

const role = (over: Partial<Parameters<typeof buildTodo>[0]["roles"][number]> = {}) => ({
  roleId: "r1",
  title: "Backend Engineer",
  slug: "backend-engineer",
  ratedCount: 0,
  totalCriteria: 9,
  profileComplete: true,
  familyName: "Engineering",
  ...over,
})

const method = (
  criteria: { criterionId: string; name: string; status: "notStarted" | "inProgress" | "documented" | "approved" }[]
) => ({ criteria })

describe("buildTodo", () => {
  it("routes a profile-incomplete role to describeRoles only (the gate)", () => {
    const todo = buildTodo({
      roles: [role({ roleId: "r1", profileComplete: false, ratedCount: 0, totalCriteria: 9 })],
      method: null,
    })
    expect(todo.groups.map((g) => g.key)).toEqual(["describeRoles"])
    expect(todo.groups[0]?.items[0]?.href).toBe("/roles/backend-engineer")
    expect(todo.total).toBe(1)
  })

  it("routes a profiled, partly-rated role to evaluateRoles with progress + rate link", () => {
    const todo = buildTodo({
      roles: [role({ profileComplete: true, ratedCount: 3, totalCriteria: 9 })],
      method: null,
    })
    const g = todo.groups.find((g) => g.key === "evaluateRoles")
    expect(g?.key).toBe("evaluateRoles")
    const item = g?.items[0] as { href: string; ratedCount: number; totalCriteria: number }
    expect(item.href).toBe("/roles/backend-engineer/rate")
    expect(item.ratedCount).toBe(3)
    expect(item.totalCriteria).toBe(9)
  })

  it("excludes a profiled, fully-rated role from every group", () => {
    const todo = buildTodo({
      roles: [role({ profileComplete: true, ratedCount: 9, totalCriteria: 9 })],
      method: null,
    })
    expect(todo.total).toBe(0)
    expect(todo.groups).toEqual([])
  })

  it("splits criteria into document (notStarted/inProgress) and approve (documented); approved is done", () => {
    const todo = buildTodo({
      roles: [],
      method: method([
        { criterionId: "c1", name: "Scope", status: "notStarted" },
        { criterionId: "c2", name: "Risk", status: "inProgress" },
        { criterionId: "c3", name: "Autonomy", status: "documented" },
        { criterionId: "c4", name: "Knowledge", status: "approved" },
      ]),
    })
    const doc = todo.groups.find((g) => g.key === "documentCriteria")
    const app = todo.groups.find((g) => g.key === "approveCriteria")
    expect(doc?.count).toBe(2)
    expect(app?.count).toBe(1)
    expect(doc?.items[0]?.href).toBe("/model/method")
    expect(todo.total).toBe(3)
  })

  it("orders groups describe, evaluate, document, approve and caps items at MAX_ITEMS while count stays full", () => {
    const roles = Array.from({ length: 6 }, (_, i) =>
      role({ roleId: `r${i}`, slug: `r-${i}`, profileComplete: false })
    )
    const todo = buildTodo({
      roles: [
        ...roles,
        role({ roleId: "e1", slug: "e-1", profileComplete: true, ratedCount: 1, totalCriteria: 9 }),
      ],
      method: method([{ criterionId: "c1", name: "Scope", status: "documented" }]),
    })
    expect(todo.groups.map((g) => g.key)).toEqual(["describeRoles", "evaluateRoles", "approveCriteria"])
    const describe = todo.groups[0]
    expect(describe?.count).toBe(6)
    expect(describe?.items).toHaveLength(MAX_ITEMS)
    expect(todo.total).toBe(8)
  })

  it("treats a null method as no criteria groups", () => {
    const todo = buildTodo({ roles: [], method: null })
    expect(todo).toEqual({ groups: [], total: 0 })
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd apps/dashboard && bunx vitest run lib/todo.test.ts`
Expected: FAIL (cannot find `./todo`).

- [ ] **Step 3: Implement**

```ts
// apps/dashboard/lib/todo.ts
// Pure derivation of the front-page "To do" from the existing role + method
// queries. No stored aggregate (derive, like score/band). The profileComplete
// gate splits roles: a role without a profile can only be described, never
// evaluated. Only non-empty groups are returned, in priority order.
export const MAX_ITEMS = 4

export type TodoGroupKey =
  | "describeRoles"
  | "evaluateRoles"
  | "documentCriteria"
  | "approveCriteria"

export type RoleItem = { id: string; title: string; href: string; family?: string }
export type EvaluateItem = RoleItem & { ratedCount: number; totalCriteria: number }
export type CriterionItem = {
  id: string
  title: string
  href: string
  status: "notStarted" | "inProgress" | "documented"
}

export type TodoGroup =
  | { key: "describeRoles"; items: RoleItem[]; count: number }
  | { key: "evaluateRoles"; items: EvaluateItem[]; count: number }
  | { key: "documentCriteria"; items: CriterionItem[]; count: number }
  | { key: "approveCriteria"; items: CriterionItem[]; count: number }

export type Todo = { groups: TodoGroup[]; total: number }

// The subset of each query's return that buildTodo reads. The Convex return
// types are supersets, so useTodo passes them straight through.
type TodoRole = {
  roleId: string
  title: string
  slug: string
  ratedCount: number
  totalCriteria: number
  profileComplete: boolean
  familyName: string | null
}
type TodoMethod = {
  criteria: {
    criterionId: string
    name: string
    status: "notStarted" | "inProgress" | "documented" | "approved"
  }[]
} | null

export type BuildTodoInput = { roles: TodoRole[]; method: TodoMethod }

export function buildTodo({ roles, method }: BuildTodoInput): Todo {
  const describe: RoleItem[] = []
  const evaluate: EvaluateItem[] = []
  for (const r of roles) {
    const family = r.familyName ?? undefined
    if (!r.profileComplete) {
      describe.push({ id: r.roleId, title: r.title, href: `/roles/${r.slug}`, family })
    } else if (r.ratedCount < r.totalCriteria) {
      evaluate.push({
        id: r.roleId,
        title: r.title,
        href: `/roles/${r.slug}/rate`,
        family,
        ratedCount: r.ratedCount,
        totalCriteria: r.totalCriteria,
      })
    }
  }

  const documentItems: CriterionItem[] = []
  const approveItems: CriterionItem[] = []
  for (const c of method?.criteria ?? []) {
    if (c.status === "notStarted" || c.status === "inProgress") {
      documentItems.push({ id: c.criterionId, title: c.name, href: "/model/method", status: c.status })
    } else if (c.status === "documented") {
      approveItems.push({ id: c.criterionId, title: c.name, href: "/model/method", status: "documented" })
    }
  }

  const groups: TodoGroup[] = []
  if (describe.length > 0)
    groups.push({ key: "describeRoles", items: describe.slice(0, MAX_ITEMS), count: describe.length })
  if (evaluate.length > 0)
    groups.push({ key: "evaluateRoles", items: evaluate.slice(0, MAX_ITEMS), count: evaluate.length })
  if (documentItems.length > 0)
    groups.push({ key: "documentCriteria", items: documentItems.slice(0, MAX_ITEMS), count: documentItems.length })
  if (approveItems.length > 0)
    groups.push({ key: "approveCriteria", items: approveItems.slice(0, MAX_ITEMS), count: approveItems.length })

  const total = describe.length + evaluate.length + documentItems.length + approveItems.length
  return { groups, total }
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd apps/dashboard && bunx vitest run lib/todo.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/lib/todo.ts apps/dashboard/lib/todo.test.ts
git commit -m "feat(overview): derive the front-page to-do from roles and method"
```

---

### Task 3: i18n keys (add greeting + todo, all locales)

**Files:**
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (inside `dashboard.overview`)

**Interfaces:**
- Produces the keys Tasks 4-5 read: `dashboard.overview.greeting.{morning,afternoon,evening}`, `dashboard.overview.todo.{heading,viewAll,evaluateProgress}`, `dashboard.overview.todo.empty.{title,body}`, `dashboard.overview.todo.groups.{describeRoles,evaluateRoles,documentCriteria,approveCriteria}`.

Add these blocks INSIDE the existing `"overview": { ... }` object (keep the old `rolesCard`/`continueScoring` keys for now; Task 6 deletes them). The parity test requires the same key set in every locale.

- [ ] **Step 1: Add to `en.json`** (append inside `overview`, after `continueScoring`)

```json
"greeting": {
  "morning": "Good morning{hasName, select, yes{, {name}} other{}}",
  "afternoon": "Good afternoon{hasName, select, yes{, {name}} other{}}",
  "evening": "Good evening{hasName, select, yes{, {name}} other{}}"
},
"todo": {
  "heading": "To do",
  "viewAll": "View all {count}",
  "evaluateProgress": "{rated}/{total} evaluated",
  "empty": {
    "title": "You're all caught up",
    "body": "No roles or criteria need your attention right now."
  },
  "groups": {
    "describeRoles": "Describe these roles",
    "evaluateRoles": "Evaluate these roles",
    "documentCriteria": "Document criteria",
    "approveCriteria": "Approve criteria"
  }
}
```

- [ ] **Step 2: Add the same block to `sv.json`** (values)

```json
"greeting": {
  "morning": "God morgon{hasName, select, yes{, {name}} other{}}",
  "afternoon": "God eftermiddag{hasName, select, yes{, {name}} other{}}",
  "evening": "God kväll{hasName, select, yes{, {name}} other{}}"
},
"todo": {
  "heading": "Att göra",
  "viewAll": "Visa alla {count}",
  "evaluateProgress": "{rated}/{total} utvärderade",
  "empty": {
    "title": "Du är i fas",
    "body": "Inga roller eller kriterier behöver din uppmärksamhet just nu."
  },
  "groups": {
    "describeRoles": "Beskriv de här rollerna",
    "evaluateRoles": "Utvärdera de här rollerna",
    "documentCriteria": "Dokumentera kriterier",
    "approveCriteria": "Godkänn kriterier"
  }
}
```

- [ ] **Step 3: Add to `nb.json`** (machine draft, flag for native review)

```json
"greeting": {
  "morning": "God morgen{hasName, select, yes{, {name}} other{}}",
  "afternoon": "God ettermiddag{hasName, select, yes{, {name}} other{}}",
  "evening": "God kveld{hasName, select, yes{, {name}} other{}}"
},
"todo": {
  "heading": "Å gjøre",
  "viewAll": "Vis alle {count}",
  "evaluateProgress": "{rated}/{total} vurdert",
  "empty": {
    "title": "Du er à jour",
    "body": "Ingen roller eller kriterier trenger oppmerksomheten din akkurat nå."
  },
  "groups": {
    "describeRoles": "Beskriv disse rollene",
    "evaluateRoles": "Vurder disse rollene",
    "documentCriteria": "Dokumenter kriterier",
    "approveCriteria": "Godkjenn kriterier"
  }
}
```

- [ ] **Step 4: Add to `da.json`** (machine draft, flag for native review)

```json
"greeting": {
  "morning": "Godmorgen{hasName, select, yes{, {name}} other{}}",
  "afternoon": "God eftermiddag{hasName, select, yes{, {name}} other{}}",
  "evening": "God aften{hasName, select, yes{, {name}} other{}}"
},
"todo": {
  "heading": "At gøre",
  "viewAll": "Vis alle {count}",
  "evaluateProgress": "{rated}/{total} vurderet",
  "empty": {
    "title": "Du er ajour",
    "body": "Ingen roller eller kriterier kræver din opmærksomhed lige nu."
  },
  "groups": {
    "describeRoles": "Beskriv disse roller",
    "evaluateRoles": "Vurder disse roller",
    "documentCriteria": "Dokumentér kriterier",
    "approveCriteria": "Godkend kriterier"
  }
}
```

- [ ] **Step 5: Add to `fi.json`** (machine draft, flag for native review)

```json
"greeting": {
  "morning": "Hyvää huomenta{hasName, select, yes{, {name}} other{}}",
  "afternoon": "Hyvää iltapäivää{hasName, select, yes{, {name}} other{}}",
  "evening": "Hyvää iltaa{hasName, select, yes{, {name}} other{}}"
},
"todo": {
  "heading": "Tehtävät",
  "viewAll": "Näytä kaikki {count}",
  "evaluateProgress": "{rated}/{total} arvioitu",
  "empty": {
    "title": "Kaikki on ajan tasalla",
    "body": "Mikään rooli tai kriteeri ei vaadi huomiotasi juuri nyt."
  },
  "groups": {
    "describeRoles": "Kuvaa nämä roolit",
    "evaluateRoles": "Arvioi nämä roolit",
    "documentCriteria": "Dokumentoi kriteerit",
    "approveCriteria": "Hyväksy kriteerit"
  }
}
```

- [ ] **Step 6: Format, run parity + typecheck**

Run: `bunx biome check --write packages/i18n/messages/*.json`
Run: `cd packages/i18n && bunx vitest run` — Expected: parity tests PASS.
Run (repo root): `bunx turbo typecheck --filter=dashboard` — Expected: PASS (the generated `Messages` type now includes the new keys).

- [ ] **Step 7: Flag the Nordic drafts in the go-live checklist**

Add a bullet under "Content and localization" in `docs/go-live-checklist.md`:

```markdown
- [ ] **Native review of the overview greeting + to-do strings.** `dashboard.overview.greeting.*` and `dashboard.overview.todo.*` (sv/nb/da/fi) were machine-drafted from English. Have a native speaker review before launch, and confirm the "evaluate" term matches each locale's existing usage (`dashboard.roles.evaluated`).
```

- [ ] **Step 8: Commit**

```bash
git add packages/i18n/messages docs/go-live-checklist.md
git commit -m "feat(i18n): add overview greeting and to-do strings"
```

---

### Task 4: `WelcomeGreeting` component

**Files:**
- Create: `apps/dashboard/components/overview/welcome-greeting.tsx`
- Test: `apps/dashboard/components/overview/welcome-greeting.test.tsx`

**Interfaces:**
- Consumes: `greetingBucket` (Task 1), `dashboard.overview.greeting.*` (Task 3), `authClient` (`@/lib/auth-client`), `PageHeading` (`@/components/page-heading`).
- Produces: `<WelcomeGreeting />` (no props).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/dashboard/components/overview/welcome-greeting.test.tsx
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

// Fix the bucket so the assertion is deterministic (the hour comes from the
// real clock at runtime; greetingBucket itself is tested separately).
vi.mock("@/lib/greeting", () => ({ greetingBucket: () => "morning" }))

// vi.mock factories are hoisted above imports, so the mutable session name must
// come through vi.hoisted (a plain outer `let` would hit a TDZ / "only mock*
// vars" error in the factory).
const hoisted = vi.hoisted(() => ({ sessionName: "Christian Ek" as string | undefined }))
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: { name: hoisted.sessionName } } }) },
}))

import { WelcomeGreeting } from "@/components/overview/welcome-greeting"

function renderGreeting() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WelcomeGreeting />
    </NextIntlClientProvider>
  )
}

describe("WelcomeGreeting", () => {
  afterEach(cleanup)

  it("greets by time of day with the first name", () => {
    hoisted.sessionName = "Christian Ek"
    renderGreeting()
    expect(screen.getByText("Good morning, Christian")).toBeDefined()
  })

  it("omits the name when the session has none", () => {
    hoisted.sessionName = undefined
    renderGreeting()
    expect(screen.getByText("Good morning")).toBeDefined()
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd apps/dashboard && bunx vitest run components/overview/welcome-greeting.test.tsx`
Expected: FAIL (cannot find the component).

- [ ] **Step 3: Implement**

```tsx
// apps/dashboard/components/overview/welcome-greeting.tsx
"use client"

import { Skeleton } from "@workspace/ui/components/skeleton"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { PageHeading } from "@/components/page-heading"
import { authClient } from "@/lib/auth-client"
import { greetingBucket } from "@/lib/greeting"

// Personal welcome heading: a time-of-day greeting plus the user's first name.
// The hour is read AFTER mount (never during SSR) so the server clock cannot
// cause a hydration mismatch; a heading-sized skeleton holds the space until
// the hour and session are ready. Re-checked every 5 minutes to cross hour
// boundaries without a reload.
export function WelcomeGreeting() {
  const t = useTranslations("dashboard.overview.greeting")
  const { data: session } = authClient.useSession()
  const [hour, setHour] = useState<number | null>(null)

  useEffect(() => {
    setHour(new Date().getHours())
    const id = setInterval(() => setHour(new Date().getHours()), 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  if (hour === null || session === undefined) {
    return (
      <PageHeading>
        <Skeleton className="h-8 w-64" />
      </PageHeading>
    )
  }

  const firstName = session?.user?.name?.split(" ")[0] ?? ""
  return (
    <PageHeading>
      {t(greetingBucket(hour), { hasName: firstName ? "yes" : "no", name: firstName })}
    </PageHeading>
  )
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd apps/dashboard && bunx vitest run components/overview/welcome-greeting.test.tsx`
Expected: PASS (2 tests).

Note: if `PageHeading` renders a heading that wraps children in extra nodes, the `getByText` still matches the text node; no change needed. Confirm `@/components/page-heading` exports `PageHeading` (it does; `PageHeader` imports it).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/overview/welcome-greeting.tsx apps/dashboard/components/overview/welcome-greeting.test.tsx
git commit -m "feat(overview): add the personal welcome greeting"
```

---

### Task 5: `TodoWidget` + subcomponents (presentational)

**Files:**
- Create: `apps/dashboard/components/overview/todo-widget.tsx`
- Create: `apps/dashboard/components/overview/todo-group.tsx`
- Create: `apps/dashboard/components/overview/todo-skeleton.tsx`
- Test: `apps/dashboard/components/overview/todo-widget.test.tsx`

**Interfaces:**
- Consumes: `Todo`, `TodoGroup`, `MAX_ITEMS` (Task 2); `dashboard.overview.todo.*` (Task 3); `Accordion*` (`@workspace/ui/components/accordion`), `Empty*` (`@workspace/ui/components/empty`), `MethodStatusBadge` (`@/components/model/method-status-badge`), `Skeleton`, `Link` (`next/link`).
- Produces: `<TodoWidget todo={Todo | undefined} />` (prop-driven; the page passes `useTodo`'s result).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/dashboard/components/overview/todo-widget.test.tsx
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import type { Todo } from "@/lib/todo"
import { TodoWidget } from "@/components/overview/todo-widget"

function renderWidget(todo: Todo | undefined) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TodoWidget todo={todo} />
    </NextIntlClientProvider>
  )
}

describe("TodoWidget", () => {
  afterEach(cleanup)

  it("shows the empty state when there is nothing to do", () => {
    renderWidget({ groups: [], total: 0 })
    expect(screen.getByText("You're all caught up")).toBeDefined()
  })

  it("renders a skeleton while loading (undefined)", () => {
    const { container } = renderWidget(undefined)
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
  })

  it("renders groups with the total, expands the first group, and links items", () => {
    const todo: Todo = {
      total: 7,
      groups: [
        {
          key: "evaluateRoles",
          count: 6,
          items: [
            { id: "r1", title: "Backend Engineer", href: "/roles/backend-engineer/rate", ratedCount: 3, totalCriteria: 9 },
          ],
        },
        {
          key: "approveCriteria",
          count: 1,
          items: [{ id: "c1", title: "Scope", href: "/model/method", status: "documented" }],
        },
      ],
    }
    renderWidget(todo)
    // Heading + total
    expect(screen.getByText("To do")).toBeDefined()
    expect(screen.getByText("7")).toBeDefined()
    // Group labels
    expect(screen.getByText("Evaluate these roles")).toBeDefined()
    expect(screen.getByText("Approve criteria")).toBeDefined()
    // First group is expanded -> its item is visible; the progress subtitle renders
    expect(screen.getByText("Backend Engineer")).toBeDefined()
    expect(screen.getByText("3/9 evaluated")).toBeDefined()
    // Over-cap -> "View all 6"
    expect(screen.getByText("View all 6")).toBeDefined()
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd apps/dashboard && bunx vitest run components/overview/todo-widget.test.tsx`
Expected: FAIL (cannot find the component).

- [ ] **Step 3: Implement `todo-skeleton.tsx`**

```tsx
// apps/dashboard/components/overview/todo-skeleton.tsx
import { Skeleton } from "@workspace/ui/components/skeleton"

// Content-shaped loading state for the to-do widget: the heading row plus a few
// group-header rows, so the section keeps its shape while the queries load and
// nothing reflows when data arrives.
export function TodoSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-28" />
      <div className="flex flex-col">
        {Array.from({ length: 3 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder, order is stable
          <div key={i} className="flex items-center justify-between border-b py-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-6" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implement `todo-group.tsx`**

```tsx
// apps/dashboard/components/overview/todo-group.tsx
import { MethodStatusBadge } from "@/components/model/method-status-badge"
import type { TodoGroup } from "@/lib/todo"
import { useTranslations } from "next-intl"
import Link from "next/link"

// Renders the items of one to-do group inside its accordion panel: up to
// MAX_ITEMS rows, then a "View all N" link to the owning section when the group
// holds more. Each row is a full-width link to where the work happens. The row
// content switches on the group kind (role progress, family, or criterion
// status badge) so no impossible field combinations exist.
export function TodoGroupItems({ group }: { group: TodoGroup }) {
  const t = useTranslations("dashboard.overview.todo")
  const tStatus = useTranslations("dashboard.model.method.status")

  const rowClass =
    "flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-muted"

  return (
    <div className="flex flex-col gap-1">
      {group.key === "describeRoles" &&
        group.items.map((item) => (
          <Link key={item.id} href={item.href} className={rowClass}>
            <span className="min-w-0 truncate">{item.title}</span>
            {item.family && (
              <span className="shrink-0 text-muted-foreground text-sm">{item.family}</span>
            )}
          </Link>
        ))}

      {group.key === "evaluateRoles" &&
        group.items.map((item) => (
          <Link key={item.id} href={item.href} className={rowClass}>
            <span className="min-w-0 truncate">{item.title}</span>
            <span className="shrink-0 text-muted-foreground text-sm tabular-nums">
              {t("evaluateProgress", { rated: item.ratedCount, total: item.totalCriteria })}
            </span>
          </Link>
        ))}

      {(group.key === "documentCriteria" || group.key === "approveCriteria") &&
        group.items.map((item) => (
          <Link key={item.id} href={item.href} className={rowClass}>
            <span className="min-w-0 truncate">{item.title}</span>
            <MethodStatusBadge status={item.status} label={tStatus(item.status)} />
          </Link>
        ))}

      {group.count > group.items.length && (
        <Link
          href={group.key === "describeRoles" || group.key === "evaluateRoles" ? "/roles" : "/model/method"}
          className="px-2 py-2 text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          {t("viewAll", { count: group.count })}
        </Link>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Implement `todo-widget.tsx`**

```tsx
// apps/dashboard/components/overview/todo-widget.tsx
"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { useTranslations } from "next-intl"
import { TodoGroupItems } from "@/components/overview/todo-group"
import { TodoSkeleton } from "@/components/overview/todo-skeleton"
import type { Todo } from "@/lib/todo"

// The front-page "To do": a heading with the total count and one expandable
// accordion section per non-empty group (top-priority group open by default).
// Prop-driven so it is trivially testable; the page supplies useTodo's result.
// undefined = loading (skeleton); total 0 = the all-caught-up empty state.
export function TodoWidget({ todo }: { todo: Todo | undefined }) {
  const t = useTranslations("dashboard.overview.todo")

  if (todo === undefined) return <TodoSkeleton />

  if (todo.total === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{t("empty.title")}</EmptyTitle>
          <EmptyDescription>{t("empty.body")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="flex items-baseline gap-2 font-semibold text-lg">
        {t("heading")}
        <span className="text-foreground tabular-nums">{todo.total}</span>
      </h2>
      <Accordion type="multiple" defaultValue={[todo.groups[0]?.key ?? ""]}>
        {todo.groups.map((group) => (
          <AccordionItem key={group.key} value={group.key}>
            <AccordionTrigger>
              <span className="flex flex-1 items-center justify-between pr-2">
                {t(`groups.${group.key}`)}
                <span className="text-muted-foreground tabular-nums">{group.count}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <TodoGroupItems group={group} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
```

- [ ] **Step 6: Run it, verify it passes**

Run: `cd apps/dashboard && bunx vitest run components/overview/todo-widget.test.tsx`
Expected: PASS (3 tests). If the collapsed second group's content is unmounted by Radix, the `approveCriteria` item ("Scope") is absent — the test does not assert it, so this is fine.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/components/overview/todo-widget.tsx apps/dashboard/components/overview/todo-group.tsx apps/dashboard/components/overview/todo-skeleton.tsx apps/dashboard/components/overview/todo-widget.test.tsx
git commit -m "feat(overview): add the grouped to-do widget"
```

---

### Task 6: `useTodo` hook + page integration + retire the old cards

**Files:**
- Create: `apps/dashboard/hooks/use-todo.ts`
- Modify: `apps/dashboard/app/(app)/page.tsx` (full rewrite)
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (delete retired keys)

**Interfaces:**
- Consumes: `buildTodo` (Task 2), `listRoles`/`getMethodModel` queries, `WelcomeGreeting` (Task 4), `TodoWidget` (Task 5).
- Produces: `useTodo(orgId: string, locale: string): Todo | undefined`.

- [ ] **Step 1: Implement `use-todo.ts`**

```ts
// apps/dashboard/hooks/use-todo.ts
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import { buildTodo, type Todo } from "@/lib/todo"

// Wires the front-page to-do: reads the two reactive queries the widget derives
// from and returns undefined until both have loaded (getMethodModel returns null
// when there is no model, which buildTodo treats as no criteria groups).
export function useTodo(orgId: string, locale: string): Todo | undefined {
  const roles = useQuery(api.assessment.roles.listRoles, { orgId, locale })
  const method = useQuery(api.evaluationModel.method.getMethodModel, { orgId, locale })
  if (roles === undefined || method === undefined) return undefined
  return buildTodo({ roles, method })
}
```

- [ ] **Step 2: Rewrite `apps/dashboard/app/(app)/page.tsx`**

```tsx
"use client"

import { useLocale, useTranslations } from "next-intl"
import { WelcomeGreeting } from "@/components/overview/welcome-greeting"
import { TodoWidget } from "@/components/overview/todo-widget"
import { useOrganization } from "@/components/org-context"
import { useTodo } from "@/hooks/use-todo"
import { usePageTitle } from "@/hooks/use-page-title"

// Front page: a personal welcome greeting over a single actionable "To do".
// Both are derived views (no stored aggregates); the greeting reads the session,
// the to-do derives from the role + method queries via useTodo.
export default function OverviewPage() {
  const tNav = useTranslations("dashboard.nav")
  usePageTitle(tNav("home"))
  const { orgId } = useOrganization()
  const locale = useLocale()
  const todo = useTodo(orgId, locale)

  return (
    <div className="space-y-6">
      <WelcomeGreeting />
      <TodoWidget todo={todo} />
    </div>
  )
}
```

- [ ] **Step 3: Delete the retired `overview` keys in every locale**

In `packages/i18n/messages/{en,sv,nb,da,fi}.json`, remove from `dashboard.overview`: `rolesCard`, `ratedCard`, `criteriaCard`, `goRoles`, `goModel`, `goOverview`, and the entire `continueScoring` object. Keep `greeting` and `todo`.

- [ ] **Step 4: Verify nothing else references the deleted keys**

Run: `grep -rn "rolesCard\|ratedCard\|criteriaCard\|goRoles\|goModel\|goOverview\|continueScoring" apps/ packages/ --include="*.tsx" --include="*.ts"`
Expected: no matches (only the now-rewritten page used them). If any match remains, it is a real usage — stop and reconcile before continuing.

- [ ] **Step 5: Format, typecheck, and run the affected tests**

Run: `bunx biome check --write apps/dashboard/app/(app)/page.tsx apps/dashboard/hooks/use-todo.ts packages/i18n/messages/*.json`
Run: `cd packages/i18n && bunx vitest run` (parity holds after the deletions).
Run (repo root): `bunx turbo typecheck --filter=dashboard` — Expected: PASS (no dangling key references; `Messages` type updated).
Run: `cd apps/dashboard && bunx vitest run components/overview lib/todo.test.ts lib/greeting.test.ts` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/hooks/use-todo.ts "apps/dashboard/app/(app)/page.tsx" packages/i18n/messages
git commit -m "feat(overview): replace the count cards with the welcome greeting and to-do"
```

---

## Self-review notes (author)

- **Spec coverage:** greeting (T1/T4), taxonomy + gate (T2), i18n incl. deletions (T3/T6), layout with accordion + top-N + empty + skeleton (T5), page composition (T6), testing (each task), no setup group / no Prio / no dedicated page / no summary line (honored by omission). Covered.
- **Type consistency:** `Todo`/`TodoGroup`/`RoleItem`/`EvaluateItem`/`CriterionItem`/`MAX_ITEMS`/`buildTodo` names are identical across T2, T5, T6. `greetingBucket` matches T1↔T4. `MethodStatusBadge({status,label})` and status keys `dashboard.model.method.status.*` match the existing component.
- **Open confirmations for the implementer:** (a) `listRoles` returns `title`, `slug`, `ratedCount`, `totalCriteria`, `profileComplete`, `familyName` (confirmed); (b) `getMethodModel` criteria carry `criterionId`, `name`, `status` (confirmed); (c) `dashboard.model.method.status.{notStarted,inProgress,documented,approved}` keys exist (confirmed, used by the method panel).
