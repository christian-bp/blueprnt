// The conversations panel persists its open/collapsed choice the same way the
// app sidebar does (lib/sidebar-state.ts): a cookie, read once at mount and
// rewritten on every toggle. Its own cookie name and its own write helper,
// since (unlike the vendor Sidebar) nothing else owns this panel's open state
// for it.
const ASSISTANT_HISTORY_COOKIE_NAME = "assistant_history_state"
const ASSISTANT_HISTORY_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

// Parses the panel's persisted open state out of a document.cookie string.
// No cookie (first visit) defaults to OPEN: the conversations panel is the
// default view of the assistant page, not a returning user's opt-in.
export function assistantHistoryOpenFromCookie(cookie: string): boolean {
  const entry = cookie
    .split("; ")
    .find((part) => part.startsWith(`${ASSISTANT_HISTORY_COOKIE_NAME}=`))
  if (entry === undefined) return true
  return entry.slice(ASSISTANT_HISTORY_COOKIE_NAME.length + 1) === "true"
}

// The page's mount-time read. Client-only by construction: the assistant
// page is never server-rendered, so reading the cookie here cannot cause a
// hydration mismatch.
export function initialAssistantHistoryOpen(): boolean {
  if (typeof document === "undefined") return true
  return assistantHistoryOpenFromCookie(document.cookie)
}

// Every toggle rewrites the cookie so the choice survives a reload, the same
// write-on-toggle idiom the vendor sidebar uses internally.
export function persistAssistantHistoryOpen(open: boolean): void {
  // Direct document.cookie write is intentional: the Cookie Store API the
  // linter suggests is not yet broadly supported and adds async complexity
  // for this fire-and-forget, last-known-choice write (locale-provider.tsx
  // takes the same call).
  // biome-ignore lint/suspicious/noDocumentCookie: see comment above
  document.cookie = `${ASSISTANT_HISTORY_COOKIE_NAME}=${open}; path=/; max-age=${ASSISTANT_HISTORY_COOKIE_MAX_AGE}`
}
