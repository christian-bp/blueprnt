import { HistoryIcon } from "@hugeicons/core-free-icons"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  InnerSidebar,
  InnerSidebarExpandButton,
  InnerSidebarPinnedActions,
} from "@/components/inner-sidebar"

afterEach(cleanup)

function renderSidebar(open: boolean) {
  return render(
    <InnerSidebar
      open={open}
      label="Guide navigation"
      collapseLabel="Hide guide navigation"
      onCollapse={() => {}}
    >
      <p>tree</p>
    </InnerSidebar>
  )
}

describe("InnerSidebar", () => {
  it("renders its content and collapse control while open", () => {
    renderSidebar(true)
    expect(
      screen.getByRole("navigation", { name: "Guide navigation" })
    ).toBeTruthy()
    expect(screen.getByText("tree")).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Hide guide navigation" })
    ).toBeTruthy()
  })

  // Collapsed must mean UNMOUNTED, not merely clipped: a closed panel that
  // still holds its tree keeps every link in the tab order and every
  // subscription alive behind a zero-width box.
  it("mounts nothing while collapsed", () => {
    renderSidebar(false)
    expect(screen.queryByText("tree")).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Hide guide navigation" })
    ).toBeNull()
  })

  it("calls onCollapse when the collapse control is pressed", async () => {
    const onCollapse = vi.fn()
    const { getByRole } = render(
      <InnerSidebar
        open
        label="Guide navigation"
        collapseLabel="Hide guide navigation"
        onCollapse={onCollapse}
      >
        <p>tree</p>
      </InnerSidebar>
    )
    fireEvent.click(getByRole("button", { name: "Hide guide navigation" }))
    expect(onCollapse).toHaveBeenCalledTimes(1)
  })

  // docs/ui-animation.md rule 2: the animated element carries ONLY geometry.
  // A border or padding on it would survive the collapse as a stranded
  // hairline at width 0, because a border-box element at width 0 still paints
  // its border. This is the invariant a future edit is most likely to break,
  // and it is invisible in a unit test unless asserted directly.
  it("keeps the border on the inner box, never on the animated outer box", () => {
    const { container } = renderSidebar(true)
    const outer = container.firstElementChild as HTMLElement
    const inner = screen.getByRole("navigation", { name: "Guide navigation" })

    // Anchored at a class boundary so `px-2`/`py-2`/`pt-2` are caught too: a
    // plain substring check for "p-" misses every directional padding class,
    // which is the form a future edit is most likely to add.
    expect(outer.className).not.toMatch(/(^|\s)border/)
    expect(outer.className).not.toMatch(/(^|\s)p[xytrbl]?-/)
    expect(inner.className).toContain("border-r")
  })

  it("takes its height from the parent by default and pins itself when sticky", () => {
    const { container: filled } = renderSidebar(true)
    expect((filled.firstElementChild as HTMLElement).className).toContain(
      "min-h-0"
    )

    const { container: stuck } = render(
      <InnerSidebar
        open
        height="sticky"
        label="Guide navigation"
        collapseLabel="Hide guide navigation"
        onCollapse={() => {}}
      >
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
      <InnerSidebar
        open
        className="hidden lg:flex"
        label="Guide navigation"
        collapseLabel="Hide guide navigation"
        onCollapse={() => {}}
      >
        <p>tree</p>
      </InnerSidebar>
    )
    expect((container.firstElementChild as HTMLElement).className).toContain(
      "hidden lg:flex"
    )
  })

  it("renders no collapse control when the surface does not collapse", () => {
    render(
      <InnerSidebar open label="Guide navigation" actions={<span>top</span>}>
        <p>tree</p>
      </InnerSidebar>
    )
    expect(screen.getByText("top")).toBeTruthy()
    expect(screen.getByText("tree")).toBeTruthy()
    expect(screen.queryByRole("button")).toBeNull()
  })

  // A surface with neither actions nor a collapse control would otherwise
  // render an empty 40px strip above its content.
  it("renders no header row when there is nothing to put in it", () => {
    render(
      <InnerSidebar open label="Guide navigation">
        <p>tree</p>
      </InnerSidebar>
    )
    const nav = screen.getByRole("navigation", { name: "Guide navigation" })
    expect(nav.querySelector(".h-10")).toBeNull()
    expect(screen.getByText("tree")).toBeTruthy()
  })
})

describe("InnerSidebarExpandButton", () => {
  it("exposes its label and calls onExpand", () => {
    const onExpand = vi.fn()
    render(
      <InnerSidebarExpandButton
        label="Show guide navigation"
        icon={HistoryIcon}
        onExpand={onExpand}
      />
    )
    const button = screen.getByRole("button", { name: "Show guide navigation" })
    fireEvent.click(button)
    expect(onExpand).toHaveBeenCalledTimes(1)
  })
})

describe("InnerSidebarPinnedActions", () => {
  it("renders its children in the pinned slot", () => {
    const { container } = render(
      <InnerSidebarPinnedActions>
        <button type="button">stand-in</button>
      </InnerSidebarPinnedActions>
    )
    const slot = container.firstElementChild as HTMLElement
    expect(slot.className).toContain("absolute")
    expect(screen.getByRole("button", { name: "stand-in" })).toBeTruthy()
  })
})
