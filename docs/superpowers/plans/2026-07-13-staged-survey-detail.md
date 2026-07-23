# Staged survey detail (Överblick / Analysera / Rapport) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the uncommitted P1 gender-gap view into a three-tab survey detail (Överblick default / Analysera / Rapport), with an Overview landing (headline gap + equality clock + gender donut), before committing.

**Architecture:** Add an `org` aggregate to the existing `getPayMappingGap` query. `PayMappingDetail` becomes a thin tab shell that issues that query once and passes the result to prop-driven tab contents: `PayMappingOverview` (Överblick), the existing gap tables + an extracted `PayMappingPopulation` (Analysera), and a `PayMappingReport` placeholder (Rapport). The equality clock is a pure formatter plus a Motion component.

**Tech Stack:** TypeScript, Convex (edge-runtime + convex-test), `@workspace/core` (pure engine, reused), Next.js 16, Base UI `Tabs`, the `@workspace/ui` chart kit (recharts) + gender tokens, Motion, next-intl, Vitest 4, Bun.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-13-staged-survey-detail-design.md`. Builds on the P1 gender-gap view and ADR-0012.
- The `org` aggregate is computed with the same pure `@workspace/core` engine (`computeGenderGap`); it is NOT small-cell masked (a population mean is not an individual salary), but `classifyPayGap` still runs so a missing gender or under-4 population reads as insufficient (no spurious gap).
- Equality clock: unpaid daily time = `|gapPct| / 100 * 8 * 3600` seconds, formatted `HH:MM:SS`; direction from the sign (positive gap = women behind); `null` gap or 0 seconds = no measurable gap. 8-hour workday is the convention.
- Adding a field to a Convex query still requires `bunx convex codegen` and staging `_generated/api.d.ts` (no new module, but the return validator changed).
- i18n: add keys to `en.json` first, then mirror to sv/nb/da/fi. Edit locale JSON with the Edit tool ONLY (shell double-encodes non-ASCII). Nordic strings are drafts flagged for native review. The parity test guards key coverage.
- No em dashes anywhere. All user-facing text via next-intl. Internal nav via `Link`. shadcn/Base UI defaults; charts via `ChartContainer`; skeletons content-shaped and measuring identical to data. Animation respects reduced motion (`MotionConfig` is global; never bypass).
- `PayGapFlag`, `classifyPayGap`, `computeGenderGap` come from `@workspace/core` (already built). The flag chip is `PayGapFlagBadge` (already built, tinted, WCAG-AA).
- Commits: Conventional Commits, no AI attribution. New code ships with tests in the same commit; the pre-commit hook runs Biome + typecheck + full `turbo run test`.

---

### Task 1: Add the `org` aggregate to `getPayMappingGap`

**Files:**
- Modify: `packages/backend/convex/payMapping/gap.ts`
- Test: `packages/backend/convex/payMapping/gap.test.ts`
- Regenerate: `packages/backend/convex/_generated/api.d.ts`

**Interfaces:**
- Consumes: `computeGenderGap`, `PayGapFlag` from `@workspace/core` (already imported); `fteTotalMonthlyComp` from `@workspace/constants` (already imported).
- Produces: the query return gains `org: { womenCount: number; menCount: number; womenMeanComp: number | null; menMeanComp: number | null; gapPct: number | null; flag: PayGapFlag }`. Existing `currency`, `lika`, `likvardigt`, `unbandedCount` unchanged.

- [ ] **Step 1: Write the failing test**

Add to `packages/backend/convex/payMapping/gap.test.ts` inside `describe("getPayMappingGap")`:

```ts
it("returns an org-level aggregate over all priced rows (not masked)", async () => {
  const t = initConvexTest()
  // 3 women @ 90k, 3 men @ 100k across two roles => org gap 10%.
  const { orgId, runId, asHr } = await seedRun(t, [
    { gender: "Kvinna", roleTitle: "SWE", level: "Mid", band: 2, basicMonthly: 90000 },
    { gender: "Kvinna", roleTitle: "SWE", level: "Mid", band: 2, basicMonthly: 90000 },
    { gender: "Kvinna", roleTitle: "PM", level: "Mid", band: 3, basicMonthly: 90000 },
    { gender: "Man", roleTitle: "SWE", level: "Mid", band: 2, basicMonthly: 100000 },
    { gender: "Man", roleTitle: "PM", level: "Mid", band: 3, basicMonthly: 100000 },
    { gender: "Man", roleTitle: "PM", level: "Mid", band: 3, basicMonthly: 100000 },
  ])

  const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
    orgId,
    runId,
  })

  expect(result?.org.womenCount).toBe(3)
  expect(result?.org.menCount).toBe(3)
  // Org means are real population averages, never masked.
  expect(result?.org.womenMeanComp).toBeCloseTo(90000, 0)
  expect(result?.org.menMeanComp).toBeCloseTo(100000, 0)
  expect(result?.org.gapPct).toBeCloseTo(10, 5)
  expect(result?.org.flag).toBe("elevated")
})

