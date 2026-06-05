import { IMPORTANCE_LEVELS } from "@workspace/core"
import { describe, expect, it } from "vitest"
import {
  CRITERION_KEYS,
  DEFAULT_BAND_THRESHOLDS,
  DEFAULT_IMPORTANCE,
  GUARDRAILS,
  TRACK_DEFS,
  templateContent,
} from "./standardTemplate"

describe("standard template structure", () => {
  it("has 9 criteria, 3 tracks, 11 levels, 7 descending thresholds", () => {
    expect(CRITERION_KEYS).toHaveLength(9)
    expect(TRACK_DEFS).toHaveLength(3)
    expect(TRACK_DEFS.flatMap((t) => t.levels)).toHaveLength(11)
    expect(DEFAULT_BAND_THRESHOLDS).toHaveLength(7)
    const scores = DEFAULT_BAND_THRESHOLDS.map((t) => t.minScore)
    expect([...scores].sort((a, b) => b - a)).toEqual(scores)
    expect(DEFAULT_BAND_THRESHOLDS[0]).toEqual({ band: 1, minScore: 530 })
  })

  it("keeps importances on the fixed scale and guardrails in 0-5", () => {
    for (const key of CRITERION_KEYS) {
      expect(IMPORTANCE_LEVELS).toContain(DEFAULT_IMPORTANCE[key])
    }
    for (const ranges of Object.values(GUARDRAILS)) {
      for (const [min, max] of Object.values(ranges)) {
        expect(min).toBeGreaterThanOrEqual(0)
        expect(max).toBeLessThanOrEqual(5)
        expect(min).toBeLessThanOrEqual(max)
      }
    }
  })

  it("has a guardrail entry for every one of the 11 levels (completeness gate)", () => {
    expect(Object.keys(GUARDRAILS)).toHaveLength(11)
    for (const level of TRACK_DEFS.flatMap((t) => t.levels)) {
      expect(GUARDRAILS[level]).toBeDefined()
    }
  })

  it("ships complete content in both locales", () => {
    for (const locale of ["sv", "en"] as const) {
      const content = templateContent(locale)
      for (const key of CRITERION_KEYS) {
        const criterion = content.criteria[key]
        expect(criterion.name.length).toBeGreaterThan(0)
        expect(criterion.description.length).toBeGreaterThan(0)
        expect(criterion.helpText.length).toBeGreaterThan(0)
        expect(criterion.anchors).toHaveLength(6)
        for (const anchor of criterion.anchors) {
          expect(anchor.length).toBeGreaterThan(0)
        }
      }
    }
  })
})
