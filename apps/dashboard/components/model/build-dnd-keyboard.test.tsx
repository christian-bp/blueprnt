import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { DimensionKey } from "@workspace/core"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { DimensionDropZone } from "@/components/model/dimension-drop-zone"
import {
  type LibraryCardEntry,
  LibraryCriterionCard,
} from "@/components/model/library-criterion-card"
import {
  builderCollisionDetection,
  builderKeyboardCoordinates,
  zoneAccepts,
} from "@/lib/builder-dnd"

// The build view's drag-and-drop, driven entirely from the keyboard against
// the real dnd-kit: the sensors, the collision detection, and the coordinate
// getter the view will actually ship with. Nothing about the drag is stubbed
// except the geometry, which happy-dom does not have (it reports every rect as
// zero), so the layout below is declared and handed to getBoundingClientRect.
//
// Mouse dragging cannot be reproduced here for the same reason: the pointer
// path IS the geometry. Keyboard dragging can, because its whole vocabulary is
// key presses, and it is the path that has to work for a reader who does not
// use a pointer at all.

// Two columns of the four, laid out as the build view lays them out: the zone
// on top, its own library list directly underneath.
const LAYOUT = {
  "zone:competence": { left: 0, top: 0, width: 300, height: 160 },
  "zone:effort": { left: 320, top: 0, width: 300, height: 160 },
  "card:Knowledge depth": { left: 0, top: 220, width: 280, height: 70 },
  "card:Analytical effort": { left: 320, top: 220, width: 280, height: 70 },
} as const

const ZERO = makeRect({ left: 0, top: 0, width: 0, height: 0 })

function makeRect(box: {
  left: number
  top: number
  width: number
  height: number
}): DOMRect {
  return {
    ...box,
    x: box.left,
    y: box.top,
    right: box.left + box.width,
    bottom: box.top + box.height,
    toJSON: () => box,
  }
}

const rects = new WeakMap<Element, DOMRect>()
const originalGetRect = Element.prototype.getBoundingClientRect

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function measured(this: Element) {
    return rects.get(this) ?? ZERO
  }
})
afterAll(() => {
  Element.prototype.getBoundingClientRect = originalGetRect
})

const DIMENSIONS: { key: DimensionKey; title: string; question: string }[] = [
  {
    key: "competence",
    title: "Competence",
    question: "What does the role need to know and be able to do?",
  },
  {
    key: "effort",
    title: "Effort",
    question: "What does the work demand of the person doing it?",
  },
]

const CARDS: LibraryCardEntry[] = [
  {
    libraryKey: "knowledge-depth",
    dimensionKey: "competence",
    name: "Knowledge depth",
    shortUiText: "How deep the knowledge has to run",
  },
  {
    libraryKey: "analytical-effort",
    dimensionKey: "effort",
    name: "Analytical effort",
    shortUiText: "How much analysis the work demands",
  },
]

interface DropReport {
  active: string
  over: string | null
  accepted: boolean
}

function Harness({
  onDrop,
  fullDimensions = [],
}: {
  onDrop: (report: DropReport) => void
  fullDimensions?: readonly DimensionKey[]
}) {
  // The same sensor pair the repo's other drag surface uses: the distance
  // constraint keeps a plain click off the drag, and the keyboard sensor is
  // what makes this whole test possible in the product as well as here.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: builderKeyboardCoordinates })
  )
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <DndContext
        sensors={sensors}
        collisionDetection={builderCollisionDetection}
        onDragEnd={({ active, over }) =>
          onDrop({
            active: String(active.id),
            over: over === null ? null : String(over.id),
            accepted: zoneAccepts(active.data.current, over?.data.current),
          })
        }
      >
        {DIMENSIONS.map((dimension) => (
          <div key={dimension.key}>
            <DimensionDropZone
              dimensionKey={dimension.key}
              title={dimension.title}
              helpBody={dimension.question}
              count={fullDimensions.includes(dimension.key) ? 2 : 0}
              max={2}
              full={fullDimensions.includes(dimension.key)}
            />
            <ul>
              {CARDS.filter((card) => card.dimensionKey === dimension.key).map(
                (card) => (
                  <LibraryCriterionCard
                    key={card.libraryKey}
                    entry={card}
                    onAdd={() => {}}
                  />
                )
              )}
            </ul>
          </div>
        ))}
      </DndContext>
    </NextIntlClientProvider>
  )
}

