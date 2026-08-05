// The vendor sidebar (packages/ui sidebar.tsx) persists its open state by
// writing this cookie on every toggle, but never reads it back and does not
// export the name; the literal mirrors the vendor's SIDEBAR_COOKIE_NAME.
const SIDEBAR_COOKIE_NAME = "sidebar_state"

// Parse the sidebar's persisted open state out of a document.cookie string.
// No cookie (first visit) defaults to expanded: the nav labels are part of
// the app's guidance, so the icon rail is the returning user's opt-in.
export function sidebarOpenFromCookie(cookie: string): boolean {
  const entry = cookie
    .split("; ")
    .find((part) => part.startsWith(`${SIDEBAR_COOKIE_NAME}=`))
  if (entry === undefined) return true
  return entry.slice(SIDEBAR_COOKIE_NAME.length + 1) === "true"
}

// AppShell's mount-time read. Client-only by construction: AppShell mounts
// behind the client-side auth gates and is never server-rendered, so reading
// the cookie here cannot cause a hydration mismatch.
export function initialSidebarOpen(): boolean {
  if (typeof document === "undefined") return true
  return sidebarOpenFromCookie(document.cookie)
}
