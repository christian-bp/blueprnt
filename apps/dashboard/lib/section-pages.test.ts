import { describe, expect, it } from "vitest"
import { deepestMatch, SECTION_PAGES } from "@/lib/section-pages"

const WORK = SECTION_PAGES.work.map((page) => page.href)
const PEOPLE = SECTION_PAGES.people.map((page) => page.href)

describe("deepestMatch", () => {
  it("resolves the section index on the index path", () => {
    expect(deepestMatch(PEOPLE, "/people")).toBe("/people")
  })

  it("hands the index over to a deeper matching sibling", () => {
    expect(deepestMatch(PEOPLE, "/people/classify")).toBe("/people/classify")
  })

  it("keeps a register current on its detail pages", () => {
    expect(deepestMatch(PEOPLE, "/people/abc123")).toBe("/people")
    expect(deepestMatch(PEOPLE, "/people/classify")).toBe("/people/classify")
  })

  it("matches whole path segments, not string prefixes", () => {
    expect(deepestMatch(WORK, "/workspace")).toBeUndefined()
  })

  it("returns undefined outside the section", () => {
    expect(deepestMatch(PEOPLE, "/work")).toBeUndefined()
  })
})

// The model section's four chapters are a guided journey with their own
// in-page tab row, so they are deliberately NOT section pages: listing them
// here would put the same four destinations in the header strip and the
// sidebar sub-menu as well as under the spine that already draws them.
describe("the guided sections", () => {
  it("keeps the model section out of the header/sidebar sub-page registry", () => {
    expect(Object.keys(SECTION_PAGES)).not.toContain("model")
    for (const pages of Object.values(SECTION_PAGES)) {
      for (const page of pages) {
        expect(page.href.startsWith("/model")).toBe(false)
        expect(page.href.startsWith("/pay-mappings")).toBe(false)
      }
    }
  })
})

describe("SECTION_PAGES", () => {
  it("keeps every section's destinations unique", () => {
    for (const pages of Object.values(SECTION_PAGES)) {
      const hrefs = pages.map((page) => page.href)
      expect(new Set(hrefs).size).toBe(hrefs.length)
      expect(new Set(pages.map((page) => page.labelKey)).size).toBe(
        pages.length
      )
    }
  })

  it("resolves exactly one current page per section path", () => {
    // Every page must win the deepest-match on its own href, so no two
    // pages in a list may shadow each other exactly.
    for (const pages of Object.values(SECTION_PAGES)) {
      const hrefs = pages.map((page) => page.href)
      for (const href of hrefs) {
        expect(deepestMatch(hrefs, href)).toBe(href)
      }
    }
  })
})
