import { ConvexError } from "convex/values"

// The leaf name is its own constant (rather than a second literal below) so
// the personal-data screen's full wire code can be derived from it instead
// of repeating the string.
const ASSISTANT_PERSONAL_DATA_KEY = "assistantPersonalData" as const

// The assistant's own error codes (packages/backend/convex/lib/errors.ts),
// leaf-only (the "errors." namespace prefix is stripped before lookup).
// convex-error.test.ts guards these against the backend's ERROR_CODES so a
// backend rename fails the suite instead of silently falling back here.
export const ASSISTANT_ERROR_KEYS = [
  "assistantBusy",
  "assistantRateLimited",
  "assistantInvalidMessage",
  ASSISTANT_PERSONAL_DATA_KEY,
] as const

export type AssistantErrorKey = (typeof ASSISTANT_ERROR_KEYS)[number]

// The full wire code (with the "errors." namespace prefix) for the
// personal-data screen.
export const ASSISTANT_PERSONAL_DATA_ERROR_CODE =
  `errors.${ASSISTANT_PERSONAL_DATA_KEY}` as const

function isAssistantErrorKey(value: string): value is AssistantErrorKey {
  return (ASSISTANT_ERROR_KEYS as readonly string[]).includes(value)
}

// A failed reply stores the same wire code a thrown ConvexError carries, so
// the stored-code path and the thrown-error path resolve it here rather than
// each comparing against its own literal. Returns null for a code outside
// the assistant's set, which the caller renders as its generic failure text.
export function assistantErrorKeyFromCode(
  code: string | undefined
): AssistantErrorKey | null {
  const leaf = code?.startsWith("errors.") ? code.slice("errors.".length) : null
  return leaf !== null && isAssistantErrorKey(leaf) ? leaf : null
}

// aiGenerationFailed is the generic fallback: the same message
// lib/error-label.ts's aiErrorSubKey already falls back to for an AI-related
// failure it has no specific wording for.
type ErrorsKey = AssistantErrorKey | "aiGenerationFailed"

// Extracts the appError code from a thrown ConvexError (data shape
// { code: "errors.<leaf>" }, see packages/backend/convex/lib/errors.ts) and
// translates its leaf under the "errors" namespace; `t` must already be
// scoped there (useTranslations("errors")). A code outside the assistant's
// known set, or a non-ConvexError failure such as a network error, resolves
// to the generic fallback instead: next-intl throws on an unknown key, so an
// arbitrary code is never forwarded straight into `t`.
export function translateErrorCode(
  error: unknown,
  t: (key: ErrorsKey) => string
): string {
  const code =
    error instanceof ConvexError
      ? (error.data as { code?: string } | null)?.code
      : undefined
  const key = assistantErrorKeyFromCode(code)
  return key === null ? t("aiGenerationFailed") : t(key)
}
