import { describe, expect, it } from "vitest"
import { deepestMatch, SECTION_PAGES } from "@/lib/section-pages"

const MODEL = SECTION_PAGES.model.map((page) => page.href)
const PEOPLE = SECTION_PAGES.people.map((page) => page.href)

describe("deepestMatch", () => {
  it("resolves the section index on the index path", () => {
    expect(deepestMatch(MODEL, "/model")).toBe("/model")
  })

  it("hands the index over to a deeper matching sibling", () => {
    expect(deepestMatch(MODEL, "/model/weighting")).toBe("/model/weighting")
    expect(deepestMatch(MODEL, "/model/method")).toBe("/model/method")
  })

  it("keeps a register current on its detail pages", () => {
    expect(deepestMatch(PEOPLE, "/people/abc123")).toBe("/people")
    expect(deepestMatch(PEOPLE, "/people/classify")).toBe("/people/classify")
  })

  it("matches whole path segments, not string prefixes", () => {
    expect(deepestMatch(MODEL, "/modelling")).toBeUndefined()
  })

  it("returns undefined outside the section", () => {
    expect(deepestMatch(MODEL, "/people")).toBeUndefined()
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
