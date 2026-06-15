# Band and role Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the standalone Results page with a "Work > Overview" surface that shows every band and the roles inside it, as a vertical band ladder and a band-by-track matrix toggle, with anchor roles flagged inline.

**Architecture:** A new client page at `/work` reads the existing reactive `getResults` Convex query (extended with a per-row `anchor` field) and renders presentational components from `components/bands/`. Band membership, score, and band stay derived at read time (ADR-0002); nothing new is stored. Navigation gains a collapsible "Work" group built from the already-vendored shadcn sidebar submenu primitives. The old Results page and its components are deleted (no legacy before launch).

**Tech Stack:** Next.js 16 (App Router, client components), Convex (reactive queries), next-intl (i18n, 5 locales), shadcn/ui (Sidebar, Tabs, Card, Badge, Select, Empty, Spinner), Motion (`motion/react`) with the shared `SPRING`, HugeIcons, Vitest 4 + Testing Library.

---

## Conventions for every task

- Run tests with `bun run test` (never `bun test`). The pre-commit hook runs Biome, a full typecheck, and the full `turbo run test` on every commit; all three must pass. Do not use `--no-verify`.
- Every commit message uses a conventional prefix and ends with the trailer:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```
- No em dashes ("—") anywhere. En dash ("–") is allowed and is used in `bandRange`.
- New machine translations (sv, nb, da, fi) are drafts: leave them in and note in the commit body that they need native review.

## File structure

Created:
- `apps/dashboard/lib/bands.ts` - `BandRoleRow` type + pure `bandRanges` helper.
- `apps/dashboard/lib/bands.test.ts` - unit tests for `bandRanges`.
- `apps/dashboard/components/bands/role-chip.tsx` - one role as a chip (anchor marker + deviation flag).
- `apps/dashboard/components/bands/role-chip.test.tsx`
- `apps/dashboard/components/bands/band-ladder.tsx` - vertical lanes, one per band.
- `apps/dashboard/components/bands/band-ladder.test.tsx`
- `apps/dashboard/components/bands/band-matrix.tsx` - band x track grid.
- `apps/dashboard/components/bands/band-matrix.test.tsx`
- `apps/dashboard/components/bands/pending-roles.tsx` - the "not yet evaluated" zone.
- `apps/dashboard/components/bands/pending-roles.test.tsx`
- `apps/dashboard/app/(app)/work/page.tsx` - the Overview page (ladder/matrix toggle, family filter, help).
- `apps/dashboard/app/(app)/work/page.test.tsx`

Modified:
- `packages/backend/convex/assessment/results.ts` - add `anchor` to `getResults` rows.
- `packages/backend/convex/assessment/results.test.ts` - cover the new field.
- `packages/i18n/messages/{en,sv,nb,da,fi}.json` - add `dashboard.bands.*` and help keys (Task 3); nav + overview changes (Task 9); remove `dashboard.results.*` (Task 10).
- `apps/dashboard/components/app-sidebar.tsx` - Home / Work (collapsible) / Model; remove Results.
- `apps/dashboard/components/nav-main.tsx` - render collapsible groups with submenus.
- `apps/dashboard/components/site-header.tsx` - breadcrumb labels (home, work) and drop results.
- `apps/dashboard/components/site-header.test.tsx` - match the new labels/routes.
- `apps/dashboard/app/(app)/page.tsx` - home cards link to `/work` (label `goOverview`).

Deleted (Task 10):
- `apps/dashboard/app/(app)/results/page.tsx`
- `apps/dashboard/components/results/band-overview.tsx`
- `apps/dashboard/components/results/anchor-roles-panel.tsx`
- `apps/dashboard/components/results/anchor-roles-panel.test.tsx`

> Note: the design listed a `BandViewToggle` component. We use shadcn `Tabs` directly in the page instead (YAGNI), so there is no separate toggle component.

---

### Task 1: Backend - add `anchor` to `getResults` rows

**Files:**
- Modify: `packages/backend/convex/assessment/results.ts:14-32` (returns validator) and `:62-82` (row build)
- Test: `packages/backend/convex/assessment/results.test.ts`

- [ ] **Step 1: Read the Convex guidelines**

Run: open and read `packages/backend/convex/_generated/ai/guidelines.md`. These rules override training data for Convex APIs.

- [ ] **Step 2: Write the failing test**

Add this test inside the existing `describe("getResults", ...)` block in `packages/backend/convex/assessment/results.test.ts`, after the first `it(...)`:

```ts
  it("includes anchor info per row and excludes non-anchor roles", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin, model } = await seedTemplateOrganization(t)
    // Fully rated => complete => band 1 (value 5 on every criterion).
    const topId = await createRatedRole({
      orgId,
      asAdmin,
      model,
      title: "Top",
      value: 5,
    })
    await createRatedRole({ orgId, asAdmin, model, title: "Plain", value: 0 })
    // Designate Top as an anchor with an agreed band (2) that deviates from
    // its computed band (1); the row still just carries the agreed band.
    await asAdmin.mutation(api.assessment.anchorRoles.designateAnchorRole, {
      orgId,
      roleId: topId,
      expectedBand: 2,
      motivation: "reference point",
    })

    const results = await asAdmin.query(api.assessment.results.getResults, {
      orgId,
      locale: "sv",
    })
    const top = results.rows.find((row) => row.roleId === topId)
    expect(top?.anchor).toEqual({ expectedBand: 2, status: "active" })
    const plain = results.rows.find((row) => row.title === "Plain")
    expect(plain?.anchor).toBeNull()
  })
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd packages/backend && bun run test results.test.ts`
Expected: FAIL. The returns validator rejects the extra `anchor` field, or `top.anchor` is `undefined`.

- [ ] **Step 4: Add `anchor` to the returns validator**

In `packages/backend/convex/assessment/results.ts`, inside the `getResults` `returns.rows` object validator, add this property after `familyName` (around line 28):

```ts
        familyName: v.union(v.string(), v.null()),
        anchor: v.union(
          v.null(),
          v.object({
            expectedBand: v.number(),
            status: v.union(v.literal("active"), v.literal("underReview")),
          })
        ),
