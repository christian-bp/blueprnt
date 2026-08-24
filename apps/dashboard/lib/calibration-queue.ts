import type { LevelRoleRow } from "@/lib/levels"

// The calibration queue: the three ways a placement can need a human look
// before the level ladder is taken as settled (spec 6).
//
// All three are DERIVED from flags the results wire already carries, never
// stored: a queue row exists exactly while its condition holds and disappears
// the moment the condition stops holding, so there is no state to reconcile and
// nothing to clean up. What a person does about a row is the only thing that is
// recorded, and only the first class has such an act (confirming the placement);
// the other two are resolved by changing the thing that caused them.
export type CalibrationReason =
  | "profileLimited"
  | "anchorDeviation"
  | "staleLock"

export interface ProfileFailure {
  criterionId: string
  // The criterion's display name, resolved on the wire so the queue can say
  // WHICH requirement held the role back rather than showing an id.
  name: string
  required: number
  actual: number
}

export interface CalibrationRow {
  row: LevelRoleRow
  reason: CalibrationReason
  // Only for `profileLimited`: the profile criteria the role fell short on,
  // with what each required and what the role scored.
  failures: ProfileFailure[]
  // Only for `anchorDeviation`: the agreed level beside the computed one.
  expectedLevel: number | null
}

// What a row needs to answer the queue's questions, beyond LevelRoleRow. Kept
// as its own shape so the queue can be fed from the results wire without the
// ladder's row type growing fields only this surface reads.
export interface CalibrationInput extends LevelRoleRow {
  locked: boolean
  calibrated: boolean
  methodDrift: boolean
  profileLimited: boolean | null
  profileFailures: ProfileFailure[] | null
}

// One row per role, in the order the classes are listed below. A role can
// satisfy more than one condition (a stale lock whose placement was also
// capped); it appears ONCE, under the first condition that holds, because the
// queue is a list of things to do and the same role listed three times would
// read as three roles. The order is the order of consequence: a capped
// placement is a claim about the role's level, a deviating anchor is a claim
// about the model's calibration, and a stale lock is a claim about neither
// until it is re-locked.
export function calibrationQueue(
  rows: readonly CalibrationInput[]
): CalibrationRow[] {
  const queue: CalibrationRow[] = []
  for (const row of rows) {
    // Only a locked, placed role can be calibrated: an unlocked role has no
    // revealed placement to confirm, and the reveal is the lock (spec 2.4/6).
    if (!row.locked || row.level === null) continue

    if (row.profileLimited === true && !row.calibrated) {
      queue.push({
        row,
        reason: "profileLimited",
        failures: row.profileFailures ?? [],
        expectedLevel: null,
      })
      continue
    }
    if (row.anchor !== null && row.anchor.expectedLevel !== row.level) {
      queue.push({
        row,
        reason: "anchorDeviation",
        failures: [],
        expectedLevel: row.anchor.expectedLevel,
      })
      continue
    }
    if (row.methodDrift) {
      queue.push({
        row,
        reason: "staleLock",
        failures: [],
        expectedLevel: null,
      })
    }
  }
  return queue
}
