import {
  AiChat02Icon,
  Audit02Icon,
  BookOpen01Icon,
  Briefcase01Icon,
  ChartColumnIcon,
  DashboardSquare02Icon,
  Layers01Icon,
  UserGroup03Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import type { SECTION_PAGES } from "@/lib/section-pages"

// Single source of truth for the app's top-level destinations. The sidebar and
// the command palette both render from these lists, so the two surfaces cannot
// drift apart in label, order, destination, or who is allowed to see an entry.
// Label keys are relative to the `dashboard` namespace and stay literal (never
// widen them to string) so the t() call sites keep compile-time key checking;
// a section's sub-pages are not repeated here, they come from SECTION_PAGES.
//
// Icons live here as icon DATA, not as rendered elements: an entry in
// @hugeicons/core-free-icons is a plain array of tag/attribute pairs with no
// React import and no "use client", so carrying it keeps this module framework
// free and importable from a server component. Each consumer renders it with
// <HugeiconsIcon icon={entry.icon} />, which is the only client-only piece.
const NAV_GROUPS_SOURCE = [
  {
    labelKey: "nav.groups.status",
    entries: [
      // The dashboard landing. It gets its own heading like every other
      // destination (a single uncaptioned row above captioned ones reads as a
      // stray), and the dashboard grid rather than a house: the page is a
      // panel of widgets, and a house would promise a "home" concept the app
      // does not have.
      {
        labelKey: "nav.home",
        href: "/",
        icon: DashboardSquare02Icon,
        adminOnly: false,
      },
      {
        labelKey: "nav.assistant",
        href: "/assistant",
        icon: AiChat02Icon,
        adminOnly: false,
      },
    ],
  },
  // Job evaluation: the role world and the model that values it. Job
  // architecture owns both the level Overview at /work and the role register
  // at /roles, so it is a single entry here that stays active across both
  // paths.
  {
    labelKey: "nav.groups.evaluation",
    entries: [
      {
        labelKey: "nav.work",
        href: "/work",
        match: ["/roles"],
        section: "work",
        icon: Briefcase01Icon,
        adminOnly: false,
      },
      // The model section has no static sub-pages here: its four chapters
      // carry their own in-page tab row under the section's progress spine,
      // the same way one kartläggning's analysis chapters do.
      {
        labelKey: "nav.model",
        href: "/model",
        icon: Layers01Icon,
        adminOnly: false,
      },
    ],
  },
  // People & pay: the employee register and the pay mappings built from it.
  // These are the person-data surfaces, kept apart from the role world both in
  // the nav and in the domain (Role != Person).
  {
    labelKey: "nav.groups.peoplePay",
    entries: [
      {
        labelKey: "nav.people",
        href: "/people",
        section: "people",
        icon: UserGroup03Icon,
        adminOnly: false,
      },
      // Pay mappings has no static sub-pages: inside one pay-mapping run the
      // header owns the per-run tabs (they are scoped to the run's slug).
      {
        labelKey: "nav.payMapping",
        href: "/pay-mappings",
        icon: ChartColumnIcon,
        adminOnly: false,
      },
    ],
  },
  // Admin-only destinations (team/org settings and the org's event trail).
  // The backend query is the real gate; adminOnly just keeps them out of
  // editors' sight, on every surface that renders this registry.
  {
    labelKey: "nav.groups.administration",
    entries: [
      {
        labelKey: "nav.organization",
        href: "/organization",
        section: "organization",
        icon: UserMultipleIcon,
        adminOnly: true,
      },
      {
        labelKey: "nav.auditLog",
        href: "/audit-log",
        icon: Audit02Icon,
        adminOnly: true,
      },
    ],
  },
] as const

// The user guide sits in the sidebar footer rather than in a group: it is a
// reference surface next to the account row, not one of the work areas above.
const NAV_DOCS_SOURCE = {
  labelKey: "nav.docs",
  href: "/docs",
  icon: BookOpen01Icon,
  adminOnly: false,
} as const

type NavGroupSource = (typeof NAV_GROUPS_SOURCE)[number]
type NavEntrySource = NavGroupSource["entries"][number] | typeof NAV_DOCS_SOURCE

export type NavGroupLabelKey = NavGroupSource["labelKey"]
export type NavEntryLabelKey = NavEntrySource["labelKey"]

// A top-level destination. `match` lists extra path prefixes that also mark it
// active (Work owns /roles as well as its own /work); `section` names its
// SECTION_PAGES list, the sub-pages its header tabs render; `adminOnly` is
// declared on every entry so no consumer has to remember a default.
export type NavEntry = {
  readonly labelKey: NavEntryLabelKey
  readonly href: string
  readonly icon: IconSvgElement
  readonly adminOnly: boolean
  readonly match?: readonly string[]
  readonly section?: keyof typeof SECTION_PAGES
}

export type NavGroup = {
  readonly labelKey: NavGroupLabelKey
  readonly entries: readonly NavEntry[]
}

export const NAV_GROUPS: readonly NavGroup[] = NAV_GROUPS_SOURCE
export const NAV_DOCS: NavEntry = NAV_DOCS_SOURCE

// The organization role from useOrganization(): "admin" | "editor" today, kept
// as a plain string because the backend owns the enum.
export function canSeeNavEntry(entry: NavEntry, role: string): boolean {
  return !entry.adminOnly || role === "admin"
}

// The groups this role may see, with hidden entries removed and a group that
// lost all of its entries dropped, so no surface renders an empty heading.
export function navGroupsFor(role: string): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    labelKey: group.labelKey,
    entries: group.entries.filter((entry) => canSeeNavEntry(entry, role)),
  })).filter((group) => group.entries.length > 0)
}

// Every destination this role may see as one flat list, groups first and the
// footer's guide last, for surfaces with no group structure of their own.
export function navEntriesFor(role: string): NavEntry[] {
  return [...NAV_GROUPS.flatMap((group) => group.entries), NAV_DOCS].filter(
    (entry) => canSeeNavEntry(entry, role)
  )
}

// A destination is active on an exact URL match or a sub-path (so /work does
// not match /workspace), extended by the entry's `match` prefixes. The root is
// the exception: every path starts with "/", so it is active only on itself.
export function isNavActive(
  pathname: string,
  href: string,
  match: readonly string[] = []
): boolean {
  const hits = (url: string) =>
    url === "/"
      ? pathname === "/"
      : pathname === url || pathname.startsWith(`${url}/`)
  return hits(href) || match.some(hits)
}
