import { LEVEL_COUNT, MIN_STEP_CEILING, MIN_STEP_FLOOR } from "@workspace/core"
import { describe, expect, it } from "vitest"
import { makeLevelRulesSchema } from "@/lib/level-rules-schemas"

// The schema carries three cross-field engine invariants in one superRefine,
// and until now it was reached only through the panel that renders it. That is
// coverage, not a pin: a mutation to the bottom-at-zero rule did fail
// level-rules-panel.test.tsx, but it failed a COMPONENT test, which means the
// rule can only ever be exercised through a form, in one shape, in one locale.
// These go at the rule directly, on the field each one is reported against,
// because "which field is marked" is the whole reason this file exists rather
// than letting the backend's single refusal speak.

const MESSAGES = {
  decreasing: "decreasing",
  bottomZero: "bottomZero",
  zoneMonotonic: "zoneMonotonic",
  range: "range",
}

// The schema factory takes the validation translator only for its `required`
// message; every other message is passed in explicitly.
const t = ((key: string) => key) as Parameters<typeof makeLevelRulesSchema>[0]

const schema = makeLevelRulesSchema(t, MESSAGES)

// A valid ladder: strictly decreasing, bottom at 0, no zone gated harder than
// the zone above it.
function levels(overrides: Record<number, number> = {}): number[] {
  const base = [97, 92, 87, 81, 75, 69, 60, 50, 40, 30, 15, 0]
  return base.map((value, index) => overrides[index] ?? value)
}

function parse(values: {
  levels?: number[]
  zones?: Record<string, number | undefined>
}) {
  return schema.safeParse({
    levels: values.levels ?? levels(),
    zones: values.zones ?? { A: 4, B: 3, C: 2, D: 1 },
  })
}

// Every issue as `path.join(".")` -> message, so a test can assert WHICH field
// was marked as well as what it said.
function issues(result: ReturnType<typeof parse>) {
  if (result.success) return {}
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join("."), issue.message])
  )
}

describe("makeLevelRulesSchema", () => {
  it("accepts a valid twelve-level ladder", () => {
    expect(parse({}).success).toBe(true)
  })

  it("requires exactly LEVEL_COUNT levels", () => {
    expect(parse({ levels: levels().slice(0, LEVEL_COUNT - 1) }).success).toBe(
      false
    )
  })

  // Level 1 is the highest and each level starts where the one below it stops,
  // so the numbers fall as the level number rises. Reported on the level that
  // BREAKS the rule, never on the form.
  it("marks the level that fails to decrease, and only that level", () => {
    // Level 5 (index 4) rises to 90, above level 4's 81, instead of falling
    // below it. Level 6 still falls below 90, so exactly one field breaks.
    const result = parse({ levels: levels({ 4: 90 }) })
    expect(issues(result)).toEqual({ "levels.4": MESSAGES.decreasing })
  })

  it("accepts equal neighbours nowhere: the ladder is STRICTLY decreasing", () => {
    const result = parse({ levels: levels({ 4: 81 }) })
    expect(issues(result)["levels.4"]).toBe(MESSAGES.decreasing)
  })

  // Every role has to place somewhere, so the bottom level opens at 0. This is
  // the rule R6 deleted to find out whether anything pinned this file.
  it("marks the bottom level when it does not open at zero", () => {
    const result = parse({ levels: levels({ 11: 5 }) })
    expect(issues(result)[`levels.${LEVEL_COUNT - 1}`]).toBe(
      MESSAGES.bottomZero
    )
  })

  // Walking A -> D, a zone may never ask MORE than a zone above it.
  it("marks the zone that asks more than the zone above it", () => {
    const result = parse({ zones: { A: 2, B: 4, C: 2, D: 1 } })
    expect(issues(result)["zones.B"]).toBe(MESSAGES.zoneMonotonic)
  })

  it("skips unconfigured zones exactly as the engine does", () => {
    // A is empty, so B is compared against nothing above it and C against B.
    expect(parse({ zones: { A: undefined, B: 4, C: 2, D: 1 } }).success).toBe(
      true
    )
  })

  it("allows every zone to be empty", () => {
    expect(
      parse({
        zones: { A: undefined, B: undefined, C: undefined, D: undefined },
      }).success
    ).toBe(true)
  })

  // The scale's own bounds, shared with the engine, not re-invented here.
  it("refuses a zone step outside the rating scale", () => {
    expect(parse({ zones: { A: MIN_STEP_CEILING + 1 } }).success).toBe(false)
    expect(parse({ zones: { A: MIN_STEP_FLOOR - 1 } }).success).toBe(false)
  })

  it("refuses a non-integer or out-of-range weighting", () => {
    expect(parse({ levels: levels({ 0: 101 }) }).success).toBe(false)
    expect(parse({ levels: levels({ 0: 97.5 }) }).success).toBe(false)
  })
})
