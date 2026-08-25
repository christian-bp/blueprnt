// Calibration: the three ways a placement can need a human look before the
// level ladder is taken as settled (spec 6, masterdokument 14.8).
//
// 14.8 asks for the kalibrering-krävs FLAG and the calibration ACT. It does
// not ask for a list, and the list was the mistake: a section on /work that
// named roles the reader was already looking at, in a second place, with the
// act only reachable there. The flag lives on the role now (its chip is
// marked) and the act lives in the role's own sheet.
//
// All three classes are DERIVED from flags the results wire already carries,
// never stored: a role is flagged exactly while its condition holds and stops
// being flagged the moment it does not, so there is no state to reconcile and
// nothing to clean up. What a person DOES about it is the only thing recorded,
// and only the first class has an act of its own (confirming the placement);
// the other two are resolved by changing the thing that caused them.
export type CalibrationReason =
  | "profileLimited"
  | "anchorDeviation"
  | "staleMethod"

export interface ProfileFailure {
  criterionId: string
  // The criterion's display name, resolved on the wire so the sheet can say
  // WHICH requirement held the role back rather than showing an id.
  name: string
  required: number
  actual: number
}

// What a role must expose for the fold to classify it. A structural subset of
// a getResults row, so rows pass straight through, and small enough that
// listRoles can carry the same fields for the home to-do's count without a
// second derivation of the same truth.
export interface CalibrationFacts {
  completed: boolean
  level: number | null
  calibrated: boolean
  methodDrift: boolean
  profileLimited: boolean | null
  anchor: { expectedLevel: number } | null
}

// THE FOLD: which of the three questions a placement raises, or none.
//
// One function, because the answer is needed in three places now and they must
// never disagree: the chip that marks the role in the ladder, the sheet that
// states the reason and offers the act, and the home to-do's count. It used to
// live inside a list builder, which is why the list was the only place the
// flag existed.
//
// A role satisfying more than one condition answers to the FIRST that holds
// (the order of consequence): a capped placement is a claim about the role's
// level, a deviating anchor is a claim about the model's calibration, and a
// stale method is a claim about neither until the assessment is completed
// again. One role, one question.
export function calibrationReason(
  facts: CalibrationFacts
): CalibrationReason | null {
  // Only a completed, placed assessment can be calibrated: one still open has
  // no revealed placement to confirm, and completing IS the reveal (spec
  // 2.4/6).
  if (!facts.completed || facts.level === null) return null
  if (facts.profileLimited === true && !facts.calibrated) {
    return "profileLimited"
  }
  if (facts.anchor !== null && facts.anchor.expectedLevel !== facts.level) {
    return "anchorDeviation"
  }
  if (facts.methodDrift) return "staleMethod"
  return null
}

// How many placements are waiting on a person, across a whole register. The
// home to-do's count, and the only aggregate left now that the list is gone.
export function calibrationCount(rows: readonly CalibrationFacts[]): number {
  return rows.reduce(
    (total, row) => (calibrationReason(row) === null ? total : total + 1),
    0
  )
}
