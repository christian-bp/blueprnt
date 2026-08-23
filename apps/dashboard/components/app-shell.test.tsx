import { describe, expect, it } from "vitest"
import { PAGE_CONTENT_MAX_W, pageContentClasses } from "@/components/app-shell"

// The shell's per-route layout decisions, tested as the pure class function
// (rendering the whole authenticated shell would drag in the rail's queries
// and auth just to read a class off a div).
describe("pageContentClasses", () => {
  it("caps and centers an ordinary page", () => {
    const classes = pageContentClasses("/people")
    expect(classes).toContain("max-w-7xl")
    expect(classes).toContain("mx-auto")
    expect(classes).toContain("p-4")
  })

  it("gives one run's workspace the wide cap", () => {
    const classes = pageContentClasses("/pay-mappings/run-2026/analysis")
    expect(classes).toContain("max-w-[85rem]")
    expect(classes).not.toContain("max-w-7xl")
  })

  it("keeps the pay-mappings LIST at the ordinary cap", () => {
    expect(pageContentClasses("/pay-mappings")).toContain("max-w-7xl")
  })

  it("gives the model section the wide cap, centered like every page", () => {
    const classes = pageContentClasses("/model/weighting")
    expect(classes).toContain("max-w-[85rem]")
    expect(classes).toContain("mx-auto")
    expect(classes).toContain("p-4")
  })

  it("hands the self-managed routes their whole pane", () => {
    for (const path of ["/work", "/assistant", "/docs", "/docs/some-guide"]) {
      const classes = pageContentClasses(path)
      expect(classes, path).toContain("h-full")
      expect(classes, path).not.toContain("p-4")
      expect(classes, path).not.toMatch(/max-w-/)
    }
  })

  it("does not swallow sibling routes that share a prefix", () => {
    expect(pageContentClasses("/workspace")).toContain("max-w-7xl")
  })

  it("aligns /work's content column with a capped page's visible width", () => {
    // max-w-7xl is 80rem and the page padding is 1rem per side; the constant
    // must stay exactly the difference or /work's sections drift off the
    // shared left edge.
    expect(PAGE_CONTENT_MAX_W).toContain("max-w-[calc(80rem-2rem)]")
    expect(PAGE_CONTENT_MAX_W).toContain("mx-auto")
  })
})
