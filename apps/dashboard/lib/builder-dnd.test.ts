import type { ClientRect, UniqueIdentifier } from "@dnd-kit/core"
import { describe, expect, it } from "vitest"
import {
  type ZoneNavigationContext,
  libraryDragData,
  libraryDraggableId,
  nextZoneCoordinates,
  zoneAccepts,
  zoneDropData,
  zoneDroppableId,
  zoneVerdict,
} from "@/lib/builder-dnd"

function rect(left: number, top: number, width: number, height: number) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  } satisfies ClientRect
}

// The builder's real geometry in miniature: four zones in a row, and the
// dragged card starting under the third column's list.
const ZONES: [string, ClientRect][] = [
  [zoneDroppableId("competence"), rect(0, 0, 200, 120)],
  [zoneDroppableId("effort"), rect(220, 0, 200, 120)],
  [zoneDroppableId("responsibility"), rect(440, 0, 200, 120)],
  [zoneDroppableId("workingConditions"), rect(660, 0, 200, 120)],
]

function context(options: {
  collisionRect: ClientRect
  disabledIds?: readonly string[]
  // Droppables the view has registered that are not dimension zones.
  others?: readonly [string, ClientRect][]
}): ZoneNavigationContext {
  const disabled = new Set(options.disabledIds ?? [])
  const containers = [...ZONES, ...(options.others ?? [])]
  const droppableRects = new Map<UniqueIdentifier, ClientRect>(containers)
  return {
    collisionRect: options.collisionRect,
    droppableRects,
    droppableContainers: {
      getEnabled: () =>
        containers.map(([id]) => ({ id, disabled: disabled.has(id) })),
    },
  }
}

describe("builder drag-and-drop ids", () => {
  // The id scheme is a contract between the zone, the card, and the view that
  // hosts the DndContext, so it is pinned literally rather than round-tripped.
  it("names a zone after its dimension and a card after its library key", () => {
    expect(zoneDroppableId("workingConditions")).toBe("zone:workingConditions")
    expect(libraryDraggableId("knowledge-depth")).toBe("lib:knowledge-depth")
  })
})

describe("builder drag payloads", () => {
  it("reads a card's own dimension and library key off the drag", () => {
    expect(
      libraryDragData({
        libraryKey: "scope-impact",
        dimensionKey: "responsibility",
      })
    ).toEqual({ libraryKey: "scope-impact", dimensionKey: "responsibility" })
  })

  it("reads a zone's dimension and whether it is full", () => {
    expect(zoneDropData({ dimensionKey: "effort", full: true })).toEqual({
      dimensionKey: "effort",
      full: true,
    })
  })

  // dnd-kit hands back whatever the call site attached, typed as unknown data.
  // Anything that is not one of ours is not half-read, it is refused.
  it("refuses data that is not the builder's own", () => {
    expect(libraryDragData(undefined)).toBeNull()
    expect(libraryDragData({ libraryKey: "scope-impact" })).toBeNull()
    expect(zoneDropData({ dimensionKey: "effort" })).toBeNull()
    expect(zoneDropData("zone:effort")).toBeNull()
  })
})

describe("zoneVerdict", () => {
  const card = { libraryKey: "analytical-effort", dimensionKey: "effort" }

  it("accepts a card into its own dimension's zone", () => {
    expect(zoneVerdict(card, { dimensionKey: "effort", full: false })).toBe(
      "ok"
    )
  })

  // The reason, not just the refusal: a reader who is told only "no" while the
  // card is in the air has nothing to do about it, and the two refusals ask
  // for opposite things (aim elsewhere, or make room first).
  it("refuses a card in a foreign dimension's zone as the wrong dimension", () => {
    expect(zoneVerdict(card, { dimensionKey: "competence", full: false })).toBe(
      "wrongDimension"
    )
  })

  it("refuses a card once its own dimension is full, as full", () => {
    expect(zoneVerdict(card, { dimensionKey: "effort", full: true })).toBe(
      "full"
    )
  })

  // A foreign zone that is also full is answered by the mismatch: telling this
  // card the dimension is full would be a true sentence about a dimension it
  // was never going into.
  it("names the mismatch first when a foreign zone is full too", () => {
    expect(zoneVerdict(card, { dimensionKey: "competence", full: true })).toBe(
      "wrongDimension"
    )
  })

  it("refuses a drop with nothing under it", () => {
    expect(zoneVerdict(card, undefined)).toBe("wrongDimension")
  })
})

describe("zoneAccepts", () => {
  const card = { libraryKey: "analytical-effort", dimensionKey: "effort" }

  it("says yes only where the verdict is ok", () => {
    expect(zoneAccepts(card, { dimensionKey: "effort", full: false })).toBe(
      true
    )
    expect(zoneAccepts(card, { dimensionKey: "competence", full: false })).toBe(
      false
    )
    expect(zoneAccepts(card, { dimensionKey: "effort", full: true })).toBe(
      false
    )
    expect(zoneAccepts(card, undefined)).toBe(false)
  })
})

describe("keyboard zone navigation", () => {
  // A library card sits under its own column; one Up press lifts it onto the
  // zone above rather than crawling 25px at a time the way the vendor default
  // does, which over this layout's distances is not an interaction anyone
  // would finish.
  it("moves onto the nearest zone in the pressed direction, centred on it", () => {
    const collisionRect = rect(450, 400, 180, 60)
    expect(nextZoneCoordinates("ArrowUp", context({ collisionRect }))).toEqual({
      x: 450,
      y: 30,
    })
  })

  it("steps sideways between neighbouring zones", () => {
    // Centred on the responsibility zone.
    const collisionRect = rect(450, 30, 180, 60)
    expect(
      nextZoneCoordinates("ArrowLeft", context({ collisionRect }))
    ).toEqual({ x: 230, y: 30 })
    expect(
      nextZoneCoordinates("ArrowRight", context({ collisionRect }))
    ).toEqual({ x: 670, y: 30 })
  })

  it("stays put when nothing lies in the pressed direction", () => {
    const collisionRect = rect(450, 30, 180, 60)
    expect(
      nextZoneCoordinates("ArrowUp", context({ collisionRect }))
    ).toBeUndefined()
  })

  // A zone the view has switched off (dnd-kit's own disabled flag) is not a
  // place the keyboard can land, or the arrow keys would offer a target the
  // pointer cannot reach either.
  it("skips a disabled zone and lands on the next one", () => {
    const collisionRect = rect(450, 30, 180, 60)
    expect(
      nextZoneCoordinates(
        "ArrowLeft",
        context({
          collisionRect,
          disabledIds: [zoneDroppableId("effort")],
        })
      )
    ).toEqual({ x: 10, y: 30 })
  })

  // The arrow keys move the card between DIMENSIONS. Any other droppable the
  // view registers (a library list, a bin) is enabled and has a rect like any
  // other, so an unfiltered search would happily park the card on one, in a
  // place no drop can land.
  it("never lands on a droppable that is not a zone", () => {
    const collisionRect = rect(450, 400, 180, 60)
    expect(
      nextZoneCoordinates(
        "ArrowUp",
        context({
          collisionRect,
          // Nearer in the pressed direction than every zone, so it would win
          // outright if it were a candidate at all.
          others: [["lib:analytical-effort", rect(440, 300, 200, 40)]],
        })
      )
    ).toEqual({ x: 450, y: 30 })
  })

  it("ignores keys that are not a direction", () => {
    const collisionRect = rect(450, 400, 180, 60)
    expect(
      nextZoneCoordinates("Space", context({ collisionRect }))
    ).toBeUndefined()
  })
})
