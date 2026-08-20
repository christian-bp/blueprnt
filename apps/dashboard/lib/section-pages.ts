// Single source of truth for each section's sub-pages. The header tab strips
// (SectionTabs, PeopleTabs, OrganizationTabs) and the sidebar's slide-out
// sub-menu all render from these lists, so the two surfaces cannot drift apart
// in label, order, or destination. Label keys are relative to the `dashboard`
// namespace and stay literal (never widen them to string) so the t() call
// sites keep compile-time key checking. Each list's first entry is the
// section's index page.
//
// A section whose sub-pages are the CHAPTERS of one guided journey is not
// listed here: the kartläggning's analysis chapters and the model section's
// four chapters carry their own in-page tab row under their own progress
// spine, and repeating them as header tabs and sidebar rows would give the
// same four destinations three simultaneous switchers.
export const SECTION_PAGES = {
  work: [
    { labelKey: "nav.overview", href: "/work" },
    { labelKey: "nav.roles", href: "/roles" },
  ],
  people: [
    { labelKey: "people.tabs.people", href: "/people" },
    { labelKey: "people.tabs.classify", href: "/people/classify" },
  ],
  organization: [
    { labelKey: "organization.tabs.general", href: "/organization/general" },
    { labelKey: "organization.tabs.members", href: "/organization/members" },
  ],
} as const

// The current page within a section is the deepest matching link: an index
// page (/people) yields to its nested siblings (/people/classify), and a
// register's detail pages keep the register's own page current
// (/people/<id> resolves to /people).
export function deepestMatch(
  hrefs: readonly string[],
  pathname: string
): string | undefined {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0]
}