```

- [ ] **Step 5: Populate `anchor` in the row build**

In the same file, inside the `for (const role of active)` loop, before `rows.push({`, compute the anchor (replaced anchors are history, not calibration points, so they read as `null`):

```ts
    for (const role of active) {
      const result = resultByRole.get(role._id as string)
      const track = names.get(role.trackKey)
      const anchorRole = role.anchorRole
      const anchor =
        anchorRole === undefined || anchorRole.status === "replaced"
          ? null
          : { expectedBand: anchorRole.expectedBand, status: anchorRole.status }
      rows.push({
```

Then add `anchor,` as the last property of the pushed object, after `familyName: ...,`:

```ts
        familyName:
          role.familyId !== undefined
            ? (families.get(role.familyId as string) ?? null)
            : null,
        anchor,
      })
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd packages/backend && bun run test results.test.ts`
Expected: PASS (all `getResults` and `getRoleResult` tests green).

- [ ] **Step 7: Commit**

```bash
git add packages/backend/convex/assessment/results.ts packages/backend/convex/assessment/results.test.ts
git commit -m "feat(results): expose per-role anchor info from getResults

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `bandRanges` pure helper

**Files:**
- Create: `apps/dashboard/lib/bands.ts`
- Test: `apps/dashboard/lib/bands.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/lib/bands.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { bandRanges } from "./bands"

describe("bandRanges", () => {
  it("derives [min,max] per band with band 1 topping out at 100", () => {
    const bands = [
      { band: 1, minScore: 98 },
      { band: 2, minScore: 83 },
      { band: 3, minScore: 74 },
      { band: 4, minScore: 63 },
      { band: 5, minScore: 53 },
      { band: 6, minScore: 41 },
      { band: 7, minScore: 0 },
    ]
    expect(bandRanges(bands)).toEqual([
      { band: 1, min: 98, max: 100 },
      { band: 2, min: 83, max: 97 },
      { band: 3, min: 74, max: 82 },
      { band: 4, min: 63, max: 73 },
      { band: 5, min: 53, max: 62 },
      { band: 6, min: 41, max: 52 },
      { band: 7, min: 0, max: 40 },
    ])
  })

  it("sorts unordered thresholds by band first", () => {
    expect(
      bandRanges([
        { band: 2, minScore: 50 },
        { band: 1, minScore: 80 },
      ])
    ).toEqual([
      { band: 1, min: 80, max: 100 },
      { band: 2, min: 50, max: 79 },
    ])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/dashboard && bun run test bands.test.ts`
Expected: FAIL with "Failed to resolve import ./bands" or "bandRanges is not a function".

- [ ] **Step 3: Create the helper and the shared row type**

Create `apps/dashboard/lib/bands.ts`:

```ts
// The shape the band Overview components consume. It is a structural subset
// of a getResults row (assessment/results.ts), so rows can be passed straight
// through. Score/band are derived at read time and may be null while a role's
// assessment is incomplete (ADR-0002).
export interface BandRoleRow {
  roleId: string
  title: string
  trackKey: string
  trackName: string
  score: number | null
  band: number | null
  ratedCount: number
  totalCriteria: number
  familyId: string | null
  familyName: string | null
  anchor: { expectedBand: number; status: "active" | "underReview" } | null
}

export interface BandRange {
  band: number
  min: number
  max: number
}

// The closed [min,max] weighting range each band covers, derived from the
// model's band thresholds (minScore is the inclusive lower bound). Band 1 is
// the highest band and tops out at 100; every other band's max is one below
// the next-higher band's minScore. Pure so it stays unit-testable.
export function bandRanges(
  bands: { band: number; minScore: number }[]
): BandRange[] {
  const sorted = [...bands].sort((a, b) => a.band - b.band)
  return sorted.map((threshold, index) => ({
    band: threshold.band,
    min: threshold.minScore,
    max: index === 0 ? 100 : sorted[index - 1].minScore - 1,
  }))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/dashboard && bun run test bands.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/lib/bands.ts apps/dashboard/lib/bands.test.ts
git commit -m "feat(bands): add bandRanges helper and BandRoleRow type

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: i18n - add `dashboard.bands.*` and help keys (all 5 locales)

This task is additive only. It removes nothing, so every other component keeps compiling. The i18n parity test (`packages/i18n/src/messages.test.ts`) requires the SAME keys in all five files.

**Files:**
- Modify: `packages/i18n/messages/en.json`, `sv.json`, `nb.json`, `da.json`, `fi.json`

- [ ] **Step 1: Add the `bands` namespace and two help keys to `en.json`**

In `packages/i18n/messages/en.json`, inside `"dashboard"`, add a new `"bands"` object. Put it right after the `"results"` object (before `"auth"`), so the ordering reads naturally:

```json
    "bands": {
      "heading": "Overview",
      "description": "The bands and the roles in each, derived live from the current model and ratings.",
      "viewLadder": "Ladder",
      "viewMatrix": "Matrix",
      "bandRow": "Band {band}",
      "bandRange": "{min}–{max}",
      "roleCount": "{count, plural, =1 {1 role} other {# roles}}",
      "bandEmpty": "No roles in this band",
      "pendingHeading": "Not yet evaluated",
      "pendingDescription": "These roles have no band until their assessment is complete.",
      "pendingProgress": "{rated}/{total} rated",
      "anchorLabel": "Anchor role",
      "deviation": "≠ Band {band}",
      "deviationLabel": "Computed band deviates from the agreed band {band}",
      "empty": "No roles to show yet. Create a role and evaluate it to see the overview.",
      "emptyCta": "Create a role"
    },
```

In the same file, inside `"dashboard"."help"`, add two keys after `"familiesReviewBody"`:

```json
      "pendingBandLabel": "Why does a role have no band yet?",
      "pendingBandBody": "A role gets a band only after every criterion is rated. Until the assessment is complete it has no weighting and no band, so it waits in this list."
```

(Remember to add the comma after the previous last entry so the JSON stays valid.)

- [ ] **Step 2: Mirror into `sv.json`** (draft, needs native review)

`dashboard.bands`:

```json
    "bands": {
      "heading": "Översikt",
      "description": "Banden och rollerna i varje band, härledda live från aktuell modell och bedömningar.",
      "viewLadder": "Stege",
      "viewMatrix": "Matris",
      "bandRow": "Band {band}",
      "bandRange": "{min}–{max}",
      "roleCount": "{count, plural, =1 {1 roll} other {# roller}}",
      "bandEmpty": "Inga roller i detta band",
      "pendingHeading": "Inte utvärderade ännu",
      "pendingDescription": "Dessa roller saknar band tills deras bedömning är klar.",
      "pendingProgress": "{rated}/{total} bedömda",
      "anchorLabel": "Ankarroll",
      "deviation": "≠ Band {band}",
      "deviationLabel": "Beräknat band avviker från det överenskomna bandet {band}",
      "empty": "Inga roller att visa ännu. Skapa en roll och utvärdera den för att se översikten.",
      "emptyCta": "Skapa en roll"
    },
```

`dashboard.help` additions:

```json
      "pendingBandLabel": "Varför har en roll inget band ännu?",
      "pendingBandBody": "En roll får ett band först när alla kriterier är bedömda. Tills bedömningen är klar har den ingen viktning och inget band, så den väntar i den här listan."
```

- [ ] **Step 3: Mirror into `nb.json`** (draft, needs native review)

`dashboard.bands`:

```json
    "bands": {
      "heading": "Oversikt",
      "description": "Bandene og rollene i hvert band, utledet live fra gjeldende modell og vurderinger.",
      "viewLadder": "Stige",
      "viewMatrix": "Matrise",
      "bandRow": "Band {band}",
      "bandRange": "{min}–{max}",
      "roleCount": "{count, plural, =1 {1 rolle} other {# roller}}",
      "bandEmpty": "Ingen roller i dette bandet",
      "pendingHeading": "Ikke vurdert ennå",
      "pendingDescription": "Disse rollene har ikke band før vurderingen er fullført.",
      "pendingProgress": "{rated}/{total} vurdert",
      "anchorLabel": "Ankerrolle",
      "deviation": "≠ Band {band}",
      "deviationLabel": "Beregnet band avviker fra det avtalte bandet {band}",
      "empty": "Ingen roller å vise ennå. Opprett en rolle og vurder den for å se oversikten.",
      "emptyCta": "Opprett en rolle"
    },
```

`dashboard.help` additions:

```json
      "pendingBandLabel": "Hvorfor har en rolle ikke band ennå?",
      "pendingBandBody": "En rolle får band først når alle kriterier er vurdert. Inntil vurderingen er fullført har den ingen vekting og intet band, så den venter i denne listen."
```

- [ ] **Step 4: Mirror into `da.json`** (draft, needs native review)

`dashboard.bands`:

```json
    "bands": {
      "heading": "Oversigt",
      "description": "Bånd og rollerne i hvert bånd, udledt live fra den aktuelle model og vurderinger.",
      "viewLadder": "Stige",
      "viewMatrix": "Matrix",
      "bandRow": "Band {band}",
      "bandRange": "{min}–{max}",
      "roleCount": "{count, plural, =1 {1 rolle} other {# roller}}",
      "bandEmpty": "Ingen roller i dette bånd",
      "pendingHeading": "Endnu ikke vurderet",
      "pendingDescription": "Disse roller har intet bånd, før deres vurdering er fuldført.",
      "pendingProgress": "{rated}/{total} vurderet",
      "anchorLabel": "Ankerrolle",
      "deviation": "≠ Band {band}",
      "deviationLabel": "Det beregnede bånd afviger fra det aftalte bånd {band}",
      "empty": "Ingen roller at vise endnu. Opret en rolle og vurder den for at se oversigten.",
      "emptyCta": "Opret en rolle"
    },
```

`dashboard.help` additions:

```json
      "pendingBandLabel": "Hvorfor har en rolle endnu intet bånd?",
      "pendingBandBody": "En rolle får først et bånd, når alle kriterier er vurderet. Indtil vurderingen er fuldført har den ingen vægtning og intet bånd, så den venter på denne liste."
```

- [ ] **Step 5: Mirror into `fi.json`** (draft, needs native review)

`dashboard.bands`:

```json
    "bands": {
      "heading": "Yleiskatsaus",
      "description": "Bandit ja kunkin bandin roolit, johdettu reaaliaikaisesti nykyisestä mallista ja arvioinneista.",
      "viewLadder": "Tikkaat",
      "viewMatrix": "Matriisi",
      "bandRow": "Band {band}",
      "bandRange": "{min}–{max}",
      "roleCount": "{count, plural, =1 {1 rooli} other {# roolia}}",
      "bandEmpty": "Ei rooleja tässä bandissa",
      "pendingHeading": "Ei vielä arvioitu",
      "pendingDescription": "Näillä rooleilla ei ole bandia ennen kuin arviointi on valmis.",
      "pendingProgress": "{rated}/{total} arvioitu",
      "anchorLabel": "Ankkurirooli",
      "deviation": "≠ Band {band}",
      "deviationLabel": "Laskettu band poikkeaa sovitusta bandista {band}",
      "empty": "Ei vielä näytettäviä rooleja. Luo rooli ja arvioi se nähdäksesi yleiskatsauksen.",
      "emptyCta": "Luo rooli"
    },
```

`dashboard.help` additions:

```json
      "pendingBandLabel": "Miksi roolilla ei vielä ole bandia?",
      "pendingBandBody": "Rooli saa bandin vasta, kun jokainen kriteeri on arvioitu. Kunnes arviointi on valmis, sillä ei ole painotusta eikä bandia, joten se odottaa tässä luettelossa."
```

- [ ] **Step 6: Run the parity test**

Run: `cd packages/i18n && bun run test`
Expected: PASS (key sets identical across all five locales).

- [ ] **Step 7: Commit**

```bash
git add packages/i18n/messages
git commit -m "feat(i18n): add dashboard.bands namespace and pending-band help

sv/nb/da/fi values are machine drafts and need native review.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `RoleChip` component

**Files:**
- Create: `apps/dashboard/components/bands/role-chip.tsx`
- Test: `apps/dashboard/components/bands/role-chip.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/components/bands/role-chip.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { RoleChip } from "@/components/bands/role-chip"
import type { BandRoleRow } from "@/lib/bands"

function row(overrides: Partial<BandRoleRow>): BandRoleRow {
  return {
    roleId: "r1",
    title: "Staff Engineer",
    trackKey: "IC",
    trackName: "Individual contributor",
    score: 78,
    band: 3,
    ratedCount: 9,
    totalCriteria: 9,
    familyId: null,
    familyName: null,
    anchor: null,
    ...overrides,
  }
}

function renderChip(r: BandRoleRow) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleChip role={r} />
    </NextIntlClientProvider>
  )
}

describe("RoleChip", () => {
  afterEach(() => cleanup())

  it("links to the role and shows the title and weighting", () => {
    renderChip(row({}))
    const link = screen.getByRole("link", { name: /Staff Engineer/ })
    expect(link.getAttribute("href")).toBe("/roles/r1")
    expect(screen.getByText("78")).toBeDefined()
  })

  it("flags an anchor whose computed band deviates from the agreed band", () => {
    renderChip(row({ band: 3, anchor: { expectedBand: 2, status: "active" } }))
    const expected = messages.dashboard.bands.deviation.replace("{band}", "2")
    expect(screen.getByText(expected)).toBeDefined()
  })

  it("shows no deviation flag when the computed band matches the agreed band", () => {
    renderChip(row({ band: 2, anchor: { expectedBand: 2, status: "active" } }))
    const expected = messages.dashboard.bands.deviation.replace("{band}", "2")
    expect(screen.queryByText(expected)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/dashboard && bun run test role-chip.test.tsx`
Expected: FAIL with "Failed to resolve import @/components/bands/role-chip".

- [ ] **Step 3: Create the component**

Create `apps/dashboard/components/bands/role-chip.tsx`:

```tsx
"use client"

import { AnchorIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { TrackBadge } from "@/components/track-badge"
import type { BandRoleRow } from "@/lib/bands"

// One role rendered as a chip in the band ladder or matrix. Data is neutral
// ink, never brand. Anchor roles carry the anchor marker; a computed band
// that deviates from the agreed band shows a destructive flag, the one
// intentional colored accent (an alert to act on, not a judgement of the
// role). Clicking the chip opens the role.
export function RoleChip({ role }: { role: BandRoleRow }) {
  const t = useTranslations("dashboard.bands")
  const deviates =
    role.anchor !== null &&
    role.band !== null &&
    role.band !== role.anchor.expectedBand

  return (
    <Link
      href={`/roles/${role.roleId}`}
      className="inline-flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-sm hover:bg-accent"
    >
      {role.anchor !== null && (
        <HugeiconsIcon
          icon={AnchorIcon}
          size={14}
          strokeWidth={2}
          className="shrink-0 text-muted-foreground"
          aria-label={t("anchorLabel")}
        />
      )}
      <span className="truncate font-medium">{role.title}</span>
      <TrackBadge trackKey={role.trackKey} name={role.trackName} />
      {role.score !== null && (
        <span className="text-muted-foreground text-xs tabular-nums">
          {role.score}
        </span>
      )}
      {deviates && role.anchor !== null && (
        <Badge
          variant="destructive"
          title={t("deviationLabel", { band: role.anchor.expectedBand })}
        >
          {t("deviation", { band: role.anchor.expectedBand })}
        </Badge>
      )}
    </Link>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/dashboard && bun run test role-chip.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/bands/role-chip.tsx apps/dashboard/components/bands/role-chip.test.tsx
git commit -m "feat(bands): add RoleChip with inline anchor marker and deviation flag

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `BandLadder` component

**Files:**
- Create: `apps/dashboard/components/bands/band-ladder.tsx`
- Test: `apps/dashboard/components/bands/band-ladder.test.tsx`

- [ ] **Step 1: Read the animation rules**

Run: open and read `docs/ui-animation.md`. Required before writing any Motion code. The chip wrappers below use `layout` + a per-view `layoutId` so a role animates to its new lane when its band changes; the wrapper does not resize (same chip), so rule 1's scale-warp does not apply, and reduced motion is honoured globally by the app's `MotionConfig`.

- [ ] **Step 2: Write the failing test**

Create `apps/dashboard/components/bands/band-ladder.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { BandLadder } from "@/components/bands/band-ladder"
import type { BandRoleRow } from "@/lib/bands"

const BANDS = [
  { band: 1, minScore: 80 },
  { band: 2, minScore: 0 },
]

function role(overrides: Partial<BandRoleRow>): BandRoleRow {
  return {
    roleId: "r1",
    title: "CTO",
    trackKey: "M",
    trackName: "Manager",
    score: 90,
    band: 1,
    ratedCount: 9,
    totalCriteria: 9,
    familyId: null,
    familyName: null,
    anchor: null,
    ...overrides,
  }
}

function renderLadder(rows: BandRoleRow[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BandLadder bands={BANDS} rows={rows} />
    </NextIntlClientProvider>
  )
}

describe("BandLadder", () => {
  afterEach(() => cleanup())

  it("renders a lane per band with the band 1 range topping at 100", () => {
    renderLadder([role({})])
    expect(screen.getByText("Band 1")).toBeDefined()
    expect(screen.getByText("Band 2")).toBeDefined()
    expect(screen.getByText("80–100")).toBeDefined()
  })

  it("places a role in its band and shows the empty note for empty bands", () => {
    renderLadder([role({ roleId: "r1", title: "CTO", band: 1 })])
    expect(screen.getByRole("link", { name: /CTO/ })).toBeDefined()
    expect(screen.getByText(messages.dashboard.bands.bandEmpty)).toBeDefined()
  })

  it("ignores roles without a band (they belong in the pending zone)", () => {
    renderLadder([role({ roleId: "r9", title: "Draftee", band: null })])
    expect(screen.queryByRole("link", { name: /Draftee/ })).toBeNull()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd apps/dashboard && bun run test band-ladder.test.tsx`
Expected: FAIL with "Failed to resolve import @/components/bands/band-ladder".

- [ ] **Step 4: Create the component**

Create `apps/dashboard/components/bands/band-ladder.tsx`:

```tsx
"use client"

import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { RoleChip } from "@/components/bands/role-chip"
import { type BandRoleRow, bandRanges } from "@/lib/bands"
import { SPRING } from "@/lib/motion"

// Vertical band ladder: one lane per band, Band 1 (highest) on top. Roles
// wrap as chips inside their lane, ordered by the incoming order (getResults
// already sorts by weighting desc within a band). Empty bands stay visible so
// the full band structure always reads. Chips animate to their new lane when
// a role's band changes (layoutId), per docs/ui-animation.md.
export function BandLadder({
  bands,
  rows,
}: {
  bands: { band: number; minScore: number }[]
  rows: BandRoleRow[]
}) {
  const t = useTranslations("dashboard.bands")
  const ranges = bandRanges(bands)
  const placed = rows.filter((row) => row.band !== null)

  return (
    <ul className="space-y-2">
      {ranges.map((range) => {
        const inBand = placed.filter((row) => row.band === range.band)
        return (
          <li key={range.band} className="rounded-xl border p-3">
            <div className="flex gap-4">
              <div className="w-28 shrink-0">
                <div className="font-semibold text-sm">
                  {t("bandRow", { band: range.band })}
                </div>
                <div className="text-muted-foreground text-xs tabular-nums">
                  {t("bandRange", { min: range.min, max: range.max })}
                </div>
                <div className="text-muted-foreground text-xs">
                  {t("roleCount", { count: inBand.length })}
                </div>
              </div>
              <div className="flex flex-1 flex-wrap gap-2">
                {inBand.length === 0 ? (
                  <span className="self-center text-muted-foreground text-sm italic">
                    {t("bandEmpty")}
                  </span>
                ) : (
                  <AnimatePresence initial={false}>
                    {inBand.map((role) => (
                      <motion.div
                        key={role.roleId}
                        layout
                        layoutId={`ladder-${role.roleId}`}
                        transition={SPRING}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <RoleChip role={role} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/dashboard && bun run test band-ladder.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/components/bands/band-ladder.tsx apps/dashboard/components/bands/band-ladder.test.tsx
git commit -m "feat(bands): add BandLadder vertical band view

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `BandMatrix` component

**Files:**
- Create: `apps/dashboard/components/bands/band-matrix.tsx`
- Test: `apps/dashboard/components/bands/band-matrix.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/components/bands/band-matrix.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { BandMatrix } from "@/components/bands/band-matrix"
import type { BandRoleRow } from "@/lib/bands"

const BANDS = [
  { band: 1, minScore: 80 },
  { band: 2, minScore: 0 },
]

function role(overrides: Partial<BandRoleRow>): BandRoleRow {
  return {
    roleId: "r1",
    title: "CTO",
    trackKey: "M",
    trackName: "Manager",
    score: 90,
    band: 1,
    ratedCount: 9,
    totalCriteria: 9,
    familyId: null,
    familyName: null,
    anchor: null,
    ...overrides,
  }
}

function renderMatrix(rows: BandRoleRow[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BandMatrix bands={BANDS} rows={rows} />
    </NextIntlClientProvider>
  )
}

describe("BandMatrix", () => {
  afterEach(() => cleanup())

  it("renders a column header per present track in IC, Lead, M order", () => {
    renderMatrix([
      role({ roleId: "m1", trackKey: "M", trackName: "Manager" }),
      role({ roleId: "i1", trackKey: "IC", trackName: "Individual contributor" }),
    ])
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent)
    // Empty corner cell first, then IC before M.
    expect(headers).toEqual(["", "Individual contributor", "Manager"])
  })

  it("places a role in the cell where its band meets its track", () => {
    renderMatrix([role({ roleId: "m1", title: "CTO", band: 1, trackKey: "M" })])
    expect(screen.getByText("Band 1")).toBeDefined()
    expect(screen.getByRole("link", { name: /CTO/ })).toBeDefined()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/dashboard && bun run test band-matrix.test.tsx`
Expected: FAIL with "Failed to resolve import @/components/bands/band-matrix".

- [ ] **Step 3: Create the component**

Create `apps/dashboard/components/bands/band-matrix.tsx`:

```tsx
"use client"

import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { RoleChip } from "@/components/bands/role-chip"
import { type BandRoleRow, bandRanges } from "@/lib/bands"
import { SPRING } from "@/lib/motion"

// The fixed V1 track order (ADR-0006). Columns are the tracks PRESENT in the
// filtered rows, sorted by this order; unknown future keys sort last.
const TRACK_ORDER: Record<string, number> = { IC: 0, Lead: 1, M: 2 }

// Band x track matrix: bands down (Band 1 on top), tracks across. Each role
// sits in the cell where its band meets its track, so the view shows how far
// each track reaches. Same neutral-ink chips and inline anchor treatment as
// the ladder.
export function BandMatrix({
  bands,
  rows,
}: {
  bands: { band: number; minScore: number }[]
  rows: BandRoleRow[]
}) {
  const t = useTranslations("dashboard.bands")
  const ranges = bandRanges(bands)
  const placed = rows.filter((row) => row.band !== null)
  const tracks = [
    ...new Map(placed.map((row) => [row.trackKey, row.trackName])).entries(),
  ]
    .sort((a, b) => (TRACK_ORDER[a[0]] ?? 99) - (TRACK_ORDER[b[0]] ?? 99))
    .map(([key, name]) => ({ key, name }))

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-2">
        <thead>
          <tr>
            <th className="w-24" />
            {tracks.map((track) => (
              <th
                key={track.key}
                className="text-left font-medium text-muted-foreground text-xs uppercase tracking-wide"
              >
                {track.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ranges.map((range) => (
            <tr key={range.band}>
              <td className="align-middle">
                <div className="font-semibold text-sm">
                  {t("bandRow", { band: range.band })}
                </div>
                <div className="text-muted-foreground text-xs tabular-nums">
                  {t("bandRange", { min: range.min, max: range.max })}
                </div>
              </td>
              {tracks.map((track) => {
                const cell = placed.filter(
                  (row) => row.band === range.band && row.trackKey === track.key
                )
                return (
                  <td
                    key={track.key}
                    className="min-w-32 rounded-lg border p-2 align-top"
                  >
                    <div className="flex flex-col gap-2">
                      <AnimatePresence initial={false}>
                        {cell.map((role) => (
                          <motion.div
                            key={role.roleId}
                            layout
                            layoutId={`matrix-${role.roleId}`}
                            transition={SPRING}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          >
                            <RoleChip role={role} />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/dashboard && bun run test band-matrix.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/bands/band-matrix.tsx apps/dashboard/components/bands/band-matrix.test.tsx
git commit -m "feat(bands): add BandMatrix band-by-track view

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `PendingRoles` component

**Files:**
- Create: `apps/dashboard/components/bands/pending-roles.tsx`
- Test: `apps/dashboard/components/bands/pending-roles.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/components/bands/pending-roles.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { PendingRoles } from "@/components/bands/pending-roles"
import type { BandRoleRow } from "@/lib/bands"

function role(overrides: Partial<BandRoleRow>): BandRoleRow {
  return {
    roleId: "r1",
    title: "Data Analyst",
    trackKey: "IC",
    trackName: "Individual contributor",
    score: null,
    band: null,
    ratedCount: 3,
    totalCriteria: 9,
    familyId: null,
    familyName: null,
    anchor: null,
    ...overrides,
  }
}

function renderPending(rows: BandRoleRow[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PendingRoles rows={rows} />
    </NextIntlClientProvider>
  )
}

describe("PendingRoles", () => {
  afterEach(() => cleanup())

  it("lists roles without a band, with rating progress and a link", () => {
    renderPending([role({})])
    expect(screen.getByText(messages.dashboard.bands.pendingHeading)).toBeDefined()
    expect(screen.getByText("3/9 rated")).toBeDefined()
    expect(
      screen.getByRole("link", { name: /Data Analyst/ }).getAttribute("href")
    ).toBe("/roles/r1")
  })

  it("ignores roles that already have a band", () => {
    renderPending([role({ roleId: "r2", title: "Engineer", band: 5, score: 58 })])
    expect(screen.queryByText(messages.dashboard.bands.pendingHeading)).toBeNull()
  })

  it("renders nothing when there are no pending roles", () => {
    const { container } = renderPending([])
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/dashboard && bun run test pending-roles.test.tsx`
Expected: FAIL with "Failed to resolve import @/components/bands/pending-roles".

- [ ] **Step 3: Create the component**

Create `apps/dashboard/components/bands/pending-roles.tsx`:

```tsx
"use client"

import { useTranslations } from "next-intl"
import Link from "next/link"
import { HelpMorphButton } from "@/components/help-morph-button"
import { TrackBadge } from "@/components/track-badge"
import type { BandRoleRow } from "@/lib/bands"

// The "not yet evaluated" zone: roles whose assessment is incomplete have no
// band (band null) and wait here with their rating progress. Clicking opens
// the role, where the assessment can be continued. Disappears entirely when
// every role has a band.
export function PendingRoles({ rows }: { rows: BandRoleRow[] }) {
  const t = useTranslations("dashboard.bands")
  const tHelp = useTranslations("dashboard.help")
  const pending = rows.filter((row) => row.band === null)
  if (pending.length === 0) return null

  return (
    <div className="rounded-xl border border-dashed p-3">
      <div className="mb-1 flex items-center gap-1.5">
        <h3 className="font-medium text-sm">{t("pendingHeading")}</h3>
        <HelpMorphButton label={tHelp("pendingBandLabel")}>
          {tHelp("pendingBandBody")}
        </HelpMorphButton>
      </div>
      <p className="mb-3 text-muted-foreground text-sm">
        {t("pendingDescription")}
      </p>
      <div className="flex flex-wrap gap-2">
        {pending.map((role) => (
          <Link
            key={role.roleId}
            href={`/roles/${role.roleId}`}
            className="inline-flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5 text-muted-foreground text-sm hover:bg-accent"
          >
            <span className="truncate font-medium">{role.title}</span>
            <TrackBadge trackKey={role.trackKey} name={role.trackName} />
            <span className="text-xs tabular-nums">
              {t("pendingProgress", {
                rated: role.ratedCount,
                total: role.totalCriteria,
              })}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/dashboard && bun run test pending-roles.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/bands/pending-roles.tsx apps/dashboard/components/bands/pending-roles.test.tsx
git commit -m "feat(bands): add PendingRoles not-yet-evaluated zone

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: The Work Overview page (`/work`)

**Files:**
- Create: `apps/dashboard/app/(app)/work/page.tsx`
- Test: `apps/dashboard/app/(app)/work/page.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/app/(app)/work/page.test.tsx` (mirrors the convex-mock pattern in `app/(app)/page.test.tsx`):

```tsx
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { onQuery } from "@/test/convex-mocks"

const useQueryMock = vi.fn()
onQuery((ref, args) => useQueryMock(ref, args))

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: "admin" }),
}))

import WorkOverviewPage from "@/app/(app)/work/page"

function bandRow(overrides: Record<string, unknown>) {
  return {
    roleId: "r1",
    title: "CTO",
    trackKey: "M",
    trackName: "Manager",
    status: "approved",
    complete: true,
    ratedCount: 9,
    totalCriteria: 9,
    score: 90,
    band: 1,
    familyId: null,
    familyName: null,
    anchor: null,
    ...overrides,
  }
}

function results(rows: Array<Record<string, unknown>>) {
  return {
    rows,
    bands: [
      { band: 1, minScore: 80 },
      { band: 2, minScore: 0 },
    ],
  }
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WorkOverviewPage />
    </NextIntlClientProvider>
  )
}

describe("WorkOverviewPage", () => {
  beforeEach(() => useQueryMock.mockReset())
  afterEach(() => cleanup())

  it("shows the empty state when there are no roles", () => {
    useQueryMock.mockImplementation((ref: string) =>
      ref === "assessment.results.getResults" ? results([]) : undefined
    )
    renderPage()
    expect(screen.getByText(messages.dashboard.bands.empty)).toBeDefined()
  })

  it("renders the ladder with both view toggles when roles exist", () => {
    useQueryMock.mockImplementation((ref: string) =>
      ref === "assessment.results.getResults"
        ? results([bandRow({})])
        : undefined
    )
    renderPage()
    expect(screen.getByText(messages.dashboard.bands.viewLadder)).toBeDefined()
    expect(screen.getByText(messages.dashboard.bands.viewMatrix)).toBeDefined()
    // Ladder is the default view: the role chip is on screen.
    expect(screen.getByRole("link", { name: /CTO/ })).toBeDefined()
    expect(screen.getByText("Band 1")).toBeDefined()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/dashboard && bun run test "app/(app)/work/page.test.tsx"`
Expected: FAIL with "Failed to resolve import @/app/(app)/work/page".

- [ ] **Step 3: Create the page**

Create `apps/dashboard/app/(app)/work/page.tsx`:

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { useState } from "react"
import { BandLadder } from "@/components/bands/band-ladder"
import { BandMatrix } from "@/components/bands/band-matrix"
import { PendingRoles } from "@/components/bands/pending-roles"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"

// Sentinel for "show all families" in the Select.
const ALL_FAMILIES = "__all__"

// Work > Overview: the band ladder (default) and a band-by-track matrix
// toggle, scoped by an optional family filter. Score and band recompute
// reactively from the model and ratings (ADR-0002: never stored).
export default function WorkOverviewPage() {
  const t = useTranslations("dashboard.bands")
  const tHelp = useTranslations("dashboard.help")
  const tFamily = useTranslations("dashboard.roles.family")
  const { orgId } = useOrganization()
  const locale = useLocale()
  const results = useQuery(api.assessment.results.getResults, { orgId, locale })
  const [familyFilter, setFamilyFilter] = useState<string | null>(null)

  if (results === undefined) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={t("heading")} />
      </main>
    )
  }

  // Distinct families present in the rows, sorted by name (same order as the
  // grouped roles page).
  const familiesInResults = (() => {
    const seen = new Map<string, string>()
    for (const row of results.rows) {
      if (row.familyId !== null && row.familyName !== null) {
        seen.set(row.familyId as string, row.familyName)
      }
    }
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  })()
  const hasAnyFamily = familiesInResults.length > 0

  const filteredRows =
    familyFilter === null
      ? results.rows
      : results.rows.filter(
          (row) => (row.familyId as string | null) === familyFilter
        )

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-1.5">
          <h2 className="font-medium text-lg">{t("heading")}</h2>
          <HelpMorphButton label={tHelp("scoreLabel")}>
            {tHelp("scoreBody")}
          </HelpMorphButton>
        </div>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>
      {results.rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("heading")}</EmptyTitle>
            <EmptyDescription>{t("empty")}</EmptyDescription>
          </EmptyHeader>
          <Button asChild variant="outline">
            <Link href="/roles">{t("emptyCta")}</Link>
          </Button>
        </Empty>
      ) : (
        <Tabs defaultValue="ladder" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <TabsList variant="line">
              <TabsTrigger value="ladder">{t("viewLadder")}</TabsTrigger>
              <TabsTrigger value="matrix">{t("viewMatrix")}</TabsTrigger>
            </TabsList>
            {hasAnyFamily && (
              <Select
                value={familyFilter ?? ALL_FAMILIES}
                onValueChange={(next) =>
                  setFamilyFilter(next === ALL_FAMILIES ? null : next)
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FAMILIES}>{tFamily("all")}</SelectItem>
                  {familiesInResults.map((family) => (
                    <SelectItem key={family.id} value={family.id}>
                      {family.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <TabsContent value="ladder" className="space-y-4">
            <BandLadder bands={results.bands} rows={filteredRows} />
            <PendingRoles rows={filteredRows} />
          </TabsContent>
          <TabsContent value="matrix" className="space-y-4">
            <BandMatrix bands={results.bands} rows={filteredRows} />
            <PendingRoles rows={filteredRows} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/dashboard && bun run test "app/(app)/work/page.test.tsx"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add "apps/dashboard/app/(app)/work"
git commit -m "feat(bands): add Work > Overview page with ladder/matrix toggle

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Navigation, breadcrumbs, home links, and nav i18n

Code and the i18n keys it uses change together, so the commit stays green.

**Files:**
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (nav + overview rename)
- Modify: `apps/dashboard/components/app-sidebar.tsx`
- Modify: `apps/dashboard/components/nav-main.tsx`
- Modify: `apps/dashboard/components/site-header.tsx`
- Modify: `apps/dashboard/components/site-header.test.tsx`
- Modify: `apps/dashboard/app/(app)/page.tsx`

- [ ] **Step 1: Update nav + overview keys in every locale**

In each `packages/i18n/messages/*.json`, inside `dashboard.nav`: ADD `home` and `work`, REMOVE `results`. Keep `overview` (it now labels the band view child). Inside `dashboard.overview`: rename `goResults` to `goOverview` with the new value.

en.json - `dashboard.nav`:
```json
    "nav": {
      "home": "Home",
      "overview": "Overview",
      "work": "Work",
      "roles": "Roles",
      "model": "Model",
      "signOut": "Sign out"
    },
```
en.json - `dashboard.overview.goResults` becomes:
```json
      "goOverview": "View the overview",
```

Per-locale `home` / `work` / `goOverview` (drafts, native review):
- sv: `home` "Hem", `work` "Arbete", `goOverview` "Visa översikten"
- nb: `home` "Hjem", `work` "Arbeid", `goOverview` "Vis oversikten"
- da: `home` "Hjem", `work` "Arbejde", `goOverview` "Se oversigten"
- fi: `home` "Etusivu", `work` "Työ", `goOverview` "Näytä yleiskatsaus"

In each non-English file keep the existing `nav.overview` value as it already reads (it stays the band-view label), remove `nav.results`, and remove the old `overview.goResults`.

- [ ] **Step 2: Run the parity test (still green)**

Run: `cd packages/i18n && bun run test`
Expected: PASS.

- [ ] **Step 3: Rewrite `app-sidebar.tsx`**

Replace the whole file `apps/dashboard/components/app-sidebar.tsx` with:

```tsx
"use client"

import {
  Briefcase01Icon,
  Home01Icon,
  Layers01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from "@workspace/ui/components/sidebar"
import { useTranslations } from "next-intl"
import type * as React from "react"
import { type NavItem, NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const t = useTranslations("dashboard")

  // Home is the dashboard landing. Work groups the role world: the band
  // Overview and the role register. Results was removed; its band view moved
  // into Work > Overview.
  const navMain: NavItem[] = [
    {
      title: t("nav.home"),
      url: "/",
      icon: <HugeiconsIcon icon={Home01Icon} strokeWidth={2} />,
    },
    {
      title: t("nav.work"),
      icon: <HugeiconsIcon icon={Briefcase01Icon} strokeWidth={2} />,
      items: [
        { title: t("nav.overview"), url: "/work" },
        { title: t("nav.roles"), url: "/roles" },
      ],
    },
    {
      title: t("nav.model"),
      url: "/model",
      icon: <HugeiconsIcon icon={Layers01Icon} strokeWidth={2} />,
    },
  ]

  return (
    // collapsible="icon" (the sidebar-07 pattern): collapsing shrinks the
    // sidebar to an icon rail instead of removing it. The inset variant set
    // by AppShell keeps the rounded content panel in both states.
    <Sidebar collapsible="icon" {...props}>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
```

- [ ] **Step 4: Rewrite `nav-main.tsx` to support collapsible groups**

Replace the whole file `apps/dashboard/components/nav-main.tsx` with:

```tsx
"use client"

import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@workspace/ui/components/sidebar"
import Link from "next/link"
import { usePathname } from "next/navigation"

// A nav entry is either a leaf link (url) or a collapsible group (items).
export type NavItem = {
  title: string
  url?: string
  icon?: React.ReactNode
  items?: { title: string; url: string }[]
}

// The collapsed icon-rail tweaks shared by the leaf link and the group
// trigger: 20px icon, centered square, label hidden when collapsed.
const RAIL_CLASSES =
  "group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1.5! [&_svg]:size-5 group-data-[collapsible=icon]:[&_span]:hidden"

// Primary navigation. A leaf is active when its URL prefixes the path ("/"
// matches exactly); a group is active (and open by default) when any child
// is active.
export function NavMain({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname.startsWith(url)

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) =>
            item.items === undefined ? (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={item.url !== undefined && isActive(item.url)}
                  tooltip={item.title}
                  className={RAIL_CLASSES}
                >
                  <Link href={item.url ?? "#"}>
                    {item.icon}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : (
              <Collapsible
                key={item.title}
                asChild
                defaultOpen={item.items.some((sub) => isActive(sub.url))}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={item.items.some((sub) => isActive(sub.url))}
                      tooltip={item.title}
                      className={RAIL_CLASSES}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        strokeWidth={2}
                        className="ml-auto !size-4 transition-transform group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden"
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items.map((sub) => (
                        <SidebarMenuSubItem key={sub.title}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={isActive(sub.url)}
                          >
                            <Link href={sub.url}>
                              <span>{sub.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
```

- [ ] **Step 5: Update breadcrumbs in `site-header.tsx`**

In `apps/dashboard/components/site-header.tsx`, change the `BreadcrumbLabels` type (lines 29-35) to:

```ts
export type BreadcrumbLabels = {
  home: string
  workOverview: string
  roles: string
  model: string
  rate: string
}
```

Change the top-level section handling in `buildBreadcrumbs` (lines 51-54) to:

```ts
  if (section === undefined) return [{ label: labels.home }]
  if (section === "model") return [{ label: labels.model }]
  if (section === "work") return [{ label: labels.workOverview }]
  if (section !== "roles") return [{ label: labels.home }]
```

Change the labels object passed in `SiteHeader` (lines 132-139) to:

```ts
    {
      home: t("nav.home"),
      workOverview: t("nav.overview"),
      roles: t("nav.roles"),
      model: t("nav.model"),
      rate: t("breadcrumb.rate"),
    },
```

- [ ] **Step 6: Update `site-header.test.tsx`**

In `apps/dashboard/components/site-header.test.tsx`, replace the `LABELS` constant (lines 6-12) with:

```ts
const LABELS = {
  home: "Home",
  workOverview: "Overview",
  roles: "Roles",
  model: "Model",
  rate: "Rate",
}
```

Replace the first `it(...)` in `describe("buildBreadcrumbs", ...)` (the top-level-section test) with:

```ts
  it("renders a single current-page crumb for each top-level section", () => {
    expect(buildBreadcrumbs("/", LABELS, {})).toEqual([{ label: "Home" }])
    expect(buildBreadcrumbs("/roles", LABELS, {})).toEqual([{ label: "Roles" }])
    expect(buildBreadcrumbs("/model", LABELS, {})).toEqual([{ label: "Model" }])
    expect(buildBreadcrumbs("/work", LABELS, {})).toEqual([
      { label: "Overview" },
    ])
  })
```

In the `SiteHeader` describe block, update the top-level-route test to expect the home label "Home":

```ts
  it("shows the section as a non-link current page on a top-level route", () => {
    pathState.current = "/"
    renderHeader()
    expect(screen.getByText("Home").getAttribute("aria-current")).toBe("page")
    // No real anchors: the lone crumb is the current page.
    expect(document.querySelector("a")).toBeNull()
  })
```

- [ ] **Step 7: Repoint home page links to `/work`**

In `apps/dashboard/app/(app)/page.tsx`, the "approved" and "rated" cards link to `/results` with label `t("goResults")`. Change both card objects so `href: "/work"` and `linkLabel: t("goOverview")`. There are exactly two such cards (keys `approved` and `rated`); leave the `roles` and `criteria` cards untouched.

- [ ] **Step 8: Run the affected tests and a full typecheck**

Run: `cd apps/dashboard && bun run test site-header.test.tsx "app/(app)/page.test.tsx"`
Expected: PASS.
Run: `bun run typecheck` from the repo root (or let the pre-commit hook do it in the next step).
Expected: no errors. If typecheck reports a stray `t("nav.results")` or `t("overview.goResults")`, you missed a usage; fix it.

- [ ] **Step 9: Commit**

```bash
git add packages/i18n/messages apps/dashboard/components/app-sidebar.tsx apps/dashboard/components/nav-main.tsx apps/dashboard/components/site-header.tsx apps/dashboard/components/site-header.test.tsx "apps/dashboard/app/(app)/page.tsx"
git commit -m "feat(nav): collapsible Work group with Overview, rename home to Home

Removes the Results nav item; the band view now lives at Work > Overview.
sv/nb/da/fi nav strings are machine drafts and need native review.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Teardown - delete the old Results surface

By now nothing outside the deleted files references `dashboard.results.*` or the Results route. Verify, then remove.

**Files:**
- Delete: `apps/dashboard/app/(app)/results/page.tsx`
- Delete: `apps/dashboard/components/results/band-overview.tsx`
- Delete: `apps/dashboard/components/results/anchor-roles-panel.tsx`
- Delete: `apps/dashboard/components/results/anchor-roles-panel.test.tsx`
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (remove `dashboard.results`)

- [ ] **Step 1: Confirm there are no remaining references**

Run:
```bash
cd /Volumes/development/blueprnt/frontend
grep -rn "components/results/" apps/dashboard --include=*.tsx
grep -rn "dashboard.results" apps/dashboard --include=*.tsx
grep -rn "\"/results\"\|href=\"/results\"\|'/results'" apps/dashboard --include=*.tsx
```
Expected: matches only inside the four files about to be deleted. If anything else matches (for example a missed home-page link), fix that first.

- [ ] **Step 2: Delete the files**

```bash
cd /Volumes/development/blueprnt/frontend
git rm "apps/dashboard/app/(app)/results/page.tsx" \
  apps/dashboard/components/results/band-overview.tsx \
  apps/dashboard/components/results/anchor-roles-panel.tsx \
  apps/dashboard/components/results/anchor-roles-panel.test.tsx
```

If `apps/dashboard/components/results/` is now empty, that is fine (git does not track empty dirs).

- [ ] **Step 3: Remove the `dashboard.results` object from every locale**

In each `packages/i18n/messages/*.json`, delete the entire `"results": { ... }` object under `"dashboard"` (the one with `heading`, `description`, `bandsHeading`, `bandHighest`, `bandRow`, `roleCount`, `table`, `empty`, `emptyCta`, `anchors`). Do NOT touch `dashboard.rating.result` (a different key) or the new `dashboard.bands`. Keep the JSON valid (fix the trailing comma on the preceding object).

- [ ] **Step 4: Run the parity test and the dashboard tests**

Run: `cd packages/i18n && bun run test`
Expected: PASS (all five locales still match).
Run: `cd apps/dashboard && bun run test`
Expected: PASS. The `anchor-roles-panel.test.tsx` is gone; no test imports the deleted components.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(results): delete the old Results page and its i18n

The band view moved to Work > Overview (no legacy before launch).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final verification (after Task 10)

- [ ] Run the full suite from the repo root: `bun run test` (or `turbo run test`). Expected: all packages green.
- [ ] Run a full typecheck from the repo root: `bun run typecheck`. Expected: no errors.
- [ ] Manual smoke (optional, `bun dev` in `apps/dashboard`): the sidebar shows Home, Work (expandable to Overview + Roles), Model; `/work` shows the ladder, the Matrix toggle switches views, the family filter scopes both, anchor roles show the marker and a deviation flag when they disagree, and incomplete roles sit in the "Not yet evaluated" zone. `/results` is gone.

## Notes carried from the spec

- Band, score, and band membership stay derived at read time (ADR-0002); this plan stores nothing new.
- Data stays neutral ink; the deviation flag is the one intentional colored accent.
- Out of scope: drag-to-reband (band is never set by hand), Level (V2), and any change to band count or thresholds.
