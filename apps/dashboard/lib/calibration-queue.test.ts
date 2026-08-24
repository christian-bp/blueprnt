import { describe, expect, it } from "vitest"
import {
  type CalibrationInput,
  calibrationQueue,
} from "@/lib/calibration-queue"

// A locked, placed, unremarkable role: in the ladder, out of the queue.
function role(overrides: Partial<CalibrationInput> = {}): CalibrationInput {
  return {
    roleId: "r1",
    slug: "r1",
    title: "Analyst",
    trackKey: "IC",
    trackName: "Individual contributor",
    score: 60,
    level: 5,
    zone: "B",
    ratedCount: 9,
    totalCriteria: 9,
    readyToComplete: false,
    familyId: null,
    familyName: null,
    anchor: null,
    completed: true,
    calibrated: false,
    methodDrift: false,
    profileLimited: false,
    profileFailures: [],
    ...overrides,
  }
}

describe("calibrationQueue", () => {
  it("leaves an ordinary locked placement alone", () => {
    expect(calibrationQueue([role()])).toEqual([])
  })

  // Class 1: the profile requirements capped the placement, and nobody has
  // said yet whether that is right.
  it("queues a capped placement, with the requirements that capped it", () => {
    const queue = calibrationQueue([
      role({
        profileLimited: true,
        profileFailures: [
          {
            criterionId: "c1",
            name: "Scope and impact",
            required: 4,
            actual: 3,
          },
        ],
      }),
    ])
    expect(queue).toHaveLength(1)
    expect(queue[0]?.reason).toBe("profileLimited")
    expect(queue[0]?.failures).toEqual([
      { criterionId: "c1", name: "Scope and impact", required: 4, actual: 3 },
    ])
  })

  it("drops a capped placement once it is confirmed", () => {
    const confirmed = role({ profileLimited: true, calibrated: true })
    expect(calibrationQueue([confirmed])).toEqual([])
  })

  // Class 2: an anchor role is the model's own reference point, so a computed
  // level that differs from the agreed one is a question about the model.
  it("queues an anchor role whose computed level differs from the agreed one", () => {
    const queue = calibrationQueue([
      role({ level: 5, anchor: { expectedLevel: 3, status: "active" } }),
    ])
    expect(queue[0]?.reason).toBe("anchorDeviation")
    expect(queue[0]?.expectedLevel).toBe(3)
    expect(queue[0]?.row.level).toBe(5)
  })

  it("leaves an anchor role that landed where it was expected", () => {
    expect(
      calibrationQueue([
        role({ level: 5, anchor: { expectedLevel: 5, status: "active" } }),
      ])
    ).toEqual([])
  })

  // Class 3: the method moved on after the assessment was locked.
  it("queues a role locked under a superseded method", () => {
    const queue = calibrationQueue([role({ methodDrift: true })])
    expect(queue[0]?.reason).toBe("staleMethod")
  })

  // Calibrating does NOT clear a stale lock: re-locking is what does, so the
  // row stays until the assessment is locked again.
  it("keeps a stale lock queued even when the placement was confirmed", () => {
    const queue = calibrationQueue([
      role({ methodDrift: true, calibrated: true }),
    ])
    expect(queue[0]?.reason).toBe("staleMethod")
  })

  // Only a revealed placement can be reviewed: an unlocked role has no
  // placement yet (lock-as-reveal), so it belongs to the pending list.
  it("never queues an unlocked role, whatever its flags say", () => {
    expect(
      calibrationQueue([
        role({ completed: false, level: null, profileLimited: true }),
        role({
          roleId: "r2",
          completed: false,
          level: null,
          methodDrift: true,
        }),
      ])
    ).toEqual([])
  })

  it("never queues a locked role with no level", () => {
    expect(
      calibrationQueue([role({ level: null, profileLimited: true })])
    ).toEqual([])
  })

  // One row per role. The queue is a list of things to do, and the same role
  // listed three times reads as three roles.
  it("lists a role that satisfies several conditions once, by consequence", () => {
    const queue = calibrationQueue([
      role({
        profileLimited: true,
        methodDrift: true,
        anchor: { expectedLevel: 1, status: "active" },
      }),
    ])
    expect(queue).toHaveLength(1)
    expect(queue[0]?.reason).toBe("profileLimited")
  })

  it("falls to the anchor question when the placement is already confirmed", () => {
    const queue = calibrationQueue([
      role({
        profileLimited: true,
        calibrated: true,
        methodDrift: true,
        anchor: { expectedLevel: 1, status: "active" },
      }),
    ])
    expect(queue).toHaveLength(1)
    expect(queue[0]?.reason).toBe("anchorDeviation")
  })

  it("keeps the input order across classes", () => {
    const queue = calibrationQueue([
      role({ roleId: "a", methodDrift: true }),
      role({ roleId: "b", profileLimited: true }),
      role({ roleId: "c", anchor: { expectedLevel: 1, status: "active" } }),
    ])
    expect(queue.map((entry) => entry.row.roleId)).toEqual(["a", "b", "c"])
  })
})
