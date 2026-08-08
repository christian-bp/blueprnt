// Shared GapGroup fixture builders for the pay-mapping tests: one home for
// the wire shape's defaults so a shape change edits one file, not one
// copy-pasted builder per test file.
import type {
  ExcludedGroupsWire,
  GapGroup,
  GapMetric,
} from "@/components/pay-mapping/pay-mapping-gap-types"

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
