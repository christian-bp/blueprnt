# Dashboard front page: welcome greeting + "To do" widget

**Goal:** Replace the front page's passive count cards with a personal welcome
greeting and a single, actionable "To do" widget that lists the work an HR user
still has to do (roles to describe, roles to evaluate, criteria to document,
criteria to approve), grouped by type and deep-linked to where the work happens.

**Context:** This resumes the paused "overview todo" brainstorm
(`rating-guidance-paused`) and expands it beyond roles-to-rate. The
`profileComplete` gate stays (a role must have a profile before it can be
evaluated), so the role side splits into a "describe" prerequisite group and an
"evaluate" group. The visual model is the "Att göra" reference (grouped,
expandable, item-level). The widget is a **derived view** of data we already
fetch; no new stored aggregates. V2 will extend it (a dedicated page, a priority
toggle, more item types) without reshaping the core.

## Global constraints

- **Audience is HR/comp professionals only.** No manager/employee framing.
- **All user-facing text via i18n** (`next-intl`), English source in
  `packages/i18n/messages/en.json`, mirrored to sv, nb, da, fi. New nb/da/fi are
  machine-draft flagged for native review (go-live checklist).
- **No em dashes** in copy. Terminology: the act is **Evaluate/Evaluated**
  (never "Score"); a role's descriptive fields are its **profile**.
- **Never store the aggregate** (derive, like score/band; ADR-0002 spirit).
- **Minimize layout shift**; loading uses a content-shaped skeleton (the
  convention just added to `CLAUDE.md`).
- **Animate legitimate transitions** per `docs/ui-animation.md` (geometry-only
  height animation, staged; respect reduced motion).
- Brand rose only where our design language allows; counts stay ink, not brand
  (matches the current overview treatment).
- Internal navigation uses the `Link` component.

## Architecture (chosen: client-side derivation)

The To do is a pure function of two existing reactive queries. No backend query.

- **`lib/todo.ts` — pure `buildTodo(input): Todo`.** Deterministic, no I/O,
  unit-tested. Turns query results into typed, ordered groups.
- **`hooks/use-todo.ts` — `useTodo(orgId, locale): Todo | undefined`.** Calls
  `listRoles` and `getMethodModel`, returns `undefined` while either is loading,
  else `buildTodo(...)`.
- **`components/overview/*` — presentational.** Render the greeting and the
  widget from the hook; no data logic.

Rejected alternative: a backend `getTodo` query. It would re-derive what
`listRoles`/`getMethodModel` already return and add a query to maintain, for no
gain (Convex queries are reactive and cheap; the browser already holds this
data). Client derivation keeps a single source of truth and matches
"derive, don't store".

### Data inputs (existing, confirmed)

- `api.assessment.roles.listRoles({ orgId, locale })` → per role:
  `{ slug, name, profileComplete, ratedCount, totalCriteria, family? }`
  (exact display-name field — `name` vs `title` — and family shape are
  confirmed at plan time from `assessment/roles.ts`).
- `api.evaluationModel.method.getMethodModel({ orgId, locale })` → `null` or
  `{ criteria: { criterionId, name, status }[], progress }` where `status ∈
  { notStarted, inProgress, documented, approved }`.

### Types (final shape settled in the plan)

```ts
type TodoGroup =
  | { key: "describeRoles";    items: RoleItem[];      count: number }
  | { key: "evaluateRoles";    items: EvaluateItem[];  count: number }
  | { key: "documentCriteria"; items: CriterionItem[]; count: number }
  | { key: "approveCriteria";  items: CriterionItem[]; count: number }

type RoleItem = { id: string; title: string; href: string; family?: string }
type EvaluateItem = RoleItem & { ratedCount: number; totalCriteria: number }
type CriterionItem = {
  id: string; title: string; href: string
  status: "notStarted" | "inProgress" | "documented"
}
type Todo = { groups: TodoGroup[]; total: number } // only non-empty groups; total = sum of counts
```

## Welcome greeting

`components/overview/welcome-greeting.tsx`. Time-of-day phrase + the user's
first name, localized.

- Name: `authClient.useSession()` → `session?.user?.name?.split(" ")[0]` (same
  source as `nav-user.tsx`). better-auth mandates a name at signup, so it is
  effectively always present.
- Bucket by the browser's local hour (no stored timezone in V1):
  `morning` 5–11, `afternoon` 12–16, `evening` 17–4. Pure `greetingBucket(hour)`
  in `lib/greeting.ts`, unit-tested at the boundaries.
- Re-evaluate on an interval so the phrase crosses hour boundaries without a
  reload (5 min, like the reference); respect reduced motion (no animation
  needed, it is a text swap).
- i18n: one key per bucket, name optional via ICU select so an empty name never
  leaves a dangling comma:
  `greeting.morning` = `"God morgon{hasName, select, yes{, {name}} other{}}"`
  (and afternoon/evening). Component passes `{ hasName, name }`.
- Large heading, consistent with `PageHeader`'s heading scale (not brand-tinted;
  the name may use `text-muted-foreground` like the reference).

## To do widget

`components/overview/todo-widget.tsx` (+ `todo-group.tsx`, `todo-item.tsx`,
`todo-skeleton.tsx`).

### Taxonomy (grouped by type, priority order)