const zone = (title: string) => screen.getByRole("region", { name: title })
// The draggable body carries no label of its own, so it is found the way a
// screen reader names it: by the content inside it.
const card = (name: string) =>
  screen.getByRole("button", { name: (label) => label.startsWith(name) })
const stateOf = (title: string) => zone(title).dataset.state

// happy-dom has no layout, so every element the drag measures is given the
// rect the build view's grid would give it.
function measure() {
  rects.set(zone("Competence"), makeRect(LAYOUT["zone:competence"]))
  rects.set(zone("Effort"), makeRect(LAYOUT["zone:effort"]))
  rects.set(card("Knowledge depth"), makeRect(LAYOUT["card:Knowledge depth"]))
  rects.set(
    card("Analytical effort"),
    makeRect(LAYOUT["card:Analytical effort"])
  )
}

function renderBoard(fullDimensions?: readonly DimensionKey[]) {
  const onDrop = vi.fn<(report: DropReport) => void>()
  render(<Harness onDrop={onDrop} fullDimensions={fullDimensions} />)
  measure()
  return onDrop
}

// The sensor arms its document listener on a macrotask, so a press fired in
// the same tick as the pick-up would land on nothing.
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function press(target: Element | Document, code: string) {
  await act(async () => {
    fireEvent.keyDown(target, { code, key: code === "Space" ? " " : code })
  })
}

async function pickUp(name: string) {
  await press(card(name), "Space")
  await settle()
}

const move = (code: string) => press(document, code)
const drop = () => press(document, "Space")
const cancel = () => press(document, "Escape")

describe("building the model from the keyboard", () => {
  afterEach(cleanup)

  it("picks a card up, moves it between zones, and drops it in its own", async () => {
    const onDrop = renderBoard()

    // Picked up, still resting under its own list: its dimension is lit and
    // ready, the other has receded so only one target is on.
    await pickUp("Analytical effort")
    expect(stateOf("Effort")).toBe("receptive")
    expect(stateOf("Competence")).toBe("inactive")

    // One press lifts it onto the zone directly above, rather than crawling
    // there 25px at a time.
    await move("ArrowUp")
    expect(stateOf("Effort")).toBe("over")
    expect(stateOf("Competence")).toBe("inactive")

    // Stepping sideways onto a dimension this card does not belong to: the
    // answer arrives while the card is still in the air.
    await move("ArrowLeft")
    expect(stateOf("Competence")).toBe("blocked")
    expect(stateOf("Effort")).toBe("receptive")

    // And back.
    await move("ArrowRight")
    expect(stateOf("Effort")).toBe("over")

    await drop()
    expect(onDrop).toHaveBeenCalledWith({
      active: "lib:analytical-effort",
      over: "zone:effort",
      accepted: true,
    })

    // The drag is over: every zone is back at rest.
    expect(stateOf("Effort")).toBe("idle")
    expect(stateOf("Competence")).toBe("idle")
  })

  // The zone stays a live droppable for a foreign card so it can say no. What
  // it must never do is report the drop as one the view should act on.
  it("refuses a card dropped on another dimension's zone", async () => {
    const onDrop = renderBoard()

    await pickUp("Analytical effort")
    await move("ArrowUp")
    await move("ArrowLeft")
    expect(stateOf("Competence")).toBe("blocked")

    await drop()
    expect(onDrop).toHaveBeenCalledWith({
      active: "lib:analytical-effort",
      over: "zone:competence",
      accepted: false,
    })
  })

  // A dimension at its cap refuses its OWN criteria too, and says so the same
  // way, rather than accepting a drop the backend would reject.
  it("refuses a card once its dimension is full", async () => {
    const onDrop = renderBoard(["effort"])

    await pickUp("Analytical effort")
    expect(stateOf("Effort")).toBe("inactive")
    await move("ArrowUp")
    expect(stateOf("Effort")).toBe("blocked")

    await drop()
    expect(onDrop).toHaveBeenCalledWith({
      active: "lib:analytical-effort",
      over: "zone:effort",
      accepted: false,
    })
  })

  it("puts the card back when the drag is cancelled", async () => {
    const onDrop = renderBoard()

    await pickUp("Analytical effort")
    await move("ArrowUp")
    expect(stateOf("Effort")).toBe("over")

    await cancel()
    expect(onDrop).not.toHaveBeenCalled()
    expect(stateOf("Effort")).toBe("idle")
    expect(stateOf("Competence")).toBe("idle")
  })
})