it("marks the org gap insufficient when a gender is missing", async () => {
  const t = initConvexTest()
  const { orgId, runId, asHr } = await seedRun(t, [
    { gender: "Man", roleTitle: "SWE", level: "Mid", band: 2, basicMonthly: 100000 },
    { gender: "Man", roleTitle: "SWE", level: "Mid", band: 2, basicMonthly: 100000 },
  ])

  const result = await asHr.query(api.payMapping.gap.getPayMappingGap, {
    orgId,
    runId,
  })

  expect(result?.org.flag).toBe("insufficient")
  expect(result?.org.gapPct).toBeNull()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/backend && bunx vitest run convex/payMapping/gap.test.ts`
Expected: FAIL (`result.org` is undefined; the return shape has no `org`).

- [ ] **Step 3: Implement the org aggregate**

In `packages/backend/convex/payMapping/gap.ts`, add an org-aggregate validator next to `gapGroupShape`:

```ts
const orgAggregateShape = v.object({
  womenCount: v.number(),
  menCount: v.number(),
  womenMeanComp: v.union(v.number(), v.null()),
  menMeanComp: v.union(v.number(), v.null()),
  gapPct: v.union(v.number(), v.null()),
  flag: v.union(
    v.literal("critical"),
    v.literal("elevated"),
    v.literal("ok"),
    v.literal("insufficient")
  ),
})
```

Add `org: orgAggregateShape` to the query's `returns` object (alongside `currency`, `lika`, `likvardigt`, `unbandedCount`).

In the handler, after `priced` is computed and before returning, build the org aggregate over ALL priced rows (no masking):

```ts
    const orgWomen: number[] = []
    const orgMen: number[] = []
    for (const row of priced) {
      if (row.gender === "Kvinna") orgWomen.push(comp(row))
      else orgMen.push(comp(row))
    }
    const orgStats = computeGenderGap(orgWomen, orgMen)
    const org = {
      womenCount: orgStats.womenCount,
      menCount: orgStats.menCount,
      womenMeanComp: orgStats.womenMeanComp,
      menMeanComp: orgStats.menMeanComp,
      gapPct: orgStats.gapPct,
      flag: orgStats.flag as PayGapFlag,
    }
```

Add `org` to the returned object: `return { currency, org, lika, likvardigt, unbandedCount }`.

- [ ] **Step 4: Run codegen and stage the generated api**

Run: `cd packages/backend && bunx convex codegen`
Expected: `convex/_generated/api.d.ts` updates the `getPayMappingGap` return type with `org`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/backend && bunx vitest run convex/payMapping/gap.test.ts`
Expected: PASS (all existing cases plus the two new ones).

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/payMapping/gap.ts packages/backend/convex/payMapping/gap.test.ts packages/backend/convex/_generated/api.d.ts
git commit -m "feat(pay-mapping): add an org-level aggregate to getPayMappingGap"
```

---

### Task 2: i18n for the staged surfaces (all 5 locales)

**Files:**
- Modify: `packages/i18n/messages/en.json` (source), then `sv.json`, `nb.json`, `da.json`, `fi.json`

**Interfaces:**
- Produces: `dashboard.payMapping.tabs.*`, `dashboard.payMapping.overview.*`, `dashboard.payMapping.clock.*`, `dashboard.payMapping.report.*`, and `dashboard.help.equalityClock*` / `headlineGap*`, consumed by Tasks 3-6. The donut reuses the existing `dashboard.payMapping.gap.columns.women` / `.men`.

- [ ] **Step 1: Add the blocks to `dashboard.payMapping` and `dashboard.help` in `en.json`**

Inside `dashboard.payMapping` (sibling of `gap`):

```json
"tabs": { "overview": "Overview", "analysis": "Analysis", "report": "Report" },
"overview": {
  "headlineGapLabel": "Pay gap",
  "womenMean": "Women average",
  "menMean": "Men average",
  "insufficient": "Not enough data for an organization-level gap.",
  "donutTitle": "Gender split"
},
"clock": {
  "label": "Equality clock",
  "womenBehind": "Women effectively work {time} per working day unpaid compared with men.",
  "menBehind": "Men effectively work {time} per working day unpaid compared with women.",
  "noGap": "No measurable pay gap between women and men."
},
"report": {
  "comingSoonTitle": "Report and export",
  "comingSoonBody": "A signable summary for the union and employer, per-employee and action exports, and the EU Art. 9 filing are coming. They will be generated from this frozen survey."
}
```

Inside `dashboard.help`:

```json
"equalityClockLabel": "Equality clock",
"equalityClockBody": "The pay gap shown as time: the share of an 8-hour working day that the lower-paid gender works without matching pay. It is derived from the average gap, not a schedule.",
"headlineGapLabel": "Organization pay gap",
"headlineGapBody": "The average pay gap between all women and all men in the survey (FTE-adjusted total pay). A positive value means women earn less. It is a whole-population figure, so it is shown even when individual groups are small."
```

- [ ] **Step 2: Mirror to `sv.json`**

`dashboard.payMapping`:

```json
"tabs": { "overview": "Översikt", "analysis": "Analys", "report": "Rapport" },
"overview": {
  "headlineGapLabel": "Lönegap",
  "womenMean": "Medel kvinnor",
  "menMean": "Medel män",
  "insufficient": "Otillräckligt underlag för ett lönegap på organisationsnivå.",
  "donutTitle": "Könsfördelning"
},
"clock": {
  "label": "Jämställdhetsklocka",
  "womenBehind": "Kvinnor arbetar i praktiken {time} per arbetsdag oavlönat jämfört med män.",
  "menBehind": "Män arbetar i praktiken {time} per arbetsdag oavlönat jämfört med kvinnor.",
  "noGap": "Inget mätbart lönegap mellan kvinnor och män."
},
"report": {
  "comingSoonTitle": "Rapport och export",
  "comingSoonBody": "En signerbar sammanställning för facket och arbetsgivaren, export per medarbetare och åtgärd, samt EU:s artikel 9-rapport är på väg. De genereras från den här frysta kartläggningen."
}
```

`dashboard.help`:

```json
"equalityClockLabel": "Jämställdhetsklocka",
"equalityClockBody": "Lönegapet uttryckt som tid: hur stor del av en 8-timmars arbetsdag som det lägre betalda könet arbetar utan motsvarande lön. Den härleds ur genomsnittsgapet, inte ur ett schema.",
"headlineGapLabel": "Lönegap på organisationsnivå",
"headlineGapBody": "Det genomsnittliga lönegapet mellan alla kvinnor och alla män i kartläggningen (FTE-justerad totallön). Ett positivt värde betyder att kvinnor tjänar mindre. Det är en siffra för hela populationen och visas även när enskilda grupper är små."
```

- [ ] **Step 3: Mirror to `nb.json` (draft)**

`dashboard.payMapping`:

```json
"tabs": { "overview": "Oversikt", "analysis": "Analyse", "report": "Rapport" },
"overview": {
  "headlineGapLabel": "Lønnsgap",
  "womenMean": "Snitt kvinner",
  "menMean": "Snitt menn",
  "insufficient": "Utilstrekkelig grunnlag for et lønnsgap på organisasjonsnivå.",
  "donutTitle": "Kjønnsfordeling"
},
"clock": {
  "label": "Likestillingsklokke",
  "womenBehind": "Kvinner arbeider i praksis {time} per arbeidsdag ubetalt sammenlignet med menn.",
  "menBehind": "Menn arbeider i praksis {time} per arbeidsdag ubetalt sammenlignet med kvinner.",
  "noGap": "Ingen målbar lønnsforskjell mellom kvinner og menn."
},
"report": {
  "comingSoonTitle": "Rapport og eksport",
  "comingSoonBody": "En signerbar oppsummering for fagforeningen og arbeidsgiveren, eksport per ansatt og tiltak, og EUs artikkel 9-rapport kommer. De genereres fra denne fryste kartleggingen."
}
```

`dashboard.help`:

```json
"equalityClockLabel": "Likestillingsklokke",
"equalityClockBody": "Lønnsgapet uttrykt som tid: hvor stor del av en 8-timers arbeidsdag det lavere betalte kjønnet arbeider uten tilsvarende lønn. Den utledes fra gjennomsnittsgapet, ikke fra en timeplan.",
"headlineGapLabel": "Lønnsgap på organisasjonsnivå",
"headlineGapBody": "Det gjennomsnittlige lønnsgapet mellom alle kvinner og alle menn i kartleggingen (FTE-justert totallønn). En positiv verdi betyr at kvinner tjener mindre. Det er et tall for hele populasjonen og vises selv når enkeltgrupper er små."
```

- [ ] **Step 4: Mirror to `da.json` (draft)**

`dashboard.payMapping`:

```json
"tabs": { "overview": "Oversigt", "analysis": "Analyse", "report": "Rapport" },
"overview": {
  "headlineGapLabel": "Løngab",
  "womenMean": "Gns. kvinder",
  "menMean": "Gns. mænd",
  "insufficient": "Utilstrækkeligt grundlag for et løngab på organisationsniveau.",
  "donutTitle": "Kønsfordeling"
},
"clock": {
  "label": "Ligestillingsur",
  "womenBehind": "Kvinder arbejder reelt {time} pr. arbejdsdag ubetalt sammenlignet med mænd.",
  "menBehind": "Mænd arbejder reelt {time} pr. arbejdsdag ubetalt sammenlignet med kvinder.",
  "noGap": "Ingen målbar lønforskel mellem kvinder og mænd."
},
"report": {
  "comingSoonTitle": "Rapport og eksport",
  "comingSoonBody": "En underskrivelig opsummering til fagforeningen og arbejdsgiveren, eksport pr. medarbejder og handling samt EU's artikel 9-rapport er på vej. De genereres ud fra denne frosne kortlægning."
}
```

`dashboard.help`:

```json
"equalityClockLabel": "Ligestillingsur",
"equalityClockBody": "Løngabet udtrykt som tid: hvor stor en del af en 8-timers arbejdsdag det lavere lønnede køn arbejder uden tilsvarende løn. Det udledes af det gennemsnitlige gab, ikke af et skema.",
"headlineGapLabel": "Løngab på organisationsniveau",
"headlineGapBody": "Det gennemsnitlige løngab mellem alle kvinder og alle mænd i kortlægningen (FTE-justeret totalløn). En positiv værdi betyder, at kvinder tjener mindre. Det er et tal for hele populationen og vises, selv når enkelte grupper er små."
```

- [ ] **Step 5: Mirror to `fi.json` (draft)**

`dashboard.payMapping`:

```json
"tabs": { "overview": "Yleiskatsaus", "analysis": "Analyysi", "report": "Raportti" },
"overview": {
  "headlineGapLabel": "Palkkaero",
  "womenMean": "Ka. naiset",
  "menMean": "Ka. miehet",
  "insufficient": "Riittämättömät tiedot organisaatiotason palkkaeroa varten.",
  "donutTitle": "Sukupuolijakauma"
},
"clock": {
  "label": "Tasa-arvokello",
  "womenBehind": "Naiset tekevät käytännössä {time} työpäivää kohti palkatta miehiin verrattuna.",
  "menBehind": "Miehet tekevät käytännössä {time} työpäivää kohti palkatta naisiin verrattuna.",
  "noGap": "Ei mitattavaa palkkaeroa naisten ja miesten välillä."
},
"report": {
  "comingSoonTitle": "Raportti ja vienti",
  "comingSoonBody": "Allekirjoitettava yhteenveto ammattiliitolle ja työnantajalle, henkilö- ja toimenpidekohtaiset viennit sekä EU:n 9 artiklan raportti ovat tulossa. Ne luodaan tästä jäädytetystä kartoituksesta."
}
```

`dashboard.help`:

```json
"equalityClockLabel": "Tasa-arvokello",
"equalityClockBody": "Palkkaero ilmaistuna aikana: kuinka suuren osan 8-tuntisesta työpäivästä pienempipalkkainen sukupuoli tekee ilman vastaavaa palkkaa. Se johdetaan keskimääräisestä erosta, ei työvuorolistasta.",
"headlineGapLabel": "Organisaatiotason palkkaero",
"headlineGapBody": "Keskimääräinen palkkaero kaikkien naisten ja kaikkien miesten välillä kartoituksessa (FTE-korjattu kokonaispalkka). Positiivinen arvo tarkoittaa, että naiset ansaitsevat vähemmän. Se on koko henkilöstön luku ja näytetään, vaikka yksittäiset ryhmät olisivat pieniä."
```

- [ ] **Step 6: Verify parity + no mojibake**

Run: `cd packages/i18n && bun run test`
Expected: PASS (parity across all 5 locales).

Run: `rg -n "Ã|Â|â€|ï¿½" packages/i18n/messages/*.json || echo "no mojibake"`
Expected: `no mojibake`.

- [ ] **Step 7: Commit**

```bash
git add packages/i18n/messages/en.json packages/i18n/messages/sv.json packages/i18n/messages/nb.json packages/i18n/messages/da.json packages/i18n/messages/fi.json
git commit -m "feat(i18n): strings for the staged survey detail and equality clock"
```

---

### Task 3: The equality clock (pure formatter + component)

**Files:**
- Create: `apps/dashboard/lib/equality-clock.ts`
- Test: `apps/dashboard/lib/equality-clock.test.ts`
- Create: `apps/dashboard/components/pay-mapping/equality-clock.tsx`
- Test: `apps/dashboard/components/pay-mapping/equality-clock.test.tsx`

**Interfaces:**
- Consumes: `dashboard.payMapping.clock.*` + `dashboard.help.equalityClock*` (Task 2); Motion (`motion/react`); `HelpMorphButton`.
- Produces: `equalityClock(gapPct: number | null): { seconds: number; direction: "womenBehind" | "menBehind" | "none"; display: string }` (pure); `EqualityClock({ gapPct }: { gapPct: number | null })` component.

- [ ] **Step 1: Write the failing pure test**

Create `apps/dashboard/lib/equality-clock.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { equalityClock } from "./equality-clock"

describe("equalityClock", () => {
  it("expresses a positive gap as women-behind daily unpaid time (8h workday)", () => {
    // 10% of 8h = 48 min.
    const r = equalityClock(10)
    expect(r.seconds).toBe(2880)
    expect(r.direction).toBe("womenBehind")
    expect(r.display).toBe("00:48:00")
  })

  it("expresses a negative gap as men-behind", () => {
    const r = equalityClock(-5)
    expect(r.direction).toBe("menBehind")
    expect(r.display).toBe("00:24:00") // magnitude
  })

  it("formats past one hour", () => {
    const r = equalityClock(25) // 25% of 8h = 2h
    expect(r.display).toBe("02:00:00")
  })

  it("reports no gap for null or a zero-second gap", () => {
    expect(equalityClock(null).direction).toBe("none")
    expect(equalityClock(0).direction).toBe("none")
    expect(equalityClock(0).display).toBe("00:00:00")
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/dashboard && bunx vitest run lib/equality-clock.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement the pure formatter**

Create `apps/dashboard/lib/equality-clock.ts`:

```ts
// The "jämställdhetsklocka": the gender pay gap expressed as time. Unpaid daily
// time = |gap%| of an 8-hour working day. Pure and locale-free; the component
// wraps this with translated copy. No I/O, no clock reads.
const WORKDAY_SECONDS = 8 * 3600

export type EqualityClockDirection = "womenBehind" | "menBehind" | "none"

export interface EqualityClockValue {
  seconds: number
  direction: EqualityClockDirection
  display: string // HH:MM:SS
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function formatClock(total: number): string {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export function equalityClock(gapPct: number | null): EqualityClockValue {
  if (gapPct === null) {
    return { seconds: 0, direction: "none", display: formatClock(0) }
  }
  const seconds = Math.round((Math.abs(gapPct) / 100) * WORKDAY_SECONDS)
  const direction: EqualityClockDirection =
    seconds === 0 ? "none" : gapPct > 0 ? "womenBehind" : "menBehind"
  return { seconds, direction, display: formatClock(seconds) }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/dashboard && bunx vitest run lib/equality-clock.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing component test**

Create `apps/dashboard/components/pay-mapping/equality-clock.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it } from "vitest"
import en from "@workspace/i18n/messages/en.json"
import { EqualityClock } from "./equality-clock"

function renderClock(gapPct: number | null) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <EqualityClock gapPct={gapPct} />
    </NextIntlClientProvider>
  )
}

describe("EqualityClock", () => {
  it("renders the label and the women-behind sentence for a positive gap", () => {
    renderClock(10)
    expect(screen.getByText("Equality clock")).toBeDefined()
    expect(
      screen.getByText(/Women effectively work .* unpaid compared with men/)
    ).toBeDefined()
  })

  it("renders the no-gap sentence for a null gap", () => {
    renderClock(null)
    expect(
      screen.getByText("No measurable pay gap between women and men.")
    ).toBeDefined()
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/equality-clock.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 7: Implement the component**

Create `apps/dashboard/components/pay-mapping/equality-clock.tsx`. The formatted `display` is rendered directly (so it is always in the DOM and testable); Motion animates a count-up of the digits when motion is allowed, and shows the final value immediately under reduced motion.

```tsx
"use client"

import { animate, useMotionValue, useReducedMotion, useTransform } from "motion/react"
import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import { useEffect } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { equalityClock } from "@/lib/equality-clock"

function pad(n: number): string {
  return String(n).padStart(2, "0")
}
function formatClock(total: number): string {
  const t = Math.max(0, Math.round(total))
  return `${pad(Math.floor(t / 3600))}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`
}

export function EqualityClock({ gapPct }: { gapPct: number | null }) {
  const t = useTranslations("dashboard.payMapping.clock")
  const tHelp = useTranslations("dashboard.help")
  const { seconds, direction, display } = equalityClock(gapPct)
  const reduce = useReducedMotion()

  // Count-up from 0 to the final seconds when motion is allowed.
  const count = useMotionValue(reduce ? seconds : 0)
  const text = useTransform(count, (v) => formatClock(v))
  useEffect(() => {
    if (reduce) {
      count.set(seconds)
      return
    }
    const controls = animate(count, seconds, { duration: 0.9, ease: "easeOut" })
    return () => controls.stop()
  }, [seconds, reduce, count])

  const sentence =
    direction === "womenBehind"
      ? t("womenBehind", { time: display })
      : direction === "menBehind"
        ? t("menBehind", { time: display })
        : t("noGap")

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="font-medium text-sm">{t("label")}</h3>
        <HelpMorphButton label={tHelp("equalityClockLabel")}>
          {tHelp("equalityClockBody")}
        </HelpMorphButton>
      </div>
      {direction !== "none" && (
        <motion.p className="font-semibold text-3xl tabular-nums" aria-hidden>
          {text}
        </motion.p>
      )}
      <p className="text-muted-foreground text-sm">{sentence}</p>
    </div>
  )
}
```

Note: the big digits are `aria-hidden` because the sentence already conveys the value in words to assistive tech; the visible `display` string is derived from the same pure helper so the component test can assert the sentence deterministically without waiting on the animation.

- [ ] **Step 8: Run it to verify it passes**

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/equality-clock.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/dashboard/lib/equality-clock.ts apps/dashboard/lib/equality-clock.test.ts apps/dashboard/components/pay-mapping/equality-clock.tsx apps/dashboard/components/pay-mapping/equality-clock.test.tsx
git commit -m "feat(pay-mapping): add the equality clock"
```

---

### Task 4: `PayMappingOverview` (headline gap + gender donut + metadata)

**Files:**
- Create: `apps/dashboard/components/pay-mapping/pay-mapping-overview.tsx`
- Test: `apps/dashboard/components/pay-mapping/pay-mapping-overview.test.tsx`

**Interfaces:**
- Consumes: `EqualityClock` (Task 3), `PayGapFlagBadge` + `PayGapFlag` types, `dashboard.payMapping.overview.*` + `gap.columns.women/.men` + help (Task 2), `MetaField` (exported from `pay-mapping-detail.tsx`), `useMoney`, `useFormatter`, the chart kit (`ChartContainer`, `ChartConfig`) + recharts `PieChart`/`Pie`/`Cell`, gender tokens.
- Produces: `PayMappingOverview({ run, gap })` where `run: PayMappingRunDetail` and `gap: OrgGapResult | undefined`. Define and export the shared result types `OrgAggregate` and `PayMappingGapResult` here or in `pay-mapping-gap.tsx`; this task and Task 5/6 must use the same interface. Put them in `pay-mapping-gap.tsx` (Task 5 owns that file) and import here; to avoid a cross-task ordering problem, define the interfaces in THIS task inside a new file `apps/dashboard/components/pay-mapping/pay-mapping-gap-types.ts` and have both consume it.

**Shared types file** `apps/dashboard/components/pay-mapping/pay-mapping-gap-types.ts` (create in this task):

```ts
import type { PayGapFlag } from "@workspace/core"

export interface GapGroup {
  key: string
  roleTitle: string | null
  level: string | null
  band: number | null
  womenCount: number
  menCount: number
  womenMeanComp: number | null
  menMeanComp: number | null
  gapPct: number | null
  flag: PayGapFlag
}

export interface OrgAggregate {
  womenCount: number
  menCount: number
  womenMeanComp: number | null
  menMeanComp: number | null
  gapPct: number | null
  flag: PayGapFlag
}

export interface PayMappingGapResult {
  currency: string | null
  org: OrgAggregate
  lika: GapGroup[]
  likvardigt: GapGroup[]
  unbandedCount: number
}
```

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/components/pay-mapping/pay-mapping-overview.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it } from "vitest"
import en from "@workspace/i18n/messages/en.json"
import { PayMappingOverview } from "./pay-mapping-overview"
import type { PayMappingGapResult } from "./pay-mapping-gap-types"
import type { PayMappingRunDetail } from "./pay-mapping-detail"

const run: PayMappingRunDetail = {
  runId: "r1" as PayMappingRunDetail["runId"],
  label: "Test",
  status: "active",
  referenceDate: 1_700_000_000_000,
  initiatedBy: "u1",
  initiatedByName: "HR Person",
  populationCount: 6,
  withPayCount: 6,
  unclassifiedExcludedCount: 0,
  populationNote: null,
  rows: [],
}

function gap(org: Partial<PayMappingGapResult["org"]>): PayMappingGapResult {
  return {
    currency: "SEK",
    org: {
      womenCount: 3,
      menCount: 3,
      womenMeanComp: 90000,
      menMeanComp: 100000,
      gapPct: 10,
      flag: "elevated",
      ...org,
    },
    lika: [],
    likvardigt: [],
    unbandedCount: 0,
  }
}

function renderOverview(g: PayMappingGapResult | undefined) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PayMappingOverview run={run} gap={g} />
    </NextIntlClientProvider>
  )
}

describe("PayMappingOverview", () => {
  it("renders the headline gap and the metadata", () => {
    renderOverview(gap({}))
    expect(screen.getByText("Pay gap")).toBeDefined()
    expect(screen.getByText("Gender split")).toBeDefined()
    expect(screen.getByText("HR Person")).toBeDefined() // metadata
  })

  it("shows the insufficient line when the org gap is insufficient", () => {
    renderOverview(gap({ menCount: 0, menMeanComp: null, gapPct: null, flag: "insufficient" }))
    expect(
      screen.getByText("Not enough data for an organization-level gap.")
    ).toBeDefined()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/pay-mapping-overview.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement the overview**

Create `apps/dashboard/components/pay-mapping/pay-mapping-overview.tsx`:

```tsx
"use client"

import {
  type ChartConfig,
  ChartContainer,
} from "@workspace/ui/components/chart"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useFormatter, useTranslations } from "next-intl"
import { Cell, Pie, PieChart } from "recharts"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useMoney } from "@/hooks/use-money"
import { EqualityClock } from "./equality-clock"
import { MetaField } from "./pay-mapping-detail"
import { PayGapFlagBadge } from "./pay-gap-flag-badge"
import type { PayMappingGapResult } from "./pay-mapping-gap-types"

export function PayMappingOverview({
  run,
  gap,
}: {
  run: import("./pay-mapping-detail").PayMappingRunDetail
  gap: PayMappingGapResult | undefined
}) {
  const t = useTranslations("dashboard.payMapping")
  const tOverview = useTranslations("dashboard.payMapping.overview")
  const tGap = useTranslations("dashboard.payMapping.gap.columns")
  const tHelp = useTranslations("dashboard.help")
  const format = useFormatter()
  const money = useMoney()

  const org = gap?.org
  const currency = gap?.currency ?? null

  return (
    <div className="space-y-6">
      {/* Survey metadata (available from run immediately). */}
      <Card>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-4">
            <MetaField label={t("detail.referenceDate")}>
              {format.dateTime(new Date(run.referenceDate), { dateStyle: "medium" })}
            </MetaField>
            <MetaField label={t("table.responsible")}>{run.initiatedByName}</MetaField>
            <MetaField label={t("detail.population")}>{run.populationCount}</MetaField>
            <MetaField label={t("detail.withPay")}>{run.withPayCount}</MetaField>
          </dl>
        </CardContent>
      </Card>

      {/* Headline gap + clock. */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm">{tOverview("headlineGapLabel")}</h3>
            <HelpMorphButton label={tHelp("headlineGapLabel")}>
              {tHelp("headlineGapBody")}
            </HelpMorphButton>
          </div>
          {gap === undefined ? (
            <Skeleton className="h-8 w-40 max-w-full" />
          ) : org === undefined || org.flag === "insufficient" || org.gapPct === null ? (
            <p className="text-muted-foreground text-sm">{tOverview("insufficient")}</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-3xl tabular-nums">
                  {format.number(org.gapPct / 100, {
                    style: "percent",
                    maximumFractionDigits: 1,
                    signDisplay: "exceptZero",
                  })}
                </span>
                <PayGapFlagBadge flag={org.flag} />
              </div>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <MetaField label={tOverview("womenMean")}>
                  {org.womenMeanComp !== null && currency !== null
                    ? money(org.womenMeanComp, currency)
                    : "-"}
                </MetaField>
                <MetaField label={tOverview("menMean")}>
                  {org.menMeanComp !== null && currency !== null
                    ? money(org.menMeanComp, currency)
                    : "-"}
                </MetaField>
              </dl>
            </div>
          )}
          <EqualityClock gapPct={org?.gapPct ?? null} />
        </CardContent>
      </Card>

      {/* Gender donut. */}
      <Card>
        <CardContent>
          <h3 className="mb-2 font-medium text-sm">{tOverview("donutTitle")}</h3>
          {gap === undefined || org === undefined ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <GenderDonut
              women={org.womenCount}
              men={org.menCount}
              womenLabel={tGap("women")}
              menLabel={tGap("men")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function GenderDonut({
  women,
  men,
  womenLabel,
  menLabel,
}: {
  women: number
  men: number
  womenLabel: string
  menLabel: string
}) {
  const config = {
    women: { label: womenLabel, color: "var(--gender-woman)" },
    men: { label: menLabel, color: "var(--gender-man)" },
  } satisfies ChartConfig
  const data = [
    { key: "women", label: womenLabel, value: women, fill: "var(--gender-woman)" },
    { key: "men", label: menLabel, value: men, fill: "var(--gender-man)" },
  ]
  const total = women + men
  return (
    <div className="flex items-center gap-6">
      <ChartContainer config={config} className="aspect-square h-40">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius={40} strokeWidth={2}>
            {data.map((d) => (
              <Cell key={d.key} fill={d.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <dl className="space-y-1 text-sm">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: "var(--gender-woman)" }} aria-hidden />
          <dt className="text-muted-foreground">{womenLabel}</dt>
          <dd className="tabular-nums">{women}{total > 0 ? ` (${Math.round((women / total) * 100)}%)` : ""}</dd>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: "var(--gender-man)" }} aria-hidden />
          <dt className="text-muted-foreground">{menLabel}</dt>
          <dd className="tabular-nums">{men}{total > 0 ? ` (${Math.round((men / total) * 100)}%)` : ""}</dd>
        </div>
      </dl>
    </div>
  )
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/pay-mapping-overview.test.tsx`
Expected: PASS. (If recharts renders nothing measurable under happy-dom, the donut still mounts; the test asserts the title + legend text, which are plain DOM.)

- [ ] **Step 5: Typecheck + commit**

Run: `cd apps/dashboard && bun run typecheck`
Expected: PASS (the `MetaField` and `PayMappingRunDetail` imports resolve; note `PayMappingRunDetail` is exported from `pay-mapping-detail.tsx` and `MetaField` too).

```bash
git add apps/dashboard/components/pay-mapping/pay-mapping-gap-types.ts apps/dashboard/components/pay-mapping/pay-mapping-overview.tsx apps/dashboard/components/pay-mapping/pay-mapping-overview.test.tsx
git commit -m "feat(pay-mapping): add the survey overview with headline gap and gender donut"
```

---

### Task 5: Make `PayMappingGap` prop-driven and extract `PayMappingPopulation`

**Files:**
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-gap.tsx`
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-gap.test.tsx`
- Create: `apps/dashboard/components/pay-mapping/pay-mapping-population.tsx`
- Test: `apps/dashboard/components/pay-mapping/pay-mapping-population.test.tsx`

**Interfaces:**
- Consumes: `PayMappingGapResult` from `pay-mapping-gap-types.ts` (Task 4); the existing `PayMappingSnapshotRow`, `matchesSnapshotRowQuery`, `PayMappingRowsHeader` from `pay-mapping-detail.tsx`.
- Produces: `PayMappingGap({ gap }: { gap: PayMappingGapResult | undefined })` (no longer issues the query); `PayMappingPopulation({ run }: { run: PayMappingRunDetail })` (the frozen-population table extracted from `PayMappingDetail`).

- [ ] **Step 1: Make `PayMappingGap` prop-driven**

In `pay-mapping-gap.tsx`: remove the local `GapGroup` interface (now imported from `pay-mapping-gap-types.ts`), remove the `useQuery`/`api`/`Id`/`orgId`/`runId` wiring, and change the exported component to:

```tsx
import type { PayMappingGapResult } from "./pay-mapping-gap-types"
export type { GapGroup } from "./pay-mapping-gap-types"

export function PayMappingGap({ gap }: { gap: PayMappingGapResult | undefined }) {
  const t = useTranslations("dashboard.payMapping.gap")
  if (gap === undefined) {
    return (
      <div className="space-y-6">
        <GapSectionSkeleton variant="lika" />
        <GapSectionSkeleton variant="likvardigt" />
      </div>
    )
  }
  if (gap.currency === null) {
    return <p className="text-muted-foreground text-sm">{t("empty")}</p>
  }
  return (
    <div className="space-y-6">
      <GapSection variant="lika" groups={gap.lika} currency={gap.currency} />
      <GapSection
        variant="likvardigt"
        groups={gap.likvardigt}
        currency={gap.currency}
        unbandedCount={gap.unbandedCount}
      />
    </div>
  )
}
```

Keep `PayGapTable`, `GapSection`, `GapSectionSkeleton`, `PayGapTableHeader` unchanged. The `GapGroup` interface is now re-exported from the shared types file so existing importers (the gap test) keep working.

- [ ] **Step 2: Update the gap test to be prop-driven**

In `pay-mapping-gap.test.tsx`, the `PayGapTable`-level tests are unchanged (they already pass props). No `PayMappingGap` query mock is needed anymore. If a `PayMappingGap`-level test exists that mocked `useQuery`, replace it with a direct prop render:

```tsx
import { PayMappingGap } from "./pay-mapping-gap"
// render <PayMappingGap gap={undefined} /> shows the skeleton (two section titles);
// render <PayMappingGap gap={{ currency: null, org, lika: [], likvardigt: [], unbandedCount: 0 }} />
// shows the empty message.
```

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/pay-mapping-gap.test.tsx`
Expected: PASS.

- [ ] **Step 3: Extract `PayMappingPopulation` (write the test first)**

Create `apps/dashboard/components/pay-mapping/pay-mapping-population.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it } from "vitest"
import en from "@workspace/i18n/messages/en.json"
import { PayMappingPopulation } from "./pay-mapping-population"
import type { PayMappingRunDetail } from "./pay-mapping-detail"

const run: PayMappingRunDetail = {
  runId: "r1" as PayMappingRunDetail["runId"],
  label: "Test",
  status: "active",
  referenceDate: 1_700_000_000_000,
  initiatedBy: "u1",
  initiatedByName: "HR",
  populationCount: 1,
  withPayCount: 1,
  unclassifiedExcludedCount: 0,
  populationNote: null,
  rows: [
    {
      displayName: "Anna",
      erased: false,
      gender: "Kvinna",
      roleTitle: "SWE",
      trackKey: "engineering",
      level: "Senior",
      band: 3,
      basicMonthly: 50000,
      currency: "SEK",
      payYear: 2026,
    },
  ],
}

describe("PayMappingPopulation", () => {
  it("renders the frozen population rows", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <PayMappingPopulation run={run} />
      </NextIntlClientProvider>
    )
    expect(screen.getByText("Anna")).toBeDefined()
    expect(screen.getByText("SWE")).toBeDefined()
  })
})
```

- [ ] **Step 4: Implement `PayMappingPopulation`**

Create `apps/dashboard/components/pay-mapping/pay-mapping-population.tsx` by MOVING the frozen-population table out of `PayMappingDetail`: the TanStack `useReactTable` setup, the `globalFilter`/`pagination` state, `resetPage`/`clearSearch`, the toolbar (`TableSearchField` + result count), the `Empty` no-matches branch, the table body rendering each `PayMappingSnapshotRow`, and the `TablePagination`. It takes `{ run }` and reads `run.rows`, `run.populationNote`. Reuse `matchesSnapshotRowQuery`, `PayMappingRowsHeader`, `PayMappingSnapshotRow` (imported from `pay-mapping-detail.tsx`). This is a verbatim move of the existing working code (lines currently in `PayMappingDetail` from the `useState` for `globalFilter` through the population-table JSX), wrapped as a component:

```tsx
"use client"

import { /* the TanStack + table imports currently in pay-mapping-detail.tsx */ } from "..."
import {
  matchesSnapshotRowQuery,
  PayMappingRowsHeader,
  type PayMappingRunDetail,
  type PayMappingSnapshotRow,
} from "./pay-mapping-detail"

export function PayMappingPopulation({ run }: { run: PayMappingRunDetail }) {
  // ... the exact table logic moved from PayMappingDetail, rendering:
  // the populationNote paragraph (if any), then the search toolbar + table +
  // pagination, or the empty-state table when there are no rows.
}
```

(The implementer moves the existing tested code verbatim; no behavior change. `PayMappingDetail` keeps exporting `MetaField`, `PayMappingRowsHeader`, `matchesSnapshotRowQuery`, `PayMappingSnapshotRow`, `PayMappingRunDetail` for reuse.)

- [ ] **Step 5: Run the population test + the gap test**

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/pay-mapping-population.test.tsx components/pay-mapping/pay-mapping-gap.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/components/pay-mapping/pay-mapping-gap.tsx apps/dashboard/components/pay-mapping/pay-mapping-gap.test.tsx apps/dashboard/components/pay-mapping/pay-mapping-population.tsx apps/dashboard/components/pay-mapping/pay-mapping-population.test.tsx
git commit -m "refactor(pay-mapping): make the gap view prop-driven and extract the population table"
```

---

### Task 6: The tab shell (`PayMappingDetail`) + Rapport placeholder + page skeleton

**Files:**
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-detail.tsx`
- Modify: `apps/dashboard/components/pay-mapping/pay-mapping-detail.test.tsx`
- Create: `apps/dashboard/components/pay-mapping/pay-mapping-report.tsx`
- Modify: `apps/dashboard/app/(app)/pay-mappings/[slug]/page.tsx`

**Interfaces:**
- Consumes: `PayMappingOverview` (Task 4), `PayMappingGap` (Task 5), `PayMappingPopulation` (Task 5), `PayMappingReport` (this task), `getPayMappingGap` (Task 1), Base UI `Tabs` (`@workspace/ui/components/tabs`), `dashboard.payMapping.tabs.*` (Task 2).
- Produces: `PayMappingDetail` as the tab shell.

- [ ] **Step 1: Create the Rapport placeholder**

Create `apps/dashboard/components/pay-mapping/pay-mapping-report.tsx`:

```tsx
"use client"

import { Card, CardContent } from "@workspace/ui/components/card"
import { useTranslations } from "next-intl"

export function PayMappingReport() {
  const t = useTranslations("dashboard.payMapping.report")
  return (
    <Card>
      <CardContent className="space-y-2">
        <h3 className="font-medium text-sm">{t("comingSoonTitle")}</h3>
        <p className="text-muted-foreground text-sm">{t("comingSoonBody")}</p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Rewrite `PayMappingDetail` as the shell (write the test first)**

Update `pay-mapping-detail.test.tsx`. Because `PayMappingDetail` now issues `getPayMappingGap`, mock the Convex query via the shared test helper the same way `pay-comparison-section.test.tsx` does (`@/test/convex-mocks`, `onQuery(() => <a PayMappingGapResult or null>)`). Assert:

```tsx
// - the three tab triggers render (Overview / Analysis / Report)
// - Overview is the default active panel (the headline "Pay gap" is visible)
// - the status badge shows the run status
// Keep the existing pure-function tests (matchesSnapshotRowQuery) unchanged.
```

Provide the mock a resolved `PayMappingGapResult` (org + empty lika/likvardigt) so the overview renders its headline.

- [ ] **Step 3: Implement the shell**

Rewrite the `PayMappingDetail` component body (keep the exported helpers `MetaField`, `PayMappingRowsHeader`, `matchesSnapshotRowQuery`, and the interfaces `PayMappingSnapshotRow`, `PayMappingRunDetail`; remove the population-table logic now living in `PayMappingPopulation`):

```tsx
export function PayMappingDetail({
  orgId,
  run,
}: {
  orgId: string
  run: PayMappingRunDetail
}) {
  const t = useTranslations("dashboard.payMapping")
  const tTabs = useTranslations("dashboard.payMapping.tabs")
  const tHelp = useTranslations("dashboard.help")
  const gap = useQuery(api.payMapping.gap.getPayMappingGap, {
    orgId,
    runId: run.runId,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={
          <PageBreadcrumb
            segments={[
              { label: t("heading"), href: "/pay-mappings" },
              { label: run.label },
            ]}
          />
        }
        title={run.label}
        titleAdornment={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{t(`status.${run.status}`)}</Badge>
            <HelpMorphButton label={tHelp("payMappingLabel")}>
              {tHelp("payMappingBody")}
            </HelpMorphButton>
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{tTabs("overview")}</TabsTrigger>
          <TabsTrigger value="analysis">{tTabs("analysis")}</TabsTrigger>
          <TabsTrigger value="report">{tTabs("report")}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-4">
          <PayMappingOverview run={run} gap={gap === null ? undefined : gap} />
        </TabsContent>
        <TabsContent value="analysis" className="space-y-6 pt-4">
          <PayMappingGap gap={gap === null ? undefined : gap} />
          <h2 className="font-medium text-sm">{t("detail.population")}</h2>
          <PayMappingPopulation run={run} />
        </TabsContent>
        <TabsContent value="report" className="pt-4">
          <PayMappingReport />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

Update the imports at the top: add `Tabs, TabsContent, TabsList, TabsTrigger` from `@workspace/ui/components/tabs`, `useQuery` from `convex/react`, `api` from the generated API, `PayMappingOverview`, `PayMappingPopulation`, `PayMappingReport`; remove the now-unused TanStack/table/pagination imports that moved to `PayMappingPopulation` (keep the ones the shared header/interfaces still need). `titleAdornment` now wraps the status badge + help in a flex row (the `PageHeader` accepts a node).

Note on the `gap === null` guard: `getPayMappingGap` returns `null` only cross-org (unreachable here since `run` resolved in-org); mapping `null -> undefined` keeps the child prop type `PayMappingGapResult | undefined` and shows the skeleton rather than crashing.

- [ ] **Step 4: Update the page skeleton to the tab shell**

In `apps/dashboard/app/(app)/pay-mappings/[slug]/page.tsx`, rewrite `PayMappingDetailSkeleton` so it mirrors the shell while the RUN query loads: the `PageHeader` (breadcrumb + a title `Skeleton` bar), then the real `Tabs` with the three real triggers (static labels render real per the skeleton rule), and the Overview panel showing the metadata card + a headline `Skeleton` + a donut `Skeleton` (mirror `PayMappingOverview`'s loading shape). Remove the old population-table skeleton from here (the population now lives under the Analysis tab, which is not the default panel).

```tsx
function PayMappingDetailSkeleton() {
  const t = useTranslations("dashboard.payMapping")
  const tTabs = useTranslations("dashboard.payMapping.tabs")
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={<PageBreadcrumb segments={[{ label: t("heading"), href: "/pay-mappings" }]} />}
        title={<Skeleton className="h-7 w-56 max-w-full" />}
      />
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{tTabs("overview")}</TabsTrigger>
          <TabsTrigger value="analysis">{tTabs("analysis")}</TabsTrigger>
          <TabsTrigger value="report">{tTabs("report")}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-6 pt-4">
          <Card><CardContent><Skeleton className="h-16 w-full" /></CardContent></Card>
          <Card><CardContent><Skeleton className="h-24 w-full" /></CardContent></Card>
          <Card><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

(Add the `Tabs*` and `Card`/`CardContent` imports to `page.tsx`; the run-title stays a `Skeleton` because it is data.)

- [ ] **Step 5: Run the pay-mapping tests + typecheck**

Run: `cd apps/dashboard && bunx vitest run components/pay-mapping/`
Expected: PASS (overview, gap, population, equality-clock, flag-badge, detail).

Run: `cd apps/dashboard && bun run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/components/pay-mapping/pay-mapping-detail.tsx apps/dashboard/components/pay-mapping/pay-mapping-detail.test.tsx apps/dashboard/components/pay-mapping/pay-mapping-report.tsx "apps/dashboard/app/(app)/pay-mappings/[slug]/page.tsx"
git commit -m "feat(pay-mapping): stage the survey detail into Overview / Analysis / Report tabs"
```

---

## Self-Review

**Spec coverage:**
- `org` aggregate on the query (not masked, insufficient handling) → Task 1.
- i18n (tabs, overview, clock, report, help) in 5 locales → Task 2.
- Equality clock (pure formula + component, honest by direction, 8h workday) → Task 3.
- `PayMappingOverview` (metadata + headline gap + clock + donut, insufficient branch) → Task 4.
- `PayMappingGap` prop-driven + population extracted under Analysera → Task 5.
- Tab shell (Överblick default / Analysera / Rapport), status badge, Rapport placeholder, page skeleton → Task 6.
- Out-of-scope (quartile/age, adjusted gap, objective reasons, scatter, real report) → not built.

**Placeholder scan:** Task 5 Step 4 deliberately says "move the existing tested code verbatim" rather than repeating ~100 lines of unchanged TanStack table code; the source is the current `PayMappingDetail`, which the implementer has in front of them. Everything else carries complete code.

**Type consistency:** `PayMappingGapResult` / `OrgAggregate` / `GapGroup` are defined once in `pay-mapping-gap-types.ts` (Task 4) and consumed by Tasks 4/5/6. The query's `org` shape (Task 1) matches `OrgAggregate` field-for-field. `PayMappingGap` takes `gap: PayMappingGapResult | undefined` in Tasks 5 and 6. `PayMappingRunDetail` + `MetaField` + `PayMappingSnapshotRow` + `matchesSnapshotRowQuery` + `PayMappingRowsHeader` remain exported from `pay-mapping-detail.tsx` throughout.

**Note for the executor:** Task 4 depends on the shared types file it creates; Task 5 removes the local `GapGroup` from `pay-mapping-gap.tsx` and imports it from that file. The Convex query in Task 6 (`PayMappingDetail`) is mocked in the detail test via `@/test/convex-mocks` (see `pay-comparison-section.test.tsx` for the pattern), not issued live.
