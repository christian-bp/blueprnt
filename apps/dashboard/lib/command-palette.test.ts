import messages from "@workspace/i18n/messages/en.json"
import { describe, expect, it } from "vitest"
import {
  filterItems,
  guideItems,
  matchScore,
  type PageLabelKey,
  type PaletteItem,
  pageItems,
  sectionItems,
} from "@/lib/command-palette"
import type { DocsIndex } from "@/lib/docs/docs-index"

// The real en labels, resolved the way useTranslations resolves them, so a
// renamed key fails here instead of rendering a raw key in the palette.
const label = (key: PageLabelKey): string => {
  const value = key
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown>)[part],
      messages.dashboard
    )
  if (typeof value !== "string") throw new Error(`no en message for ${key}`)
  return value
}

const INDEX: DocsIndex = [
  {
    slug: "score-and-levels",
    title: "Nivåer",
    description: "Hur poängen blir en nivå.",
    headings: ["Vad är en nivå?", "Nivå kontra senioritet"],
  },
  {
    slug: "what-is-pay-mapping",
    title: "What is pay mapping",
    description: "The statutory survey of pay differences.",
    headings: ["Equal work"],
  },
]

describe("pageItems", () => {
  it("lists every destination, each followed by its section's sub-pages", () => {
    const hrefs = pageItems("admin", label).map((item) => item.href)
    expect(hrefs.slice(0, 5)).toEqual([
      "/",
      "/assistant",
      "/work",
      "/work",
      "/roles",
    ])
    expect(hrefs).toContain("/model/weighting")
    expect(hrefs).toContain("/people/classify")
    expect(hrefs).toContain("/docs")
  })

  it("names a sub-page by its own label with its section as the detail", () => {
    const roles = pageItems("admin", label).find(
      (item) => item.href === "/roles"
    )
    expect(roles?.label).toBe(messages.dashboard.nav.roles)
    expect(roles?.detail).toBe(messages.dashboard.nav.work)
  })

  it("hides the admin destinations and their sub-pages from an editor", () => {
    const editor = pageItems("editor", label).map((item) => item.href)
    expect(editor).not.toContain("/audit-log")
    expect(editor).not.toContain("/organization")
    expect(editor).not.toContain("/organization/members")
    // The same list for an admin has them, so the absence is the role filter
    // and not a registry that lost the pages.
    const admin = pageItems("admin", label).map((item) => item.href)
    expect(admin).toContain("/audit-log")
    expect(admin).toContain("/organization/members")
  })

  it("gives every row a unique key", () => {
    const keys = pageItems("admin", label).map((item) => item.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe("guideItems and sectionItems", () => {
  it("links a guide to its own page", () => {
    expect(guideItems(INDEX)[0]).toMatchObject({
      href: "/docs/score-and-levels",
      label: "Nivåer",
      detail: "Hur poängen blir en nivå.",
    })
  })

  it("links a heading to its anchor on its guide", () => {
    const items = sectionItems(INDEX)
    expect(items.map((item) => item.href)).toEqual([
      "/docs/score-and-levels#vad-ar-en-niva",
      "/docs/score-and-levels#niva-kontra-senioritet",
      "/docs/what-is-pay-mapping#equal-work",
    ])
    expect(items[0]?.detail).toBe("Nivåer")
  })

  it("gives every doc row a unique key", () => {
    const keys = [...guideItems(INDEX), ...sectionItems(INDEX)].map(
      (item) => item.key
    )
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe("matchScore", () => {
  it("ignores diacritics in both directions", () => {
    expect(matchScore("nivaer", "Nivåer")).toBeGreaterThan(0)
    expect(matchScore("Nivåer", "nivaer")).toBeGreaterThan(0)
    expect(matchScore("lonekartlaggning", "Lönekartläggning")).toBeGreaterThan(
      0
    )
    expect(matchScore("mork", "Mørk")).toBeGreaterThan(0)
  })

  it("ranks a name hit above a description hit", () => {
    const inName = matchScore("pay", "Pay mappings")
    const inDetail = matchScore("pay", "Overview", "Your pay mappings")
    expect(inName).toBeGreaterThan(inDetail)
    expect(inDetail).toBeGreaterThan(0)
  })

  it("ranks a name that starts with the query highest", () => {
    expect(matchScore("roles", "Roles")).toBeGreaterThan(
      matchScore("roles", "Importing roles")
    )
  })

  it("does not care about word order", () => {
    expect(matchScore("mapping pay", "Starting a pay mapping")).toBeGreaterThan(
      0
    )
  })

  it("matches nothing on a word that is not there", () => {
    expect(matchScore("payroll", "Roles", "The role register")).toBe(0)
  })

  it("matches everything on an empty query, so the palette opens browsable", () => {
    expect(matchScore("", "Anything")).toBeGreaterThan(0)
    expect(matchScore("   ", "Anything")).toBeGreaterThan(0)
  })

  it("keeps word boundaries, so a token never spans two words", () => {
    expect(matchScore("paymapping", "Pay mapping")).toBe(0)
  })

  // A hyphen inside a word is a spelling the reader cannot see: the sv corpus
  // writes "e-post", "CSV-fil" and "AI-viktgranskningen", and a Nordic user
  // types either half of each. The joined tier scores below a clean word
  // match so it never outranks one.
  it("matches across a hyphen inside a word", () => {
    expect(matchScore("epost", "Ändra din e-post")).toBeGreaterThan(0)
    expect(matchScore("csvfil", "Min CSV-fil avvisades")).toBeGreaterThan(0)
    expect(matchScore("aiforslag", "AI-förslag")).toBeGreaterThan(0)
    // Still below the hyphenated spelling, and the cross-word guard holds.
    expect(matchScore("epost", "Ändra din e-post")).toBeLessThan(
      matchScore("e-post", "Ändra din e-post")
    )
    expect(matchScore("paymapping", "Pay mapping")).toBe(0)
  })
})

describe("filterItems", () => {
  const items: PaletteItem[] = [
    { key: "a", href: "/a", label: "Roles", icon: [] },
    { key: "b", href: "/b", label: "Importing roles", icon: [] },
    { key: "c", href: "/c", label: "People", icon: [], detail: "Roles here" },
    { key: "d", href: "/d", label: "Model", icon: [] },
  ]

  it("drops the misses and puts the best match first", () => {
    expect(filterItems(items, "roles", 10).map((item) => item.key)).toEqual([
      "a",
      "b",
      "c",
    ])
  })

  it("caps the list at the limit", () => {
    expect(filterItems(items, "", 2).map((item) => item.key)).toEqual([
      "a",
      "b",
    ])
  })

  // Ranking must happen BEFORE the cap. With an empty query every row scores
  // the same, so the two orders are indistinguishable there: this fixture
  // puts the only strong match last in source order, where a cap applied
  // first would throw it away and keep two weaker rows.
  it("ranks before it caps, so the best match survives a full list", () => {
    const buried: PaletteItem[] = [
      { key: "x", href: "/x", label: "People", icon: [], detail: "Roles here" },
      { key: "y", href: "/y", label: "Model", icon: [], detail: "Roles too" },
      { key: "z", href: "/z", label: "Roles", icon: [] },
    ]
    expect(filterItems(buried, "roles", 1).map((item) => item.key)).toEqual([
      "z",
    ])
  })

  it("keeps source order between rows that score the same", () => {
    expect(filterItems(items, "", 10).map((item) => item.key)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ])
  })
})
