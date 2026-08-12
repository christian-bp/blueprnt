import { ConvexError } from "convex/values"

// The assistant's own error codes (packages/backend/convex/lib/errors.ts),
// leaf-only (the "errors." namespace prefix is stripped before lookup).
const ASSISTANT_ERROR_KEYS = [
  "assistantBusy",
  "assistantRateLimited",
  "assistantInvalidMessage",
  "assistantPersonalData",
] as const

type AssistantErrorKey = (typeof ASSISTANT_ERROR_KEYS)[number]

function isAssistantErrorKey(value: string): value is AssistantErrorKey {
  return (ASSISTANT_ERROR_KEYS as readonly string[]).includes(value)
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
  const leaf = code?.startsWith("errors.") ? code.slice("errors.".length) : null
  return leaf !== null && isAssistantErrorKey(leaf)
    ? t(leaf)
    : t("aiGenerationFailed")
}
