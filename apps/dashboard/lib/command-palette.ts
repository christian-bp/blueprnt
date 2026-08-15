import {
  BookOpen01Icon,
  Briefcase01Icon,
  HashIcon,
  Settings01Icon,
  UserGroup03Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { slugify } from "@workspace/constants"
import { headingAnchor } from "@/lib/docs/anchors"
// Type only: docs-index reads the filesystem, and this module runs in the
// browser. `import type` erases, so nothing of it reaches the client bundle.
import type { DocsIndex } from "@/lib/docs/docs-index"
import { type NavEntryLabelKey, navEntriesFor } from "@/lib/navigation"
import { SECTION_PAGES } from "@/lib/section-pages"

// One row in the command palette. `key` is the row's identity for cmdk (which
// tracks selection by value, so two rows sharing one break keyboard
// navigation) and is never shown; `detail` is the muted trailing text: a
// sub-page's section, a guide's description, a heading's guide. `icon` is
// icon DATA (see lib/navigation.ts), rendered by the component.
export interface PaletteItem {
  readonly key: string
  readonly href: string
  readonly label: string
  readonly icon: IconSvgElement
  readonly detail?: string
}

// Destinations that are real pages with no sidebar row of their own: the two
// import wizards (reached from a button on their register) and the account
// section (reached from the account menu). They are listed by their product
// name, the label their own entry point already carries, so the palette never
// invents a second name for a page that has one. /admin/* stays out: it is a
// platform-staff surface behind a different gate than the org role this
// module filters on, so listing it here would show rows the org's own admin
// cannot open.
//
// Both import wizards live under a register every role can see, and the
// account section is the signed-in user's own, so none of these needs the
// role filter that navEntriesFor applies to the sidebar entries.
const EXTRA_PAGES = [
  {
    href: "/people/import",
    labelKey: "people.import.title",
    detailKey: "nav.people",
    icon: UserGroup03Icon,
  },
  {
    // The destination's own name, not the button that opens it
    // ("Add roles"): a user looking for the role importer types "import",
    // which the CTA's wording answers in no locale.
    href: "/roles/import",
    labelKey: "roles.import.title",
    detailKey: "nav.roles",
    icon: Briefcase01Icon,
  },
  // /account redirects to /account/profile, and is listed for the same reason
  // /work is listed twice: "Account settings" is a real name for that
  // destination, and the query that uses it has to find something.
  { href: "/account", labelKey: "nav.accountSettings", icon: Settings01Icon },
  {
    href: "/account/profile",
    labelKey: "account.tabs.profile",
    detailKey: "nav.accountSettings",
    icon: Settings01Icon,
  },
  {
    href: "/account/security",
    labelKey: "account.tabs.security",
    detailKey: "nav.accountSettings",
    icon: Settings01Icon,
  },
] as const

type ExtraPage = (typeof EXTRA_PAGES)[number]

// The label keys the palette resolves: a top-level destination's, one of its
// section sub-pages', or one of the sidebar-less pages above. Kept as the
// literal union so a caller passing useTranslations' `t` keeps compile-time
// key checking.
type SectionPageLabelKey =
  (typeof SECTION_PAGES)[keyof typeof SECTION_PAGES][number]["labelKey"]
export type PageLabelKey =
  | NavEntryLabelKey
  | SectionPageLabelKey
  | ExtraPage["labelKey"]
  | Extract<ExtraPage, { detailKey: string }>["detailKey"]

// Every destination in the app, in sidebar order: the registry's top-level
// entries, each followed by its section's sub-pages, then the pages that have
// no sidebar row at all. The admin filter is navEntriesFor's, the same one the
// sidebar renders through, so a member who cannot see a page in the nav cannot
// find it here either. Hiding a destination is not the permission boundary
// (the backend is), but the two surfaces must never disagree about what
// exists.
//
// A section's index sub-page repeats its parent's href under a different name
// (/work is both "Job architecture" and "Levels"), exactly as the sidebar
// shows it: both names are real names for that page, and dropping one would
// make the query that uses it find nothing.
export function pageItems(
  role: string,
  label: (key: PageLabelKey) => string
): PaletteItem[] {
  const nav = navEntriesFor(role).flatMap((entry) => {
    const parent = label(entry.labelKey)
    const item: PaletteItem = {
      key: `page:${entry.href}`,
      href: entry.href,
      label: parent,
      icon: entry.icon,
    }
    if (entry.section === undefined) return [item]
    // A sub-page carries its section's icon: it is the same destination one
    // level down, and a row with no glyph beside rows that have one reads as
    // a different kind of thing.
    const subs = SECTION_PAGES[entry.section].map(
      (page): PaletteItem => ({
        key: `page:${entry.labelKey}:${page.labelKey}`,
        href: page.href,
        label: label(page.labelKey),
        icon: entry.icon,
        detail: parent,
      })
    )
    return [item, ...subs]
  })
  const extra = EXTRA_PAGES.map(
    (page): PaletteItem => ({
      key: `page:${page.href}`,
      href: page.href,
      label: label(page.labelKey),
      icon: page.icon,
      detail: "detailKey" in page ? label(page.detailKey) : undefined,
    })
  )
  return [...nav, ...extra]
}

// One row per guide, matched on its title and its description.
export function guideItems(index: DocsIndex): PaletteItem[] {
  return index.map((doc) => ({
    key: `guide:${doc.slug}`,
    href: `/docs/${doc.slug}`,
    label: doc.title,
    icon: BookOpen01Icon,
    detail: doc.description,
  }))
}

// One row per heading inside a guide, linking to the heading's own anchor.
// The anchor comes from headingAnchor, the function that wrote the id into
// the rendered page, so the two cannot drift. Anchors are unique within a
// guide (guard 10 in docs-guards.test.ts fails on a collision) and the slug
// prefixes the key, so the keys are unique across the corpus.
export function sectionItems(index: DocsIndex): PaletteItem[] {
  return index.flatMap((doc) =>
    doc.headings.map((heading) => {
      const href = `/docs/${doc.slug}#${headingAnchor(heading)}`
      return {
        key: `section:${href}`,
        href,
        label: heading,
        icon: HashIcon,
        detail: doc.title,
      }
    })
  )
}

// Matching is plain text, folded through slugify: it lowercases, transliterates
// the Nordic letters and strips the diacritics, so "nivaer" finds "Nivåer" and
// "lonekartlaggning" finds "Lönekartläggning". Folding to the same shape the
// anchors use means one rule for the whole docs surface rather than a second
// near-identical normalizer. slugify joins words with "-", which keeps word
// boundaries intact, so a token can never match across two words.
function fold(text: string): string {
  return `-${slugify(text)}-`
}

// A hyphen inside a word is a spelling nobody can be asked to reproduce: the
// corpus writes "e-post", "AI-förslag" and "CSV-fil", and users type them
// both ways. Dropping only the text's OWN hyphens (before folding, so the
// spaces still become the "-" separators fold relies on) joins "e-post" into
// "epost" while leaving "Pay mapping" two words, which keeps the cross-word
// guard intact for both tiers.
function foldJoined(text: string): string {
  return fold(text.replaceAll("-", ""))
}

const PREFIX_MATCH = 4
const LABEL_MATCH = 3
const JOINED_MATCH = 2
const DETAIL_MATCH = 1

// How well a row answers the query, 0 for no match. A hit in the row's own
// name outranks one that only appears in its description, and a name that
// starts with the query outranks a name that merely contains it, so typing
// "roles" puts the Roles page above a guide that mentions roles in passing.
// A name matched only through its hyphens ("epost" for "e-post") sits between
// the two: it is the row's own name, but reached through a spelling the row
// does not actually use. Every token must appear somewhere, which makes the
// order of the words irrelevant ("mapping pay" finds "Starting a pay
// mapping").
export function matchScore(
  query: string,
  label: string,
  detail?: string
): number {
  const tokens = slugify(query).split("-").filter(Boolean)
  const foldedLabel = fold(label)
  if (tokens.every((token) => foldedLabel.includes(token))) {
    return foldedLabel.startsWith(`-${slugify(query)}`)
      ? PREFIX_MATCH
      : LABEL_MATCH
  }
  const joinedLabel = foldJoined(label)
  if (tokens.every((token) => joinedLabel.includes(token))) return JOINED_MATCH
  const foldedAll = fold(`${label} ${detail ?? ""}`)
  return tokens.every((token) => foldedAll.includes(token)) ? DETAIL_MATCH : 0
}

// The matching rows, best first, capped. An empty query matches everything,
// which is what makes the palette browsable before a single keystroke. Sort
// is stable, so rows of equal score keep their source order (the sidebar's
// order for pages, the guide nav's for docs).
export function filterItems(
  items: readonly PaletteItem[],
  query: string,
  limit: number
): PaletteItem[] {
  return items
    .map((item) => ({
      item,
      score: matchScore(query, item.label, item.detail),
    }))
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((scored) => scored.item)
}
