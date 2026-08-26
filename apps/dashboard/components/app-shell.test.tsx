import { readFileSync } from "node:fs"
import { join } from "node:path"
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

  // ONE cap for every routed page: the model and the pay-mapping runs
  // briefly carried a wider tier of their own, which made moving between
  // areas read as the page changing size. Pinned across the routes that used
  // to differ, so the tier cannot creep back one route at a time.
  it("holds every routed page to the same cap", () => {
    for (const path of [
      "/people",
      "/pay-mappings",
      "/pay-mappings/run-2026/analysis",
      "/model/weighting",
      "/model/criteria",
      "/roles",
    ]) {
      const classes = pageContentClasses(path)
      expect(classes, path).toContain("max-w-7xl")
      expect(classes, path).not.toContain("85rem")
      expect(classes, path).toContain("mx-auto")
      expect(classes, path).toContain("p-4")
    }
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

// THE CONTENT PANE'S WIDTH FLOOR.
//
// The pane is a flex item in a row (nav | content). Without min-w-0 its
// automatic minimum size is its MIN-CONTENT width, so one wide table
// anywhere below pushes the pane wider than the space it was given, and
// every centered column inside it (mx-auto) slides sideways by half the
// excess. That is what the /work families grid did: mounting its 12-level
// table grew the pane by 96px and moved the page's breadcrumbs 48px right,
// on a tab switch, permanently.
//
// This is pinned on the SHELL because nothing on the page could catch it.
// The page's own cross-tab pin compares the chrome container's class string,
// which never varied and never was the problem: the width came from an
// ANCESTOR outside the page, and jsdom measures no boxes, so no rendered
// assertion anywhere could have seen it. The class is the only artifact of
// the fix that a test can hold.
describe("the shell's content pane", () => {
  const source = readFileSync(join(__dirname, "app-shell.tsx"), "utf8")

  it("floors its width at zero so content can never widen it", () => {
    const pane = source.match(/className="relative flex[^"]*flex-col"/)?.[0]
    expect(pane).toBeDefined()
    expect(pane).toContain("min-w-0")
    expect(pane).toContain("flex-1")
  })

  // The scroll pane inside it must not become the page's sideways scroller
  // either: wide content scrolls in its own container (the table law).
  it("keeps the scroll pane on the vertical axis", () => {
    expect(source).toContain('data-slot="app-scroll"')
    expect(source).toContain("overflow-y-auto")
    expect(source).not.toContain("overflow-x-auto")
  })
})
