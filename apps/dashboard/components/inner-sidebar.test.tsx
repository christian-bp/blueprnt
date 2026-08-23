import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { InnerSidebarHandle } from "@/components/inner-sidebar-handle"
import { InnerSidebar } from "@/components/inner-sidebar"

afterEach(cleanup)

function renderSidebar(open: boolean, extra?: { width?: number }) {
  return render(
    <InnerSidebar open={open} label="Guide navigation" width={extra?.width}>
      <p>tree</p>
    </InnerSidebar>
  )
}

// The labeled landmark is the OUTER aside (Verve semantics); the inner box
// (border, fixed width) is its content child, reached structurally.
function innerBox(): HTMLElement {
  const aside = screen.getByRole("complementary", { name: "Guide navigation" })
  return aside.firstElementChild as HTMLElement
}

describe("InnerSidebar", () => {
  it("is an aside landmark and renders its content while open", () => {
    renderSidebar(true)
    expect(
      screen.getByRole("complementary", { name: "Guide navigation" })
    ).toBeTruthy()
    expect(screen.getByText("tree")).toBeTruthy()
  })

  it("keeps the content mounted but inert while collapsed", () => {
    renderSidebar(false)
    // The collapse is a width slide that clips the content (the seam line
    // sweeps across it), so the content stays mounted at full opacity; inert
    // is what keeps a collapsed sidebar's links out of the tab order and the
    // accessibility tree.
    expect(screen.getByText("tree")).toBeTruthy()
    expect(innerBox().hasAttribute("inert")).toBe(true)
  })

  it("lifts inert while open", () => {
    renderSidebar(true)
    expect(innerBox().hasAttribute("inert")).toBe(false)
  })

  it("draws the seam line on the clip edge, never as a border on either box", () => {
    const { container } = renderSidebar(true)
    const outer = container.firstElementChild as HTMLElement
    const inner = innerBox()

    // Anchored at a class boundary so `px-2`/`py-2`/`pt-2` are caught too: a
    // plain substring check for "p-" misses every directional padding class,
    // which is the form a future edit is most likely to add.
    expect(outer.className).not.toMatch(/(^|\s)border/)
    expect(outer.className).not.toMatch(/(^|\s)p[xytrbl]?-/)
    // A border on the fixed-width content column would sit at the far edge
    // and be clipped away the moment the slide starts; the line must ride
    // the OUTER box's animated right edge to sweep across the content.
    expect(inner.className).not.toContain("border-r")
    const seam = outer.lastElementChild as HTMLElement
    for (const cls of [
      "absolute",
      "inset-y-0",
      "right-0",
      "w-px",
      "bg-border",
    ]) {
      expect(seam.className).toContain(cls)
    }
    // The column starts flush at the site header's bottom border, so the top
    // inset is the only thing keeping the first control off that border.
    expect(inner.className).toContain("pt-2")
  })

  it("sizes the inner box from the width prop so text never rewraps mid-slide", () => {
    renderSidebar(true, { width: 280 })
    const inner = innerBox()
    expect(inner.style.width).toBe("280px")
  })

  it("takes its height from the parent by default and pins itself when sticky", () => {
    const { container: filled } = renderSidebar(true)
    expect((filled.firstElementChild as HTMLElement).className).toContain(
      "min-h-0"
    )

    const { container: stuck } = render(
      <InnerSidebar open height="sticky" label="Guide navigation">
        <p>tree</p>
      </InnerSidebar>
    )
    const outer = (stuck.firstElementChild as HTMLElement).className
    expect(outer).toContain("sticky")
    expect(outer).toContain("top-0")
    expect(outer).toContain("self-start")
  })

  // The docs surface hides the whole column below lg through this prop, so it
  // has to reach the animated outer element (the one that occupies the row),
  // not the inner nav.
  it("passes a caller class through to the outer element", () => {
    const { container } = render(
      <InnerSidebar open label="Guide navigation" className="hidden lg:flex">
        <p>tree</p>
      </InnerSidebar>
    )
    const outer = container.firstElementChild as HTMLElement
    expect(outer.className).toContain("hidden")
    expect(outer.className).toContain("lg:flex")
  })

  it("renders no header row when there is nothing to put in it", () => {
    renderSidebar(true)
    const inner = innerBox()
    // Content starts at the top of the column: exactly one child, the
    // scrollable content box.
    expect(inner.children).toHaveLength(1)
  })

  it("renders the actions row when the surface provides one", () => {
    render(
      <InnerSidebar
        open
        label="Guide navigation"
        actions={<button type="button">New</button>}
      >
        <p>tree</p>
      </InnerSidebar>
    )
    expect(screen.getByRole("button", { name: "New" })).toBeTruthy()
  })

  it("pins the footer slot under the scrolling content, with no box styles of its own", () => {
    render(
      <InnerSidebar open label="Guide navigation" footer={<p>stats</p>}>
        <p>tree</p>
      </InnerSidebar>
    )
    const inner = innerBox()
    // [scroll content, footer]: the footer is the column's last child, so it
    // stays pinned while the content above it scrolls.
    expect(inner.children).toHaveLength(2)
    const footer = inner.lastElementChild as HTMLElement
    expect(footer.className).toContain("shrink-0")
    // The border belongs to each block inside (SidebarFooterBlock), never to
    // the slot: a bordered slot would draw an empty strip whenever every
    // block has nothing to say.
    expect(footer.className).not.toMatch(/(^|\s)border/)
    expect(footer.className).not.toMatch(/(^|\s)p[xytrbl]?-/)
    expect(screen.getByText("stats")).toBeTruthy()
  })

  it("keeps the footer inside the inert column while collapsed", () => {
    render(
      <InnerSidebar open={false} label="Guide navigation" footer={<p>stats</p>}>
        <p>tree</p>
      </InnerSidebar>
    )
    expect(screen.getByText("stats").closest("[inert]")).not.toBeNull()
  })
})

describe("InnerSidebarHandle", () => {
  function renderHandle(open: boolean, onToggle = vi.fn()) {
    render(
      <TooltipProvider>
        <InnerSidebarHandle
          open={open}
          onToggle={onToggle}
          collapseLabel="Collapse navigation"
          expandLabel="Expand navigation"
        />
      </TooltipProvider>
    )
    return onToggle
  }

  it("names itself by direction and reports the expanded state", () => {
    renderHandle(true)
    const collapse = screen.getByRole("button", {
      name: "Collapse navigation",
    })
    expect(collapse.getAttribute("aria-expanded")).toBe("true")
    cleanup()
    renderHandle(false)
    const expand = screen.getByRole("button", { name: "Expand navigation" })
    expect(expand.getAttribute("aria-expanded")).toBe("false")
  })

  it("toggles on click", () => {
    const onToggle = renderHandle(true)
    fireEvent.click(screen.getByRole("button", { name: "Collapse navigation" }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it("stands in the gutter: anchored at the seam, bars offset off the border", () => {
    renderHandle(true)
    const button = screen.getByRole("button", { name: "Collapse navigation" })
    // Anchored at the parent's left edge (the seam) and padded inward (pl-2),
    // so the pill stands clear of the border instead of straddling it (the
    // Verve geometry). A -translate-x would put it back on the line.
    for (const cls of ["absolute", "left-0", "pl-2", "top-1/2"]) {
      expect(button.className).toContain(cls)
    }
    expect(button.className).not.toContain("-translate-x")
  })
})
