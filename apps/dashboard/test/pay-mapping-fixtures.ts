// Shared fixture builders for the pay-mapping tests: one home for the wire
// shapes' defaults so a shape change edits one file, not one copy-pasted
// builder per test file.
import type {
  ExcludedGroupsWire,
  GapGroup,
  GapMetric,
  PayMappingGapResult,
  PayMappingRunDetail,
} from "@/components/pay-mapping/pay-mapping-gap-types"
import type { PayMappingRunSummary } from "@/components/pay-mapping/pay-mapping-run-context"

// Defaults mirror the classic seed: 2 women @ 90k vs 2 men @ 100k => a 10%
// women-behind gap.
export function makeGapMetric(overrides: Partial<GapMetric> = {}): GapMetric {
  return {
    womenMean: 90000,
    menMean: 100000,
    gapPct: 10,
    gapKr: 10000,
    ...overrides,
  }
}

// Flat convenience: `metric` applies the same overrides to BOTH measures
// (fixtures rarely need base and tcc to differ; no components seeded means
// the two coincide). Pass `base`/`tcc` on top when a test needs them apart.
export function makeGapGroup(
  overrides: Partial<Omit<GapGroup, "base" | "tcc">> & {
    metric?: Partial<GapMetric>
    base?: Partial<GapMetric>
    tcc?: Partial<GapMetric>
  } = {}
): GapGroup {
  const { metric, base, tcc, ...rest } = overrides
  return {
    key: "SWE|3|Senior",
    roleTitle: "SWE",
    // A group spans every seniority step in its title at this level
    // (ADR-0017), so the engine gives it none. Fixtures mirror that, or
    // every assertion about a group's label is testing a shape the engine
    // never produces.
    seniority: null,
    level: 3,
    womenCount: 2,
    menCount: 2,
    base: makeGapMetric({ ...metric, ...base }),
    tcc: makeGapMetric({ ...metric, ...tcc }),
    flag: "elevated",
    tccDriven: false,
    ...rest,
  }
}

// The resolved run every run-scoped surface reads from context. Active, no
// samverkan record, no snapshot rows: the shape a test overrides from.
export function makeRunDetail(
  overrides: Partial<PayMappingRunDetail> = {}
): PayMappingRunDetail {
  return {
    runId: "run-1" as PayMappingRunDetail["runId"],
    label: "Pay mapping 2026",
    status: "active",
    referenceDate: Date.UTC(2026, 6, 1),
    populationCount: 6,
    rows: [],
    collaboration: null,
    frozenCriteria: [],
    ...overrides,
  }
}

// One entry of the org's run list, as the context narrows it.
export function makeRunSummary(
  overrides: Partial<PayMappingRunSummary> = {}
): PayMappingRunSummary {
  return {
    status: "completed",
    referenceDate: Date.UTC(2025, 6, 1),
    label: "Pay mapping 2025",
    populationCount: 6,
    // Frozen beside the headcount; null is the "no measurable gap" case, so
    // the default is a real reading that a trend can compare against.
    orgGapPct: 4,
    ...overrides,
  }
}

// The empty excluded bucket most gap-result fixtures want.
export function makeExcluded(
  overrides: Partial<ExcludedGroupsWire> = {}
): ExcludedGroupsWire {
  return {
    singletonCount: 0,
    genderPure: [],
    reverse: [],
    ...overrides,
  }
}

// A whole gap result with empty groupings: the shape a test overrides from.
export function makeGapResult(
  overrides: Partial<PayMappingGapResult> = {}
): PayMappingGapResult {
  return {
    currency: "SEK",
    org: {
      womenCount: 3,
      menCount: 3,
      womenMeanComp: 90000,
      menMeanComp: 100000,
      gapPct: 10,
      flag: "elevated",
    },
    equalWork: [],
    excluded: makeExcluded(),
    equivalentWork: [],
    womenDominated: [],
    population: { women: 3, men: 3 },
    quartiles: [],
    ...overrides,
  }
}
