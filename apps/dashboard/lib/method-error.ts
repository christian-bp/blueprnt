import { ConvexError } from "convex/values"

// The appError codes the Godkännande chapter's two writes can raise
// (evaluationModel/approval.ts): the checklist gate, the lifecycle guard on
// approving or restoring at the wrong moment, and the missing last-approved
// buffer. Leaf names only; the "errors." namespace prefix is added below.
//
// Shared by the approval card and the restore dialog rather than restated in
// each: both call mutations that can raise the same lifecycle codes, and a
// second copy would go stale the first time one of them gained a code.
export const METHOD_ERROR_KEYS = [
  "methodBlocked",
  "invalidTransition",
  "notFound",
] as const

export type MethodErrorKey = (typeof METHOD_ERROR_KEYS)[number]

// Translates a rejected method mutation to its message, or the caller's
// fallback for anything else (a network failure, a code this surface does not
// raise). next-intl throws on an unknown key, so an arbitrary code is never
// forwarded into `t`.
export function methodErrorMessage(
  error: unknown,
  t: (key: MethodErrorKey) => string,
  fallback: string
): string {
  if (error instanceof ConvexError) {
    const code = (error.data as { code?: string } | null)?.code
    const known = METHOD_ERROR_KEYS.find((key) => code === `errors.${key}`)
    if (known !== undefined) return t(known)
  }
  return fallback
}
