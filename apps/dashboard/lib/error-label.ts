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
