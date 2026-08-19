import type {
  ClientRect,
  CollisionDetection,
  KeyboardCoordinateGetter,
  UniqueIdentifier,
} from "@dnd-kit/core"
import { pointerWithin, rectIntersection } from "@dnd-kit/core"
import type { Coordinates } from "@dnd-kit/utilities"
import {
  type DimensionKey,
  isDimensionKey as isKnownDimension,
} from "@workspace/core"

// The drag-and-drop contract of the model builder, in one place: the ids the
// zones and cards register under, the payload each side attaches, and the one
// rule that decides whether a drop lands.
//
// It lives outside the components because BOTH sides read it. The zone renders
// its "this card does not belong here" state from the same rule the view's
// drop handler applies, so the two can never disagree about what a drop would
// do, which is the failure a reader has no way to see coming: a zone that
// lights up receptive and then refuses.

const ZONE_PREFIX = "zone:"
const LIBRARY_PREFIX = "lib:"

// What a library card carries while it is in flight.
export interface LibraryDragData {
  libraryKey: string
  // The card's own dimension, derived from the library key by the caller. It
  // travels with the drag so a zone can answer "is this mine?" without knowing
  // anything about the library.
  dimensionKey: DimensionKey
}

// What a dimension zone advertises to a card hovering over it.
export interface ZoneDropData {
  dimensionKey: DimensionKey
  // The dimension is at its criteria cap, so it cannot take another card even
  // from its own dimension.
  full: boolean
}

export function zoneDroppableId(dimensionKey: DimensionKey): string {
  return `${ZONE_PREFIX}${dimensionKey}`
}

export function libraryDraggableId(libraryKey: string): string {
  return `${LIBRARY_PREFIX}${libraryKey}`
}

function isDimensionKey(value: unknown): value is DimensionKey {
  return typeof value === "string" && isKnownDimension(value)
}

// dnd-kit hands a drag's data back as whatever was attached, so both readers
// verify the shape rather than assume it: a payload that is not the builder's
// own is refused whole, never read halfway.
export function libraryDragData(data: unknown): LibraryDragData | null {
  if (typeof data !== "object" || data === null) return null
  const { libraryKey, dimensionKey } = data as Record<string, unknown>
  if (typeof libraryKey !== "string" || !isDimensionKey(dimensionKey)) {
    return null
  }
  return { libraryKey, dimensionKey }
}

export function zoneDropData(data: unknown): ZoneDropData | null {
  if (typeof data !== "object" || data === null) return null
  const { dimensionKey, full } = data as Record<string, unknown>
  if (!isDimensionKey(dimensionKey) || typeof full !== "boolean") return null
  return { dimensionKey, full }
}

// The one rule. A card lands only in its own dimension's zone, and only while
// that dimension still has room.
export function zoneAccepts(cardData: unknown, zoneData: unknown): boolean {
  const card = libraryDragData(cardData)
  const zone = zoneDropData(zoneData)
  if (card === null || zone === null) return false
  return !zone.full && zone.dimensionKey === card.dimensionKey
}

// Which zone a card is over.
//
// The zones are four separate targets with gaps between them, so being over
// one means actually overlapping it. The "closest" strategies name a target
// however far away it is, which here would light some zone up as receptive for
// the whole duration of every drag, including while the card is still sitting
// in its list. Under the pointer the cursor's own position is the better
// answer still, because that is what the hand is aiming with; it has no
// position during a keyboard drag, which is what the rect fallback is for.
export const builderCollisionDetection: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args)
  return underPointer.length > 0 ? underPointer : rectIntersection(args)
}

// The slice of dnd-kit's sensor context the keyboard navigation actually
// reads. Narrower than SensorContext (which SensorContext satisfies) so the
// navigation can be exercised with plain rects instead of a live drag.
export interface ZoneNavigationContext {
  collisionRect: ClientRect | null
  droppableRects: Map<UniqueIdentifier, ClientRect>
  droppableContainers: {
    getEnabled(): readonly ({
      id: UniqueIdentifier
      disabled: boolean
    } | null)[]
  }
}

type Direction = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"

const DIRECTIONS: readonly Direction[] = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]

function isDirection(code: string): code is Direction {
  return DIRECTIONS.some((direction) => direction === code)
}

function centerOf(rect: ClientRect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

function lies(direction: Direction, from: Coordinates, to: Coordinates) {
  switch (direction) {
    case "ArrowUp":
      return to.y < from.y
    case "ArrowDown":
      return to.y > from.y
    case "ArrowLeft":
      return to.x < from.x
    case "ArrowRight":
      return to.x > from.x
  }
}

// Where an arrow key puts the dragged card: centred on the nearest zone that
// lies in the pressed direction, or nowhere when there is none.
//
// The vendor default nudges the card 25px per press, which is written for a
// sortable list where the next target is a row away. Here the targets are four
// zone cards across a page and a library list below them, so 25px steps make
// the keyboard path several dozen presses long: an interaction that exists on
// paper and that nobody completes. Jumping zone to zone makes the keyboard
// path the same length as the pointer's.
export function nextZoneCoordinates(
  code: string,
  context: ZoneNavigationContext
): Coordinates | undefined {
  if (!isDirection(code)) return undefined
  const { collisionRect, droppableRects, droppableContainers } = context
  if (collisionRect === null) return undefined

  const from = centerOf(collisionRect)
  let best: { rect: ClientRect; distance: number } | null = null
  for (const container of droppableContainers.getEnabled()) {
    if (container === null || container.disabled) continue
    const rect = droppableRects.get(container.id)
    if (rect === undefined) continue
    const to = centerOf(rect)
    if (!lies(code, from, to)) continue
    const distance = Math.hypot(to.x - from.x, to.y - from.y)
    if (best === null || distance < best.distance) best = { rect, distance }
  }
  if (best === null) return undefined

  // Centre the card on the zone. dnd-kit reads these as the dragged rect's
  // top-left, so the offset is half the difference of the two boxes.
  const target = centerOf(best.rect)
  return {
    x: target.x - collisionRect.width / 2,
    y: target.y - collisionRect.height / 2,
  }
}

export const builderKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  { context }
) => {
  if (!isDirection(event.code)) return undefined
  // The arrow keys are the drag now; letting them scroll the page as well
  // would slide the zones out from under the card being moved.
  event.preventDefault()
  return nextZoneCoordinates(event.code, context)
}
