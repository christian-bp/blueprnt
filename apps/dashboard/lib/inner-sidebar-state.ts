// Every inner sidebar (the assistant's conversations panel, the docs nav)
// persists its open/collapsed choice the same way the app sidebar does: a
// cookie, read once at mount and rewritten on every toggle. The vendor
// Sidebar owns its own state; nothing owns these, so they carry their own.
// One module rather than one per surface, keyed by cookie name, so a third
// inner sidebar costs a constant instead of a copied file.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7

export const ASSISTANT_HISTORY_COOKIE = "assistant_history_state"
export const DOCS_NAV_COOKIE = "docs_nav_state"

// Parses one sidebar's persisted open state out of a document.cookie string.
// No cookie (first visit) defaults to OPEN: the nav is the surface's default
// view, not a returning user's opt-in.
export function innerSidebarOpenFromCookie(
  cookie: string,
  name: string
): boolean {
  const entry = cookie.split("; ").find((part) => part.startsWith(`${name}=`))
  if (entry === undefined) return true
  return entry.slice(name.length + 1) === "true"
}

// The mount-time read. Client-only by construction: every caller sits behind
// the client-side auth gates and is never server-rendered, so reading the
// cookie here cannot cause a hydration mismatch.
export function initialInnerSidebarOpen(name: string): boolean {
  if (typeof document === "undefined") return true
  return innerSidebarOpenFromCookie(document.cookie, name)
}

// Every toggle rewrites the cookie so the choice survives a reload, the same
// write-on-toggle idiom the vendor sidebar uses internally.
export function persistInnerSidebarOpen(name: string, open: boolean): void {
  // Direct document.cookie write is intentional: the Cookie Store API the
  // linter suggests is not yet broadly supported and adds async complexity
  // for this fire-and-forget, last-known-choice write (locale-provider.tsx
  // takes the same call).
  // biome-ignore lint/suspicious/noDocumentCookie: see comment above
  document.cookie = `${name}=${open}; path=/; max-age=${COOKIE_MAX_AGE}`
}
