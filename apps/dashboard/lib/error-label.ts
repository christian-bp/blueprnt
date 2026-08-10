const AI_ERROR_KEYS = {
  "errors.aiUnavailable": "aiUnavailable",
  "errors.aiGenerationFailed": "aiGenerationFailed",
} as const

// Maps a persisted AI errorCode to its sub-key under the errors namespace;
// unknown codes fall back to the generic generation failure.
export function aiErrorSubKey(
  errorCode: string
): "aiUnavailable" | "aiGenerationFailed" {
  return (
    AI_ERROR_KEYS[errorCode as keyof typeof AI_ERROR_KEYS] ??
    "aiGenerationFailed"
  )
}

// The codes a THROWN draft error can carry that deserve their own message.
// Deliberately a short list: a code not here shows the surface's generic copy,
// which is better than a specific-but-wrong message. notFound is excluded on
// purpose ("Not found." tells the user nothing the generic copy does not).
// profileIncomplete is here because a fresh org that has not finished its
// company settings can reach an AI panel and needs to be told which step is
// missing, not "something went wrong".
const DRAFT_ERROR_KEYS = [
  "aiUnavailable",
  "aiGenerationFailed",
  "profileIncomplete",
] as const

export type DraftErrorKey = (typeof DRAFT_ERROR_KEYS)[number]

// ConvexErrors serialize the appError code into the message (e.g.
// "errors.aiUnavailable"), so a thrown error is matched by substring. Returns
// null when nothing matches, so the caller supplies its own generic copy.
export function draftErrorKey(error: unknown): DraftErrorKey | null {
  const message = error instanceof Error ? error.message : ""
  return (
    DRAFT_ERROR_KEYS.find((key) => message.includes(`errors.${key}`)) ?? null
  )
}
