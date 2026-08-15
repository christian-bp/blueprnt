import { routing } from "@workspace/i18n/routing"
import { describe, expect, it } from "vitest"
import { headingAnchor, headingTexts } from "./anchors"
import { getDocsIndex } from "./docs-index"
import { allDocSlugs } from "./docs-nav"

describe("headingTexts", () => {
  it("takes the levels the renderer gives an id to, and no others", () => {
    const body = [
      "Intro text.",
      "## Second level",
      "### Third level",
      "#### Fourth level",
      "##### Fifth level",
      "# Not written in a body",
      "Text with a # inside it.",
    ].join("\n")
    expect(headingTexts(body)).toEqual([
      "Second level",
      "Third level",
      "Fourth level",
    ])
  })
})

describe("getDocsIndex", () => {
  it("carries every guide of the locale, with its title and description", async () => {
    const index = await getDocsIndex("en")
    expect(index.map((entry) => entry.slug)).toEqual(allDocSlugs())
    for (const entry of index) {
      expect(entry.title.length, entry.slug).toBeGreaterThan(0)
      expect(entry.description.length, entry.slug).toBeGreaterThan(0)
    }
  })

  it("is localized: every locale builds, in its own language", async () => {
    const titles = await Promise.all(
      routing.locales.map(async (locale) => {
        const index = await getDocsIndex(locale)
        expect(index.length, locale).toBe(allDocSlugs().length)
        return index[0]?.title
      })
    )
    // The introduction is titled differently in at least one locale, so a
    // build that silently served en for everyone would fail here.
    expect(new Set(titles).size).toBeGreaterThan(1)
  })

  it("carries headings whose anchors are unique within a guide", async () => {
    const index = await getDocsIndex("en")
    const withHeadings = index.filter((entry) => entry.headings.length > 0)
    expect(withHeadings.length).toBeGreaterThan(0)
    for (const entry of index) {
      const anchors = entry.headings.map(headingAnchor)
      // The palette keys a row by its anchor, so a collision inside one guide
      // would make two rows the same row.
      expect(new Set(anchors).size, entry.slug).toBe(anchors.length)
    }
  })

  it("builds a locale once and reuses it", async () => {
    expect(await getDocsIndex("en")).toBe(await getDocsIndex("en"))
  })
})
