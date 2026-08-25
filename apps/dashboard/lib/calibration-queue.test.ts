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

// THE LOOP THAT TOOK /work DOWN.
//
// The fold ran `facts.anchor !== null` and then read `.expectedLevel`, which
// is true for `undefined`. A row arriving without the field, as it does while a
// deploy is mid-push and the client bundle is a version ahead of the deployed
// query, threw inside render, once per chip, on the one route that renders
// chips. The page painted its shell and then never settled: no idle, no
// clicks, nothing scriptable.
//
// Every field is exercised as ABSENT, not just the one that broke, because the
// fix is the rule (a missing field reads as its empty value) rather than a
// patch on the field that happened to be dereferenced.
describe("calibrationReason on an incomplete wire row", () => {
  const FIELDS = [
    "completed",
    "level",
    "calibrated",
    "methodDrift",
    "profileLimited",
    "anchor",
  ] as const

  it.each(FIELDS)("survives a row with no %s field", (field) => {
    const full: CalibrationFacts = {
      completed: true,
      level: 4,
      calibrated: false,
      methodDrift: true,
      profileLimited: true,
      anchor: { expectedLevel: 2 },
    }
    const partial = { ...full }
    delete (partial as Record<string, unknown>)[field]
    expect(() => calibrationReason(partial as CalibrationFacts)).not.toThrow()
  })

  // The exact shape that threw: everything present except the anchor.
  it("reads an absent anchor as no anchor, not as a deviation", () => {
    const partial = {
      completed: true,
      level: 4,
      calibrated: false,
      methodDrift: false,
      profileLimited: false,
    } as CalibrationFacts
    expect(calibrationReason(partial)).toBeNull()
  })

  // And an anchor object whose own level is missing is not a deviation either:
  // "no agreed level" is not "an agreed level that differs".
  it("reads an anchor with no agreed level as no deviation", () => {
    expect(
      calibrationReason({
        completed: true,
        level: 4,
        calibrated: false,
        methodDrift: false,
        profileLimited: false,
        anchor: {} as { expectedLevel: number },
      })
    ).toBeNull()
  })

  it("counts a register of half-formed rows without throwing", () => {
    expect(() =>
      calibrationCount([{}, { completed: true }] as CalibrationFacts[])
    ).not.toThrow()
  })
})
