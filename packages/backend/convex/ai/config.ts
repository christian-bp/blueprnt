// Provider identity for suggestion provenance. Plain constants so the
// default-runtime mutation surface (suggest.ts) can import them without
// pulling the Node-only AI SDK into the V8 bundle.
export const AI_PROVIDER = "mistral"
// AI_MODEL_ID (Large 3) is the quality-defining default for the
// evaluation-model/criteria draft, weight review, and starter import.
// AI_PROFILE_MODEL_ID (Small 4) is the fast/cheap model for high-volume
// role-profile drafting. Both are Mistral La Plateforme (EU); the AI Gateway
// stays forbidden (ADR-0001/0003). Both are env-overridable.
export const AI_MODEL_ID = process.env.MISTRAL_MODEL ?? "mistral-large-latest"
export const AI_PROFILE_MODEL_ID =
  process.env.MISTRAL_PROFILE_MODEL ?? "mistral-small-latest"

// Caps on the free text that reaches a model call. The prompt fields are NOT
// all bounded at their source: createRole trims function and team without
// length-checking them, and the draft's guidance text is never stored at all.
// The prompt layer therefore bounds them itself, because otherwise any member
// could spend the org's tokens on an arbitrarily large call. Clamped, not
// rejected: the cap protects the call, it is not a validation rule the user
// should have to satisfy.
export const MAX_PROMPT_IDENTITY_FIELD = 200
export const MAX_PROMPT_DESCRIPTION = 2000

// The assistant chat model: mistral-medium-latest is the default because its
// conversational latency fits a chat UX. Despite the "medium" name this is
// NOT the cheap tier: verified pricing (ai/pricing.ts) has it priced above
// mistral-large-latest ($1.50/$7.50 per 1M tokens vs large's $0.50/$1.50).
// Mistral's tier names track model generation, not a price ranking, so the
// tradeoff picked here is latency, not token cost. Env-overridable like the
// others.
export const AI_ASSISTANT_MODEL_ID =
  process.env.MISTRAL_ASSISTANT_MODEL ?? "mistral-medium-latest"

// Assistant guardrails. The message cap is clamped, not rejected (same
// rationale as MAX_PROMPT_DESCRIPTION); the hourly cap and the single
// in-flight generation ARE rejected, with their own error codes.
export const MAX_ASSISTANT_MESSAGE_LENGTH = 4000
export const ASSISTANT_HISTORY_LIMIT = 20
// The history list (listThreads) caps at this many threads, most recently
// active first; a heavier user's older conversations still exist and stay
// reachable if this cap is ever paginated, but are not shown today.
export const ASSISTANT_THREAD_LIST_LIMIT = 50
export const ASSISTANT_HOURLY_MESSAGE_CAP = 30
// Paired with the client's staggered word reveal (streamdown's per-word
// fadeIn): a tighter flush cadence keeps multi-word chunks small enough that
// the reveal reads as a continuous stream rather than chunky bursts.
export const ASSISTANT_FLUSH_INTERVAL_MS = 150
export const ASSISTANT_MAX_TOOL_STEPS = 3
// Generation hard-stop: a reply that has not finished within this window is
// aborted server-side, so a stuck stream never holds a message in
// "streaming" forever.
export const ASSISTANT_GENERATION_TIMEOUT_MS = 120_000
// Bounds a single reply's spend; the 120s timeout above bounds latency.
export const ASSISTANT_MAX_OUTPUT_TOKENS = 4096
// Word-paced text arrival at the SOURCE (the streamText call's smoothStream
// transform), not only at the client: a fast model still emits its whole
// output in a handful of large provider-side chunks, and pacing only on the
// client turns each of those into one huge reveal step. At one word per this
// many milliseconds (~100 words/s), the largest possible reply
// (ASSISTANT_MAX_OUTPUT_TOKENS tokens, roughly 3000 words at ~0.75 words per
// token) still finishes streaming in well under a minute, comfortably inside
// ASSISTANT_GENERATION_TIMEOUT_MS.
export const ASSISTANT_STREAM_SMOOTHING_MS = 10
// How long recordUsage waits for the SDK's usage promise to settle on an
// aborted stream before giving up and recording nothing.
export const ASSISTANT_USAGE_RACE_MS = 2_000

// Thread-title side call (title.ts): its own bounds, distinct from the main
// reply's above, because a 3-60 char title needs far less output budget and
// this call must never outlive the reply thread it runs alongside.
export const ASSISTANT_TITLE_MAX_OUTPUT_TOKENS = 64
export const ASSISTANT_TITLE_GENERATION_TIMEOUT_MS = 30_000
// The AI title's own max length (title.ts's schema) and the user-driven
// renameConversation mutation's max length share this one bound, so a
// manual rename can never exceed what the AI title itself is allowed to
// produce.
export const ASSISTANT_TITLE_MAX_LENGTH = 60
// Mistral's free tier is ~1 rps, so a title call running concurrently with
// the main reply's own model call is the likelier of the two to hit a 429.
export const ASSISTANT_TITLE_MAX_RETRIES = 5
// Statistical disclosure floor: a pay statistic over fewer people than this
// is suppressed before it reaches the model, because a tiny group's average
// IS an individual's salary (ADR-0018).
export const ASSISTANT_MIN_GROUP_SIZE = 3

// The prompt instructs the model to respond in the requester's UI language.
// Lives here (not in generate.ts) so V8-runtime modules can build prompts.
export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  sv: "Swedish",
  nb: "Norwegian (Bokmal)",
  da: "Danish",
  fi: "Finnish",
}
