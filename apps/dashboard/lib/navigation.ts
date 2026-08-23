import {
  AiChat02Icon,
  Audit02Icon,
  BookOpen01Icon,
  Briefcase01Icon,
  Building01Icon,
  ChartColumnIcon,
  Home07Icon,
  Layers01Icon,
  Mail01Icon,
  RankingIcon,
  Settings01Icon,
  Shield01Icon,
  SparklesIcon,
  SquareLock02Icon,
  Tag01Icon,
  UserCircle02Icon,
  UserGroup03Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"

// Single source of truth for the app's navigation: the AREAS on the icon rail
// and each area's inner-sidebar rows. The rail, the inner sidebar, the mobile
// nav sheet, and the command palette all render from this registry, so the
// surfaces cannot drift apart in label, order, destination, or who is allowed
// to see an entry. Label keys are relative to the `dashboard` namespace and
// stay literal (never widen them to string) so the t() call sites keep
// compile-time key checking.
//
// Icons live here as icon DATA, not as rendered elements: an entry in
// @hugeicons/core-free-icons is a plain array of tag/attribute pairs with no
// React import and no "use client", so carrying it keeps this module framework
// free and importable from a server component. Each consumer renders it with
// <HugeiconsIcon icon={area.icon} />, which is the only client-only piece.
const NAV_AREAS_SOURCE = [
  {
    id: "home",
    labelKey: "nav.home",
    href: "/",
    icon: Home07Icon,
    // The assistant lives under Home: its rail icon is gone and its
    // destination is a Home inner row, so the Home icon stays lit there.
    match: ["/assistant"],
    adminOnly: false,
    platformOnly: false,
    placement: "main",
    innerNav: [
      {
        labelKey: "nav.home",
        entries: [
          {
            labelKey: "nav.home",
            href: "/",
            icon: Home07Icon,
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
    ],
  },
  {
    id: "work",
    labelKey: "nav.work",
    href: "/work",
    icon: Briefcase01Icon,
    match: ["/roles"],
    adminOnly: false,
    platformOnly: false,
    placement: "main",
    innerNav: [
      {
        labelKey: "nav.work",
        entries: [
          {
            labelKey: "nav.overview",
            href: "/work",
            icon: RankingIcon,
            adminOnly: false,
          },
          {
            labelKey: "nav.roles",
            href: "/roles",
            icon: Briefcase01Icon,
            adminOnly: false,
            // Roles still waiting for a completed evaluation.
            count: "evaluateRemaining",
          },
        ],
      },
    ],
  },
  {
    id: "model",
    labelKey: "nav.model",
    href: "/model",
    icon: Layers01Icon,
    match: [],
    adminOnly: false,
    platformOnly: false,
    placement: "main",
    // A single row: the model's four chapters stay one guided journey with
    // its own in-page tab row, so the sidebar carries only the area itself
    // (every area keeps the inner-sidebar frame).
    innerNav: [
      {
        labelKey: "nav.model",
        entries: [
          {
            labelKey: "nav.model",
            href: "/model",
            icon: Layers01Icon,
            adminOnly: false,
          },
        ],
      },
    ],
  },
  {
    id: "people",
    labelKey: "nav.people",
    href: "/people",
    icon: UserGroup03Icon,
    match: [],
    adminOnly: false,
    platformOnly: false,
    placement: "main",
    innerNav: [
      {
        labelKey: "nav.people",
        entries: [
          {
            labelKey: "people.tabs.people",
            href: "/people",
            icon: UserGroup03Icon,
            adminOnly: false,
          },
          {
            labelKey: "people.tabs.classify",
            href: "/people/classify",
            icon: Tag01Icon,
            adminOnly: false,
            // People still waiting for a confirmed role.
            count: "classifyRemaining",
          },
        ],
      },
    ],
  },
  {
    id: "payMappings",
    labelKey: "nav.payMapping",
    href: "/pay-mappings",
    icon: ChartColumnIcon,
    match: [],
    adminOnly: false,
    platformOnly: false,
    placement: "main",
    // A single row for the register; inside one run the page-owned run
    // sidebar (run switcher, the run's destinations) takes over.
    innerNav: [
      {
        labelKey: "nav.payMapping",
        entries: [
          {
            labelKey: "nav.payMapping",
            href: "/pay-mappings",
            icon: ChartColumnIcon,
            adminOnly: false,
          },
        ],
      },
    ],
  },
  {
    id: "docs",
    labelKey: "nav.docs",
    href: "/docs",
    icon: BookOpen01Icon,
    match: [],
    adminOnly: false,
    platformOnly: false,
    placement: "footer",
    // The guide nav is content-driven (the corpus), owned by the docs layout.
    innerNav: [],
  },
  {
    id: "settings",
    labelKey: "nav.settings",
    // The rail link target for admins; editors land on their account instead
    // (settingsHrefFor). The organization rows are entry-gated below, so an
    // editor's settings area shows only the account group.
    href: "/organization/general",
    icon: Settings01Icon,
    match: ["/organization", "/account", "/audit-log"],
    adminOnly: false,
    platformOnly: false,
    placement: "footer",
    innerNav: [
      {
        labelKey: "nav.organization",
        entries: [
          {
            labelKey: "organization.tabs.general",
            href: "/organization/general",
            icon: Settings01Icon,
            adminOnly: true,
          },
          {
            labelKey: "organization.tabs.members",
            href: "/organization/members",
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
      {
        labelKey: "nav.accountSettings",
        entries: [
          {
            labelKey: "account.tabs.profile",
            href: "/account/profile",
            icon: UserCircle02Icon,
            adminOnly: false,
          },
          {
            labelKey: "account.tabs.security",
            href: "/account/security",
            icon: SquareLock02Icon,
            adminOnly: false,
          },
        ],
      },
    ],
  },
  // Platform staff only: never returned by areasFor (the org role cannot see
  // it); the rail shows it when the isPlatformAdmin query answers true, and
  // the admin layout keeps the real gate.
  {
    id: "admin",
    labelKey: "nav.admin",
    href: "/admin",
    icon: Shield01Icon,
    match: [],
    adminOnly: false,
    platformOnly: true,
    placement: "main",
    innerNav: [
      {
        labelKey: "nav.admin",
        entries: [
          {
            labelKey: "admin.tabs.users",
            href: "/admin",
            icon: UserMultipleIcon,
            adminOnly: false,
          },
          {
            labelKey: "admin.tabs.organizations",
            href: "/admin/organizations",
            icon: Building01Icon,
            adminOnly: false,
          },
          {
            labelKey: "admin.tabs.auditLog",
            href: "/admin/audit-log",
            icon: Audit02Icon,
            adminOnly: false,
          },
          {
            labelKey: "admin.tabs.emailLog",
            href: "/admin/email-log",
            icon: Mail01Icon,
            adminOnly: false,
          },
          {
            labelKey: "admin.tabs.aiUsage",
            href: "/admin/ai-usage",
            icon: SparklesIcon,
            adminOnly: false,
          },
        ],
      },
    ],
  },
] as const

type NavAreaSource = (typeof NAV_AREAS_SOURCE)[number]
type InnerNavGroupSource = NavAreaSource["innerNav"][number]
type InnerNavEntrySource = InnerNavGroupSource["entries"][number]

export type AreaId = NavAreaSource["id"]
export type NavAreaLabelKey = NavAreaSource["labelKey"]
export type InnerNavGroupLabelKey = InnerNavGroupSource["labelKey"]
export type InnerNavEntryLabelKey = InnerNavEntrySource["labelKey"]

// The live todo counters an inner-nav row can carry (the notification badge
// beside the row's name). Ids, not values: the registry stays framework free,
// and InnerNavCount (components/inner-nav-count.tsx) owns the id-to-query
// mapping, so a new counter is added THERE and referenced here.
export type InnerNavCountId = "classifyRemaining" | "evaluateRemaining"

// One row in an area's inner sidebar. adminOnly is declared on every entry so
// no consumer has to remember a default.
export type InnerNavEntry = {
  readonly labelKey: InnerNavEntryLabelKey
  readonly href: string
  readonly icon: IconSvgElement
  readonly adminOnly: boolean
  readonly count?: InnerNavCountId
}

// A group of inner rows under its uppercase category heading. The heading is
// required: every sidebar group names its category, so a group cannot ship
// without one.
export type InnerNavGroup = {
  readonly labelKey: InnerNavGroupLabelKey
  readonly entries: readonly InnerNavEntry[]
}

// One rail area. `match` lists extra path prefixes that also mark it active
// (Work owns /roles as well as /work; Settings owns the whole
// organization/account/audit-log constellation). `placement` splits the rail
// into its main run and its footer (guide + settings above the avatar).
export type NavArea = {
  readonly id: AreaId
  readonly labelKey: NavAreaLabelKey
  readonly href: string
  readonly icon: IconSvgElement
  readonly match: readonly string[]
  readonly adminOnly: boolean
  readonly platformOnly: boolean
  readonly placement: "main" | "footer"
  readonly innerNav: readonly InnerNavGroup[]
}

export const NAV_AREAS: readonly NavArea[] = NAV_AREAS_SOURCE

// The organization role from useOrganization(): "admin" | "editor" today, kept
// as a plain string because the backend owns the enum.
function canSee(adminOnly: boolean, role: string): boolean {
  return !adminOnly || role === "admin"
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

// The area owning a pathname: the one whose longest prefix (href or match)
// covers it. Longest wins so a future overlap resolves to the more specific
// area instead of source order.
export function areaForPathname(pathname: string): NavArea | undefined {
  let best: { area: NavArea; length: number } | undefined
  for (const area of NAV_AREAS) {
    for (const prefix of [area.href, ...area.match]) {
      const hit =
        prefix === "/"
          ? pathname === "/"
          : pathname === prefix || pathname.startsWith(`${prefix}/`)
      if (hit && (best === undefined || prefix.length > best.length)) {
        best = { area, length: prefix.length }
      }
    }
  }
  return best?.area
}

// The rail rows this org role may see. Platform-only areas are never returned
// here: the org role cannot answer for them (the rail asks the platform query
// separately).
export function areasFor(role: string): NavArea[] {
  return NAV_AREAS.filter(
    (area) => !area.platformOnly && canSee(area.adminOnly, role)
  )
}

// An area's inner rows for this role, with hidden entries removed and a group
// that lost all of its entries dropped, so no surface renders an empty
// heading.
export function innerNavFor(area: NavArea, role: string): InnerNavGroup[] {
  return area.innerNav
    .map((group) => ({
      labelKey: group.labelKey,
      entries: group.entries.filter((entry) => canSee(entry.adminOnly, role)),
    }))
    .filter((group) => group.entries.length > 0)
}

// The platform console's area, resolved once here instead of cast at a call
// site. Renaming the id is a compile error (comparing the literal against
// the AreaId union), and losing the entry throws at module load instead of
// handing a consumer undefined.
function requireArea(id: AreaId): NavArea {
  const area = NAV_AREAS.find((candidate) => candidate.id === id)
  if (area === undefined) throw new Error(`NAV_AREAS lost the ${id} area`)
  return area
}

export const NAV_ADMIN_AREA: NavArea = requireArea("admin")

// Where the settings rail icon lands: admins own the organization pages,
// editors go straight to their own account.
export function settingsHrefFor(role: string): string {
  return role === "admin" ? "/organization/general" : "/account/profile"
}

// The current page within a set of hrefs is the deepest matching link: an
// index page (/people) yields to its nested siblings (/people/classify), and
// a register's detail pages keep the register's own page current
// (/people/<id> resolves to /people).
export function deepestMatch(
  hrefs: readonly string[],
  pathname: string
): string | undefined {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0]
}
