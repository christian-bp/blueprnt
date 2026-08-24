import { ConvexError } from "convex/values"

// The appError codes the completion act can raise (assessment/locking.ts).
// Every one of them is another operator's edit landing between the moment the
// flow rendered and the moment the last step was pressed: the model losing its
// approval, a new criterion making the role incomplete again, a rating that no
// longer carries its required motivation, or the assessment already having
// been completed from another tab.
//
// Leaf names only; the "errors." namespace prefix is added below. Shared
// rather than restated at each call site, on the same reasoning as
// METHOD_ERROR_KEYS: two surfaces call the same mutation, and a second copy
// goes stale the first time one of them gains a code.
export const ASSESSMENT_ERROR_KEYS = [
  "ratingsIncomplete",
  "motivationRequired",
  "modelNotApproved",
  "assessmentLocked",
] as const

export type AssessmentErrorKey = (typeof ASSESSMENT_ERROR_KEYS)[number]

// Translates a rejected completion to its message, or the caller's fallback
// for anything else (a network failure, a code this surface does not raise).
// next-intl throws on an unknown key, so an arbitrary code is never forwarded
// into `t`.
export function assessmentErrorMessage(
  error: unknown,
  t: (key: AssessmentErrorKey) => string,
  fallback: string
): string {
  if (error instanceof ConvexError) {
    const code = (error.data as { code?: string } | null)?.code
    const known = ASSESSMENT_ERROR_KEYS.find((key) => code === `errors.${key}`)
    if (known !== undefined) return t(known)
  }
  return fallback
}
