import { describe, expect, it } from "vitest"
import {
  MORPH_VIEWPORT_MARGIN,
  morphPanelPlacement,
  morphStackPlacement,
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

  // The same impossible panel on the OTHER anchored side. Both branches have
  // to keep the same edge, or which half of the panel survives would depend on
  // which side the call site happened to prefer.
  it("keeps the left edge on screen on the right side too", () => {
    const trigger = { left: 300, right: 420 }
    const placement = morphPanelPlacement({
      triggerLeft: trigger.left,
      triggerRight: trigger.right,
      panelWidth: 900,
      viewportWidth: 500,
      preferred: "right",
    })
    expect(placement.side).toBe("right")
    expect(boxOf(placement, trigger, 900).left).toBe(MORPH_VIEWPORT_MARGIN)
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

// The vertical shape: a panel stacked over its trigger and centred on it,
// which is what the weight row's step meanings became.
describe("morphStackPlacement", () => {
  const GAP = 8
  const W = 224
  const H = 64
  // A step in the middle of a row: 40px wide, 32px tall.
  const STEP = { left: 500, right: 540, top: 400, bottom: 432 }

  const place = (
    step = STEP,
    viewportWidth = 1440,
    viewportHeight = 900,
    panelWidth = W,
    panelHeight = H
  ) =>
    morphStackPlacement({
      triggerLeft: step.left,
      triggerRight: step.right,
      triggerTop: step.top,
      triggerBottom: step.bottom,
      gap: GAP,
      panelWidth,
      panelHeight,
      viewportWidth,
      viewportHeight,
      preferred: "top",
    })

  // Where the panel lands horizontally, so the side containment is checked
  // against its box rather than the shift alone.
  const boxOf = (placement: { shift: number }, step = STEP, panelWidth = W) => {
    const left = (step.left + step.right) / 2 - panelWidth / 2 + placement.shift
    return { left, right: left + panelWidth }
  }

  it("opens above and centred when there is room", () => {
    const placement = place()
    expect(placement.side).toBe("top")
    expect(placement.shift).toBe(0)
    // Centred on the step: the step's centre is 520, the panel's is too.
    const box = boxOf(placement)
    expect((box.left + box.right) / 2).toBe(520)
  })

  // A row near the top of the viewport has nothing above it, so the panel
  // drops below rather than opening off screen.
  it("flips below when the top would leave the viewport", () => {
    const highStep = { left: 500, right: 540, top: 20, bottom: 52 }
    expect(place(highStep).side).toBe("bottom")
  })

  // And back again: a row near the bottom keeps its preferred side, because
  // that is the one with the room.
  it("stays above when only the bottom would overflow", () => {
    const lowStep = { left: 500, right: 540, top: 820, bottom: 852 }
    expect(place(lowStep).side).toBe("top")
  })

  // Vertical is a flip, never a shift: a panel nudged down over the control it
  // explains would cover the thing the reader is pointing at.
  it("never shifts vertically, even when neither side fits", () => {
    const cramped = { left: 500, right: 540, top: 40, bottom: 72 }
    const placement = place(cramped, 1440, 120)
    expect(placement.side).toBe("top")
    expect(placement).not.toHaveProperty("verticalShift")
  })

  // The step at the right end of a row against the page's right edge: the
  // centred panel would hang off, so it slides left just enough.
  it("slides sideways to stay inside the right edge", () => {
    const step = { left: 1380, right: 1420, top: 400, bottom: 432 }
    const placement = place(step)
    expect(placement.shift).toBeLessThan(0)
    const box = boxOf(placement, step)
    expect(box.right).toBe(1440 - MORPH_VIEWPORT_MARGIN)
    expect(box.left).toBeGreaterThanOrEqual(MORPH_VIEWPORT_MARGIN)
  })

  it("slides sideways to stay inside the left edge", () => {
    const step = { left: 20, right: 60, top: 400, bottom: 432 }
    const placement = place(step)
    expect(placement.shift).toBeGreaterThan(0)
    expect(boxOf(placement, step).left).toBe(MORPH_VIEWPORT_MARGIN)
  })

  // A panel wider than the room keeps its LEFT edge on screen, the same
  // decision both horizontal branches make.
  it("keeps the left edge when the panel cannot fit at all", () => {
    const placement = place(STEP, 200, 900, 400)
    expect(boxOf(placement, STEP, 400).left).toBe(MORPH_VIEWPORT_MARGIN)
  })

  // Swept: whatever the step's position in the row and the row's on the page,
  // the panel's box stays inside the viewport horizontally.
  it("never leaves the viewport at any step position", () => {
    for (const viewportWidth of [1920, 1440, 640, 380]) {
      for (let left = 0; left <= viewportWidth - 40; left += 10) {
        const step = { left, right: left + 40, top: 400, bottom: 432 }
        const box = boxOf(place(step, viewportWidth), step)
        const where = `${viewportWidth} at ${left}`
        expect(box.left, where).toBeGreaterThanOrEqual(0)
        expect(box.right, where).toBeLessThanOrEqual(viewportWidth)
      }
    }
  })
})
