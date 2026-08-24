import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

// Mirrors MAX_CALIBRATION_NOTE in assessment/locking.ts. The backend is what
// decides; this is the gate that keeps a reader from typing past it and losing
// the save.
const MAX = 1000

// Client gate for the confirm-placement note.
//
// OPTIONAL, unlike the weight motivation beside it. The act being recorded is
// "a person looked at this placement and stands behind it", and that act is
// complete without a sentence: most confirmations have nothing to add beyond
// the confirmation itself. Requiring one would turn a judgement into a form to
// fill in, and the text people type to get past a mandatory field is worse than
// no text at all. The note exists for the confirmation that DOES need
// explaining, and the dialog says so.
export function makeCalibrationNoteSchema(t: ValidationT) {
  return z.object({
    note: z.string().trim().max(MAX, t("maxLength")),
  })
}

export type CalibrationNoteValues = z.infer<
  ReturnType<typeof makeCalibrationNoteSchema>
>
