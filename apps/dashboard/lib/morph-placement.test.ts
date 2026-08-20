import { describe, expect, it } from "vitest"
import {
  MORPH_VIEWPORT_MARGIN,
  morphPanelPlacement,
} from "@/lib/morph-placement"

// The panel's own width at rest: w-[26rem].
const PANEL = 416

// The placement's job is to keep the panel's whole box inside the viewport,
// so every case is checked against the box it actually produces rather than
// against the side/shift pair alone.
function boxOf(
  placement: { side: "left" | "right"; shift: number },
  trigger: { left: number; right: number },
  panelWidth = PANEL
) {
  const left =
    placement.side === "left"
      ? trigger.left - placement.shift
      : trigger.right + placement.shift - panelWidth
  return { left, right: left + panelWidth }
}

describe("morphPanelPlacement", () => {
  // The common case: room on the preferred side, so the panel sits exactly on
  // the trigger's edge and the morph grows straight out of the button.
  it("honours the preferred side, unshifted, when it fits", () => {
    const placement = morphPanelPlacement({
      triggerLeft: 200,
      triggerRight: 320,
      panelWidth: PANEL,
      viewportWidth: 1440,
      preferred: "left",
    })
    expect(placement).toEqual({ side: "left", shift: 0 })
  })

  // The reported defect: the full-width layout put the review trigger at the
  // right edge of the page, and a panel anchored left grew 416px straight off
  // the screen. It flips to the trigger's other edge and grows inward instead.
  it("flips to the other edge rather than running off the right", () => {
    const trigger = { left: 1670, right: 1790 }
    const placement = morphPanelPlacement({
      triggerLeft: trigger.left,
      triggerRight: trigger.right,
      panelWidth: PANEL,
      viewportWidth: 1814,
      preferred: "left",
    })
    expect(placement).toEqual({ side: "right", shift: 0 })
    const box = boxOf(placement, trigger)
    expect(box.right).toBeLessThanOrEqual(1814 - MORPH_VIEWPORT_MARGIN)
    expect(box.left).toBeGreaterThanOrEqual(MORPH_VIEWPORT_MARGIN)
  })

  it("flips the other way for a trigger against the left edge", () => {
    const trigger = { left: 16, right: 136 }
    const placement = morphPanelPlacement({
      triggerLeft: trigger.left,
      triggerRight: trigger.right,
      panelWidth: PANEL,
      viewportWidth: 1440,
      preferred: "right",
    })
    expect(placement).toEqual({ side: "left", shift: 0 })
    expect(boxOf(placement, trigger).left).toBeGreaterThanOrEqual(
      MORPH_VIEWPORT_MARGIN
    )
  })

  // Flipping is tried before shifting, because a shift moves the panel off
  // the trigger it grew from: a trigger with no room on the preferred side
  // but room on the other one flips and stays unshifted.
  it("prefers a flip over a shift when the other side has room", () => {
    const trigger = { left: 700, right: 820 }
    const placement = morphPanelPlacement({
      triggerLeft: trigger.left,
      triggerRight: trigger.right,
      panelWidth: PANEL,
      viewportWidth: 900,
      preferred: "left",
    })
    expect(placement).toEqual({ side: "right", shift: 0 })
  })

  // Neither side has the room (the panel is most of the viewport), so
  // flipping cannot help and the panel is pulled inward instead.
  it("pulls the panel in when no side fits outright", () => {
    const trigger = { left: 200, right: 320 }
    const viewportWidth = 500
    const placement = morphPanelPlacement({
      triggerLeft: trigger.left,
      triggerRight: trigger.right,
      panelWidth: PANEL,
      viewportWidth,
      preferred: "left",
    })
    expect(placement.shift).toBeGreaterThan(0)
    const box = boxOf(placement, trigger)
    expect(box.right).toBeLessThanOrEqual(viewportWidth - MORPH_VIEWPORT_MARGIN)
    expect(box.left).toBeGreaterThanOrEqual(MORPH_VIEWPORT_MARGIN)
  })

  // A panel wider than the viewport cannot fit at all. The left edge is the
  // one kept on screen, because it carries the title and the reading order
  // starts there; the panel's own max-w-[85vw] is what keeps this rare.
  it("keeps the left edge on screen when the panel cannot fit at all", () => {
    const trigger = { left: 300, right: 420 }
    const placement = morphPanelPlacement({
      triggerLeft: trigger.left,
      triggerRight: trigger.right,
      panelWidth: 900,
      viewportWidth: 500,
      preferred: "left",
    })
    expect(boxOf(placement, trigger, 900).left).toBeGreaterThanOrEqual(
      MORPH_VIEWPORT_MARGIN
    )
  })

  // Whatever the trigger's position, the panel's box stays within the
  // viewport: swept rather than spot-checked, because the defect was one
  // untested trigger position. The bound is the viewport itself, not the
  // margin: the anchored edge follows its trigger, so a trigger flush against
  // the edge gets a panel flush with it (see the module's guarantee).
  it("never leaves the viewport at any trigger position", () => {
    const viewportWidth = 1440
    for (const preferred of ["left", "right"] as const) {
      for (let left = 0; left <= viewportWidth - 120; left += 20) {
        const trigger = { left, right: left + 120 }
        const box = boxOf(
          morphPanelPlacement({
            triggerLeft: trigger.left,
            triggerRight: trigger.right,
            panelWidth: PANEL,
            viewportWidth,
            preferred,
          }),
          trigger
        )
        expect(box.left, `${preferred} at ${left}`).toBeGreaterThanOrEqual(0)
        expect(box.right, `${preferred} at ${left}`).toBeLessThanOrEqual(
          viewportWidth
        )
      }
    }
  })
})
