import { isBalanced, isWeightPoints } from "@workspace/core"
import { describe, expect, it } from "vitest"
import {
  CRITERION_KEYS,
  DEFAULT_BAND_THRESHOLDS,
  DEFAULT_WEIGHT_POINTS,
  TRACK_KEYS,
  templateContent,
} from "./standardTemplate"
import { trackKeyValidator } from "./tables"

describe("standard template structure", () => {
  it("has 9 criteria, 3 tracks, 7 descending thresholds", () => {
    expect(CRITERION_KEYS).toHaveLength(9)
    expect(TRACK_KEYS).toEqual(["IC", "Lead", "M"])
    expect(DEFAULT_BAND_THRESHOLDS).toHaveLength(7)
    const scores = DEFAULT_BAND_THRESHOLDS.map((t) => t.minScore)
    expect([...scores].sort((a, b) => b - a)).toEqual(scores)
    expect(DEFAULT_BAND_THRESHOLDS[0]).toEqual({ band: 1, minScore: 98 })
  })

  it("keeps weight points on the 1-5 scale, exactly balanced", () => {
    const points = CRITERION_KEYS.map((key) => DEFAULT_WEIGHT_POINTS[key])
    for (const value of points) {
      expect(isWeightPoints(value)).toBe(true)
    }
    // 9 criteria, point budget 27: the template ships balanced (ADR-0004).
    expect(isBalanced(points)).toBe(true)
  })

  it("keeps the roles.trackKey validator in sync with TRACK_KEYS (ADR-0006)", () => {
    // The validator lives in tables.ts without importing this module; this
    // bijection assertion is what keeps the two literal lists honest.
    expect(trackKeyValidator.members.map((member) => member.value)).toEqual([
      ...TRACK_KEYS,
    ])
  })

  it("ships complete content in every product locale", () => {
    for (const locale of ["sv", "en", "nb", "da", "fi"] as const) {
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
        // The per-criterion weighting explanations (weight points 1..5).
        expect(criterion.weightLevels).toHaveLength(5)
        for (const level of criterion.weightLevels) {
          expect(level.length).toBeGreaterThan(0)
        }
      }
      for (const key of TRACK_KEYS) {
        expect(content.trackNames[key].length).toBeGreaterThan(0)
      }
    }
  })
})