Only non-empty groups render. Detection is pure over the query data:

1. **Describe these roles** — `!profileComplete` → `/roles/{slug}`.
   Prerequisite for evaluation (the gate). Subtitle: family name if present.
2. **Evaluate these roles** — `profileComplete && ratedCount < totalCriteria`
   → `/roles/{slug}/rate`. Subtitle: `{ratedCount}/{totalCriteria} evaluated`.
3. **Document criteria** — `status ∈ {notStarted, inProgress}` → `/model/method`.
   Subtitle: the `MethodStatusBadge` for the status.
4. **Approve criteria** — `status === "documented"` (documented, not approved)
   → `/model/method`. Subtitle: `MethodStatusBadge` "documented".

### Header

`Att göra` heading with the **total** count rendered as a styled number beside
it (`todo.heading` + tabular-nums count). No `→`/dedicated page and **no
Typ/Prio toggle** in V1 (we have no priority model; V1 is by type only).

### Groups and items

- Each group is an expandable section (`Accordion` from
  `packages/ui/src/components/accordion.tsx`, or a Motion collapse if the
  accordion's animation does not satisfy `docs/ui-animation.md`; plan decides).
  Header row: group label + count. The **top-priority non-empty group starts
  expanded**, the rest collapsed (matches the reference).
- Item row: a small status dot/badge + title (role/criterion name) + subtitle +
  the whole row is a `Link` to the deep-link. Criteria rows reuse
  `MethodStatusBadge`.
- Show up to **4 items** per group; if `count > 4`, a **"Visa alla {count} →"**
  row links to the section (`/roles` for role groups, `/model/method` for
  criteria groups).

### Empty and loading

- **Empty** (`total === 0`): the `Empty` component with an "all caught up"
  message (`todo.empty.title` / `todo.empty.body`). Never render an empty
  widget shell.
- **Loading** (`useTodo === undefined`): a content-shaped `todo-skeleton.tsx`
  (a few group headers + placeholder rows), mirroring the loaded layout so the
  page does not reflow when data arrives. The greeting renders immediately from
  the session (no query).

## i18n keys (new, under `dashboard.overview`)

- `greeting.morning` / `greeting.afternoon` / `greeting.evening` (ICU, optional
  name as above).
- `todo.heading` ("To do"), `todo.viewAll` ("View all {count}"),
  `todo.empty.title`, `todo.empty.body`.
- `todo.groups.describeRoles`, `todo.groups.evaluateRoles`,
  `todo.groups.documentCriteria`, `todo.groups.approveCriteria`.
- `todo.evaluateProgress` ("{rated}/{total} evaluated").
- Reuse existing `dashboard.model.method.status.*` for criterion badges.

**Cleanup (no legacy before launch):** delete the now-unused overview keys the
old cards used (`rolesCard`, `ratedCard`, `criteriaCard`, `goRoles`, `goModel`,
`goOverview`, and the `continueScoring.*` block) from every locale, and the code
that referenced them.

## File structure

- Create: `apps/dashboard/lib/todo.ts`, `lib/todo.test.ts`,
  `lib/greeting.ts`, `lib/greeting.test.ts`, `hooks/use-todo.ts`.
- Create: `components/overview/welcome-greeting.tsx`,
  `todo-widget.tsx`, `todo-group.tsx`, `todo-item.tsx`, `todo-skeleton.tsx`
  (+ component tests for the widget's empty/loaded/expand behavior and the
  greeting).
- Modify: `apps/dashboard/app/(app)/page.tsx` — render
  `<WelcomeGreeting/>` + `<TodoWidget/>`; remove the count-card grid and the
  continue-scoring card.
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` — add the keys above,
  remove the retired ones. English authored; sv/nb/da/fi drafted and flagged.

## Testing

- **`buildTodo`** (pure): each group's detection rule; profile gate excludes
  profile-incomplete roles from "evaluate"; group ordering; only non-empty
  groups; per-group `count` vs capped `items`; `total`.
- **`greetingBucket`**: hour boundaries (4/5, 11/12, 16/17, 23/0).
- **Widget component**: renders groups from a fixed `Todo`, expands/collapses,
  shows the empty state at `total === 0`, shows "View all" past the cap.
- **Greeting component**: renders the bucketed phrase with and without a name.

## Decisions and non-goals (V1)

- **No "set up the model" group.** The dashboard is only reached after
  onboarding completes, which guarantees a model with ≥5 criteria and balanced
  weights; those states are unreachable here, so detecting them would be dead
  code. If we later allow breaking the model post-onboarding, add the group.
- **No summary/totals line** under the greeting. Welcome + one focused To do;
  keeping totals would re-introduce the overload we are removing.
- **No Prio toggle, no dedicated To do page** (both V2).
- **No deep-link that auto-opens a specific criterion dialog.** Criteria items
  link to `/model/method`; the user picks the criterion there. (A `?criterion=`
  param is a possible later enhancement but is out of scope now.)
- **No stored timezone.** Browser local hour is sufficient for the greeting.

## V2 hooks

- A dedicated `/todo` page behind the header's count (add the `→`).
- A "by priority" grouping (`Typ` / `Prio` toggle) once a priority model exists.
- New item kinds slot into `buildTodo`'s union and the group renderer without
  changing the widget's shape.
