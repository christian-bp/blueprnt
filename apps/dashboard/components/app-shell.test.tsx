import { describe, expect, it } from "vitest"
import {
  PAGE_MAX_W,
  PAGE_WIDE_MAX_W,
  shellLayoutClasses,
} from "@/components/app-shell"

// A page wrapper that only carries min-h-* (a floor, never a ceiling) can
// grow past the viewport once its content outgrows it: the flex chain never
// gets pressure to shrink, so an inner overflow-y-auto region (e.g. the
// conversation's own scroll container) never becomes the scroll container
// and content below it (the assistant composer) is pushed out of reach.
// These assertions guard the route-to-class mapping that fixed that:
// /assistant's SidebarInset must carry a real height (not a floor) with
// overflow-hidden, and every layer below it must carry min-h-0 so it can
// actually shrink.
function classList(classes: string) {
  return classes.split(/\s+/).filter(Boolean)
}

describe("shellLayoutClasses", () => {
  it("locks /assistant's height at every breakpoint and keeps the normal reading width", () => {
    const layout = shellLayoutClasses("/assistant")
    const inset = classList(layout.sidebarInset)
    expect(inset).toContain("h-svh")
    expect(inset).toContain("overflow-hidden")
    // The lock is a plain viewport height at every breakpoint: the content
    // pane carries no margin of its own to subtract.
    expect(inset.some((c) => c.includes("calc("))).toBe(false)
    // Never a min-h-* floor: a floor is exactly the bug (the flex column
    // grows past the viewport once content outgrows it).
    expect(inset.some((c) => c.startsWith("min-h-"))).toBe(false)

    expect(classList(layout.flexShell)).toContain("min-h-0")
    expect(classList(layout.containerMain)).toContain("min-h-0")
    const content = classList(layout.pageContent)
    expect(content).toContain("min-h-0")
    expect(content).toContain("flex-1")
    // Uncapped like /work: the conversations panel must reach the sidebar
    // border, which a centered width cap would hold away from it. The page
    // centers its own reading column beside the panel instead.
    expect(content).not.toContain(PAGE_MAX_W)
    expect(content).not.toContain(PAGE_WIDE_MAX_W)
    // Unpadded for the same reason, in the other axis: the panel fills the
    // locked height flush, top to bottom, and the chat column beside it
    // carries PAGE_PADDING itself (assistant/page.tsx).
    expect(content).not.toContain("px-4")
    expect(content).not.toContain("md:py-6")
  })

  it("keeps /work full-bleed and height-locked only from md up", () => {
    const layout = shellLayoutClasses("/work")
    const inset = classList(layout.sidebarInset)
    expect(inset).toContain("md:h-svh")
    expect(inset).toContain("md:overflow-hidden")
    // /work's own lock is md:-gated; it must not gain the assistant's
    // always-on h-svh (that would change its established mobile behavior).
    expect(inset).not.toContain("h-svh")
    expect(inset).not.toContain("overflow-hidden")

    const content = classList(layout.pageContent)
    expect(content).toContain("min-h-0")
    expect(content).toContain("flex-1")
    expect(content).not.toContain(PAGE_MAX_W)
    expect(content).not.toContain(PAGE_WIDE_MAX_W)
  })

  it("leaves an ordinary route unbounded, at the normal reading width, with no min-h-0", () => {
    const layout = shellLayoutClasses("/roles")
    expect(layout.sidebarInset).toBe("")
    expect(classList(layout.flexShell)).not.toContain("min-h-0")
    expect(classList(layout.containerMain)).not.toContain("min-h-0")
    const content = classList(layout.pageContent)
    expect(content).not.toContain("min-h-0")
    expect(content).not.toContain("flex-1")
    expect(content).toContain(PAGE_MAX_W)
    // The shell still owns the page inset everywhere except the two
    // inner-sidebar routes; dropping it for everyone would unpad the app.
    expect(content).toContain("px-4")
    expect(content).toContain("py-4")
    expect(content).toContain("lg:px-6")
    expect(content).toContain("md:py-6")
    // Screen-centering is per-page opt-in: an ordinary route keeps the
    // left-aligned column until it deliberately opts in.
    expect(content).not.toContain("mx-auto")
  })

  it("centers only the overview's capped column", () => {
    const overview = classList(shellLayoutClasses("/").pageContent)
    expect(overview).toContain("mx-auto")
    expect(overview).toContain(PAGE_MAX_W)
  })

  // The model section's chapters divide their width into four dimension
  // columns, so a cap costs them directly. Uncapped but otherwise an ORDINARY
  // page: normal flow, the shell's own padding, one left edge shared with
  // every other page, and no height lock.
  it("uncaps the model section while it keeps the shell's padding and flow", () => {
    for (const path of [
      "/model",
      "/model/criteria",
      "/model/weighting",
      "/model/method",
      "/model/approval",
    ]) {
      const layout = shellLayoutClasses(path)
      const content = classList(layout.pageContent)
      expect(content, path).not.toContain(PAGE_MAX_W)
      expect(content, path).not.toContain(PAGE_WIDE_MAX_W)
      // Padded like an ordinary page: the section starts at the same left
      // edge every other page does.
      expect(content, path).toContain("px-4")
      expect(content, path).toContain("lg:px-6")
      expect(content, path).toContain("py-4")
      // Not centered and not height-locked: it is a normal scrolling page.
      expect(content, path).not.toContain("mx-auto")
      expect(content, path).not.toContain("min-h-0")
      expect(layout.sidebarInset, path).toBe("")
    }
  })

  // Segment-matched, never a bare prefix: a future sibling route beginning
  // with the same characters must keep the ordinary cap.
  it("keeps the cap on a route that merely starts like the model section", () => {
    const content = classList(shellLayoutClasses("/modelling").pageContent)
    expect(content).toContain(PAGE_MAX_W)
  })

  it("applies the wide cap inside a pay-mapping run, unbounded in height", () => {
    const layout = shellLayoutClasses("/pay-mappings/pay-2026/analysis")
    expect(layout.sidebarInset).toBe("")
    const content = classList(layout.pageContent)
    expect(content).toContain(PAGE_WIDE_MAX_W)
    expect(content).not.toContain(PAGE_MAX_W)
    expect(content).not.toContain("min-h-0")
  })

  // The docs nav is an inner sidebar like the assistant's conversations
  // panel, so /docs drops the centred cap that would otherwise hold it away
  // from the boundary with the app sidebar. Unlike /assistant it is NOT
  // height-locked: the page keeps scrolling, and the nav pins itself. A lock
  // here would silently break DocsHashScroll, which reads window.scrollY.
  it("uncaps the docs routes without locking their height", () => {
    for (const path of [
      "/docs",
      "/docs/introduction",
      "/docs/what-is-pay-mapping",
    ]) {
      const layout = shellLayoutClasses(path)
      const content = classList(layout.pageContent)
      expect(content).not.toContain(PAGE_MAX_W)
      expect(content).not.toContain(PAGE_WIDE_MAX_W)
      // Unpadded as well as uncapped, unlike every other route: the nav
      // column has to reach the app sidebar's border and run the pane's full
      // height, so the shell adds no gutter above or beside it. The article
      // column carries PAGE_PADDING itself (docs-nav.tsx).
      expect(content).not.toContain("px-4")
      expect(content).not.toContain("py-4")
      expect(content).not.toContain("lg:px-6")
      expect(content).not.toContain("md:py-6")
      // No lock, and nothing below it may gain min-h-0: position:sticky
      // fails silently under an ancestor that clips.
      expect(layout.sidebarInset).toBe("")
      expect(content).not.toContain("min-h-0")
      expect(content).not.toContain("flex-1")
      expect(classList(layout.flexShell)).not.toContain("min-h-0")
      expect(classList(layout.containerMain)).not.toContain("min-h-0")
    }
  })

  // A bare startsWith("/docs") would swallow any future sibling route
  // beginning with those characters and silently uncap it.
  it("matches /docs as a segment, not as a prefix", () => {
    expect(
      classList(shellLayoutClasses("/docsomething").pageContent)
    ).toContain(PAGE_MAX_W)
  })
})
