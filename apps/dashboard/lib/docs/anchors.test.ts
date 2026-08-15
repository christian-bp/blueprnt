import { describe, expect, it } from "vitest"
import { headingAnchor, headingTexts } from "./anchors"

describe("headingAnchor", () => {
  it("slugifies a heading the way the renderer writes its id", () => {
    expect(headingAnchor("Equal work")).toBe("equal-work")
  })

  // Nordic diacritics fold rather than transliterate, which is what makes a
  // per-page collision possible; guard 10 in docs-guards.test.ts is what
  // keeps two headings on one page from landing on the same anchor.
  it("folds Nordic diacritics", () => {
    expect(headingAnchor("Åtgärder")).toBe("atgarder")
    expect(headingAnchor("Nivåer och steg")).toBe("nivaer-och-steg")
  })
})

describe("headingTexts", () => {
  it("takes levels 2 to 4, which are the ones the renderer gives an id", () => {
    const body = ["# Title", "## Two", "### Three", "#### Four", "##### Five"]
    expect(headingTexts(body.join("\n"))).toEqual(["Two", "Three", "Four"])
  })

  // A "## ..." line inside a fenced block is prose: the renderer gives it no
  // id, so counting it would offer a palette section whose deep link lands
  // silently at the top of the page.
  it("ignores a heading inside a fenced code block", () => {
    const body = [
      "## Real heading",
      "",
      "```md",
      "## Not a heading",
      "```",
      "",
      "## Another real one",
    ]
    expect(headingTexts(body.join("\n"))).toEqual([
      "Real heading",
      "Another real one",
    ])
  })

  it("handles a tilde fence and an indented one", () => {
    const body = [
      "## Kept",
      "~~~ts",
      "## Hidden",
      "~~~",
      "  ```",
      "## Also hidden",
      "  ```",
      "## Kept too",
    ]
    expect(headingTexts(body.join("\n"))).toEqual(["Kept", "Kept too"])
  })

  it("does not swallow the rest of the page on an unclosed fence", () => {
    // An unclosed fence is a corpus defect, but it must not silently drop
    // every later heading from the index without anything noticing.
    const body = ["## Before", "```", "## Inside"]
    expect(headingTexts(body.join("\n"))).toEqual(["Before"])
  })
})
