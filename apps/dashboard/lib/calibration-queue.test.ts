import { describe, expect, it } from "vitest"
import {
  type CalibrationFacts,
  calibrationCount,
  calibrationReason,
} from "@/lib/calibration-queue"

// A completed, placed, unremarkable assessment: on the ladder, flagged nowhere.
function role(overrides: Partial<CalibrationFacts> = {}): CalibrationFacts {
  return {
    completed: true,
    level: 5,
    calibrated: false,
    methodDrift: false,
    profileLimited: false,
    anchor: null,
    ...overrides,
  }
}

describe("calibrationReason", () => {
  it("leaves an ordinary completed placement unflagged", () => {
    expect(calibrationReason(role())).toBeNull()
  })

  // Class 1: the profile requirements capped the placement, and nobody has
  // said yet whether that is right.
  it("flags a capped placement", () => {
    expect(calibrationReason(role({ profileLimited: true }))).toBe(
      "profileLimited"
    )
  })

  // Confirming is the act that answers it, so a confirmed cap stops asking.
  it("stops flagging a capped placement once it is confirmed", () => {
    expect(
      calibrationReason(role({ profileLimited: true, calibrated: true }))
    ).toBeNull()
  })

  // Class 2: the computed level and the level the organization agreed for its
  // anchor disagree, which is a question about the MODEL.
  it("flags an anchor whose computed level left its agreed one", () => {
    expect(
      calibrationReason(role({ level: 5, anchor: { expectedLevel: 3 } }))
    ).toBe("anchorDeviation")
  })

  it("leaves an anchor sitting where it was agreed alone", () => {
    expect(
      calibrationReason(role({ level: 3, anchor: { expectedLevel: 3 } }))
    ).toBeNull()
  })

  // Class 3: the method moved on after the assessment was completed.
  it("flags a role assessed under a superseded method", () => {
    expect(calibrationReason(role({ methodDrift: true }))).toBe("staleMethod")
  })

  // Calibrating does NOT clear a stale method: completing the assessment again
  // is what does, so the flag stays until then.
  it("keeps flagging a stale method even when the placement was confirmed", () => {
    expect(
      calibrationReason(role({ methodDrift: true, calibrated: true }))
    ).toBe("staleMethod")
  })

  // ONE question per role, answered by the first condition that holds. A role
  // wearing three markers would be three problems where there is one, and the
  // order is the order of consequence: what capped the level, then what
  // disagrees with the model, then what is merely out of date.
  it("asks the first question only, when a role could raise three", () => {
    expect(
      calibrationReason(
        role({
          profileLimited: true,
          methodDrift: true,
          level: 5,
          anchor: { expectedLevel: 3 },
        })
      )
    ).toBe("profileLimited")
  })

  it("falls through to the anchor question once the cap is confirmed", () => {
    expect(
      calibrationReason(
        role({
          profileLimited: true,
          calibrated: true,
          methodDrift: true,
          level: 5,
          anchor: { expectedLevel: 3 },
        })
      )
    ).toBe("anchorDeviation")
  })

  // Completing is the reveal: an assessment still open has no placement for
  // anyone to have an opinion about, whatever its other flags say.
  it("flags nothing on an assessment that is not completed", () => {
    expect(
      calibrationReason(
        role({ completed: false, profileLimited: true, methodDrift: true })
      )
    ).toBeNull()
  })

  it("flags nothing on a completed assessment with no level", () => {
    expect(
      calibrationReason(role({ level: null, profileLimited: true }))
    ).toBeNull()
  })
})

describe("calibrationCount", () => {
  // The home to-do's number, and the only aggregate left now that the list is
  // gone. It counts ROLES, not questions, which is the same thing because a
  // role raises at most one.
  it("counts every flagged role once and no unflagged one", () => {
    expect(
      calibrationCount([
        role(),
        role({ profileLimited: true }),
        role({ methodDrift: true }),
        role({ level: 5, anchor: { expectedLevel: 3 } }),
        role({ completed: false, profileLimited: true }),
        // Three conditions, one role, one count.
        role({
          profileLimited: true,
          methodDrift: true,
          level: 5,
          anchor: { expectedLevel: 3 },
        }),
      ])
    ).toBe(4)
  })

  it("counts nothing in an empty register", () => {
    expect(calibrationCount([])).toBe(0)
  })
})
