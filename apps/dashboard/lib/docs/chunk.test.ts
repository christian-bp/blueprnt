import { describe, expect, it } from "vitest"
import { headingAnchor } from "./anchors"
import { chunkDocPage } from "./chunk"

const frontmatter = {
  title: "Weighting",
  description: "d",
  section: "model",
}

describe("chunkDocPage", () => {
  it("emits an intro chunk and one chunk per H2, anchors matching the renderer", () => {
    const body = [
      "Intro paragraph.",
      "",
      "## Point budget",
      "The budget is criteria count x 3.",
      "",
      "### Sub detail",
      "Folded into the parent chunk.",
      "",
      "## Saving",
      "Save posts atomically.",
    ].join("\n")
    const chunks = chunkDocPage({ body, frontmatter })
    expect(chunks.map((c) => c.heading)).toEqual([
      null,
      "Point budget",
      "Saving",
    ])
    expect(chunks[1]?.anchor).toBe(headingAnchor("Point budget"))
    expect(chunks[1]?.text).toContain("criteria count x 3")
    expect(chunks[1]?.text).toContain("Folded into the parent chunk.")
    for (const c of chunks) {
      expect(c.pageTitle).toBe("Weighting")
    }
  })

  it("strips markdown syntax to plain text but keeps link text", () => {
    const body =
      "## A\nSee [the roles page](/roles) and use `Add role` with **care**."
    const [chunk] = chunkDocPage({ body, frontmatter })
    expect(chunk?.text).toContain("the roles page")
    expect(chunk?.text).toContain("Add role")
    expect(chunk?.text).not.toMatch(/[[\]()*`]/)
  })

  it("skips an empty intro and splits sections longer than 2000 chars at a paragraph boundary", () => {
    const long = Array.from(
      { length: 30 },
      (_, i) => `Paragraph ${i} ${"x".repeat(80)}.`
    ).join("\n\n")
    const chunks = chunkDocPage({ body: `## Long\n${long}`, frontmatter })
    expect(chunks[0]?.heading).toBe("Long")
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(c.text.length).toBeLessThanOrEqual(2000)
      expect(c.heading).toBe("Long")
      expect(c.anchor).toBe(headingAnchor("Long"))
    }
  })

  it("strips list markers from Related sections", () => {
    const body = [
      "## Related",
      "",
      "- Model overview",
      "- Evaluating a role",
      "- How to draft",
      "",
      "* Alternative bullet",
      "+ Plus style",
      "1. Ordered first",
      "2. Ordered second",
    ].join("\n")
    const chunks = chunkDocPage({ body, frontmatter })
    const relatedChunk = chunks.find((c) => c.heading === "Related")
    expect(relatedChunk).toBeDefined()
    expect(relatedChunk?.text).toContain("Model overview")
    expect(relatedChunk?.text).toContain("Evaluating a role")
    expect(relatedChunk?.text).toContain("Alternative bullet")
    expect(relatedChunk?.text).not.toMatch(/^[\s-*+]|^[\s\d]+\./m)
  })

  it("strips blockquote markers", () => {
    const body = [
      "## Note",
      "> This is a blockquote",
      "> spanning multiple lines",
      "",
      "Normal text after.",
    ].join("\n")
    const chunks = chunkDocPage({ body, frontmatter })
    const chunk = chunks.find((c) => c.heading === "Note")
    expect(chunk?.text).toContain("This is a blockquote")
    expect(chunk?.text).toContain("spanning multiple lines")
    expect(chunk?.text).toContain("Normal text after")
    expect(chunk?.text).not.toMatch(/^[>]|[>]\s/m)
  })

  it("strips GFM table separators including standard form with spaces", () => {
    const body = [
      "## Table",
      "",
      "| Header 1 | Header 2 |",
      "| --- | --- |",
      "| Cell 1 | Cell 2 |",
      "| Cell 3 | Cell 4 |",
    ].join("\n")
    const chunks = chunkDocPage({ body, frontmatter })
    const chunk = chunks.find((c) => c.heading === "Table")
    expect(chunk?.text).toContain("Header 1")
    expect(chunk?.text).toContain("Header 2")
    expect(chunk?.text).toContain("Cell 1")
    expect(chunk?.text).toContain("Cell 2")
    expect(chunk?.text).not.toMatch(/[|-]/)
  })

  it("splits a single paragraph longer than 2000 chars at word boundaries", () => {
    const longWord = "word ".repeat(500)
    const body = `## Section\n${longWord}`
    const chunks = chunkDocPage({ body, frontmatter })
    expect(chunks[0]?.heading).toBe("Section")
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(c.text.length).toBeLessThanOrEqual(2000)
    }
  })

  it("preserves single-dash data rows and only removes 3+ dash separators", () => {
    const body = [
      "## Data",
      "",
      "| Name | Status |",
      "| --- | --- |",
      "| Alice | - |",
      "| Bob | - |",
    ].join("\n")
    const chunks = chunkDocPage({ body, frontmatter })
    const chunk = chunks.find((c) => c.heading === "Data")
    expect(chunk?.text).toContain("Alice")
    expect(chunk?.text).toContain("Bob")
    expect(chunk?.text).toContain("Name")
    expect(chunk?.text).toContain("Status")
    expect(chunk?.text).toContain("-")
  })

  it("removes alignment-colon separators (:--- and ---:)", () => {
    const body = [
      "## Aligned",
      "",
      "| Left | Center | Right |",
      "| :--- | :---: | ---: |",
      "| A | B | C |",
    ].join("\n")
    const chunks = chunkDocPage({ body, frontmatter })
    const chunk = chunks.find((c) => c.heading === "Aligned")
    expect(chunk?.text).toContain("Left")
    expect(chunk?.text).toContain("Center")
    expect(chunk?.text).toContain("Right")
    expect(chunk?.text).toContain("A")
    expect(chunk?.text).toContain("B")
    expect(chunk?.text).toContain("C")
    expect(chunk?.text).not.toMatch(/:[---]|[---]:/)
  })

  it("skips a section that is nothing but a list of links (a Related footer)", () => {
    const body = [
      "Intro paragraph.",
      "",
      "## Related",
      "",
      "- [What is a pay mapping](/docs/what-is-pay-mapping)",
      "- [Run lifecycle and statuses](/docs/run-lifecycle)",
      "- [Equal work](/docs/equal-work)",
    ].join("\n")
    const chunks = chunkDocPage({ body, frontmatter })
    expect(chunks.some((c) => c.heading === "Related")).toBe(false)
    expect(chunks.map((c) => c.heading)).toEqual([null])
  })

  it("keeps a list section when an item mixes a link with prose", () => {
    const body = [
      "## Related",
      "",
      "- See [Run lifecycle and statuses](/docs/run-lifecycle) for details.",
      "- [Equal work](/docs/equal-work)",
    ].join("\n")
    const chunks = chunkDocPage({ body, frontmatter })
    const related = chunks.find((c) => c.heading === "Related")
    expect(related).toBeDefined()
    expect(related?.text).toContain("Run lifecycle and statuses")
    expect(related?.text).toContain("for details")
    expect(related?.text).toContain("Equal work")
  })

  it("keeps a bullet list of plain, link-free text items", () => {
    const body = [
      "## See also",
      "",
      "- Model overview",
      "- Evaluating a role",
    ].join("\n")
    const chunks = chunkDocPage({ body, frontmatter })
    const seeAlso = chunks.find((c) => c.heading === "See also")
    expect(seeAlso).toBeDefined()
    expect(seeAlso?.text).toContain("Model overview")
    expect(seeAlso?.text).toContain("Evaluating a role")
  })

  it("keeps the page's other sections unaffected and order sequential with no gaps after a skip", () => {
    const body = [
      "Intro paragraph.",
      "",
      "## Point budget",
      "The budget is criteria count x 3.",
      "",
      "## Related",
      "",
      "- [A](/docs/a)",
      "- [B](/docs/b)",
      "",
      "## Saving",
      "Save posts atomically.",
    ].join("\n")
    const chunks = chunkDocPage({ body, frontmatter })
    expect(chunks.map((c) => c.heading)).toEqual([
      null,
      "Point budget",
      "Saving",
    ])
  })

  it("preserves prose starting with dashes without eating the words", () => {
    const body = [
      "## Rules",
      "",
      "-- Main rule: always check first",
      "--- Sub rule: verify the source",
    ].join("\n")
    const chunks = chunkDocPage({ body, frontmatter })
    const chunk = chunks.find((c) => c.heading === "Rules")
    expect(chunk?.text).toContain("Main rule")
    expect(chunk?.text).toContain("always check first")
    expect(chunk?.text).toContain("Sub rule")
    expect(chunk?.text).toContain("verify the source")
  })
})
