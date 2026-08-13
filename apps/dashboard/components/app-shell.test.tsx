import { describe, expect, it } from "vitest"
import {
  PAGE_MAX_W,
  PAGE_WIDE_MAX_W,
  shellLayoutClasses,
} from "@/components/app-shell"

// A page wrapper that only carries min-h-* (a floor, never a ceiling) can
// grow past the viewport once its content outgrows it: the flex chain never
// gets pressure to shrink, so an inner overflow-y-auto region (e.g.
// MessageScrollerViewport) never becomes the scroll container and content
// below it (the assistant composer) is pushed out of reach. These
// assertions guard the route-to-class mapping that fixed that: /assistant's
// SidebarInset must carry a real height (not a floor) with overflow-hidden,
// and every layer below it must carry min-h-0 so it can actually shrink.
function classList(classes: string) {
  return classes.split(/\s+/).filter(Boolean)
}

describe("shellLayoutClasses", () => {
  it("locks /assistant's height at every breakpoint and keeps the normal reading width", () => {
    const layout = shellLayoutClasses("/assistant")
    const inset = classList(layout.sidebarInset)
    expect(inset).toContain("h-svh")
    expect(inset).toContain("overflow-hidden")
    expect(inset).toContain("md:h-[calc(100svh_-_1rem)]")
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
  })

  it("keeps /work full-bleed and height-locked only from md up", () => {
    const layout = shellLayoutClasses("/work")
    const inset = classList(layout.sidebarInset)
    expect(inset).toContain("md:h-[calc(100svh_-_1rem)]")
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
    // The capped column centers on screens wider than its cap; without
    // mx-auto it hugs the left edge and a wide monitor shows a page-wide
    // blank right half.
    expect(content).toContain("mx-auto")
  })

  it("applies the wide cap inside a pay-mapping run, unbounded in height", () => {
    const layout = shellLayoutClasses("/pay-mappings/pay-2026/analysis")
    expect(layout.sidebarInset).toBe("")
    const content = classList(layout.pageContent)
    expect(content).toContain(PAGE_WIDE_MAX_W)
    expect(content).not.toContain(PAGE_MAX_W)
    expect(content).not.toContain("min-h-0")
  })
})
