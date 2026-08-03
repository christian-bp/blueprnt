import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { useRef, useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The drag itself is stubbed, never the component's wiring. happy-dom reports
// every rect as zero, so dnd-kit's collision detection cannot pick a target
// from a simulated pointer: what a real drag would compute is exactly the part
// that cannot be reproduced here. So the vendor's pointer machinery is
// replaced with a seam that records which droppables the component registers
// and hands back its own onDragOver/onDragEnd, and the test then drives the
// component's real handlers with the real droppable id it registered. What is
// under test is the component's wiring (is a family group a drop target, and
// what does dropping into it do to the payload), not dnd-kit.
const dnd = vi.hoisted(() => ({
  handlers: {
    start: null as null | ((event: unknown) => void),
    over: null as null | ((event: unknown) => void),
    end: null as null | ((event: unknown) => void),
    cancel: null as null | ((event: unknown) => void),
  },
  droppableIds: [] as string[],
  // The element each droppable id was actually attached to. Recording the id
  // alone is not enough: a setNodeRef that goes nowhere leaves the droppable
  // registered against no element, which is precisely the regression a table
  // invites, since a <tbody> is easy to render without ever passing the ref on.
  droppableNodes: new Map<string, HTMLElement>(),
}))

vi.mock("@dnd-kit/core", async () => {
  const actual =
    await vi.importActual<typeof import("@dnd-kit/core")>("@dnd-kit/core")
  return {
    ...actual,
    DndContext: ({
      children,
      onDragStart,
      onDragOver,
      onDragEnd,
      onDragCancel,
    }: {
      children: React.ReactNode
      onDragStart?: (event: unknown) => void
      onDragOver?: (event: unknown) => void
      onDragEnd?: (event: unknown) => void
      onDragCancel?: (event: unknown) => void
    }) => {
      dnd.handlers.start = onDragStart ?? null
      dnd.handlers.over = onDragOver ?? null
      dnd.handlers.end = onDragEnd ?? null
      dnd.handlers.cancel = onDragCancel ?? null
      return children
    },
    // The floating preview needs a live drag context to measure; nothing here
    // is about it.
    DragOverlay: () => null,
    useDroppable: ({ id }: { id: string | number }) => {
      dnd.droppableIds.push(String(id))
      return {
        active: null,
        isOver: false,
        node: { current: null },
        over: null,
        rect: { current: null },
        setNodeRef: (node: HTMLElement | null) => {
          if (node !== null) dnd.droppableNodes.set(String(id), node)
        },
      }
    },
  }
})

import {
  type ReviewAnnotations,
  type ReviewRegister,
  FamilyReviewTable,
} from "@/components/family-review-table"
import type { DraftFamily } from "@/lib/family-dnd"
import { resolveImportTargets } from "@/lib/role-import"

const t = messages.dashboard.familyTable
const familyActions = (name: string) => t.familyActions.replace("{name}", name)

const ENG = "fam_eng" as Id<"roleFamilies">
const FIN = "fam_fin" as Id<"roleFamilies">

const EXISTING_FAMILIES = [
  { familyId: ENG, name: "Engineering" },
  { familyId: FIN, name: "Finance" },
]

const TRACKS = [{ trackKey: "IC", label: "Individual Contributor" }]

const NO_ANNOTATIONS: ReviewAnnotations = {
  collidingFamilyIds: new Set<number>(),
  nameMissingFamilyIds: new Set<number>(),
  duplicateRoleIds: new Set<number>(),
  blankRoleIds: new Set<number>(),
}

const REGISTER: ReviewRegister = new Map([
  [
    ENG as string,
    {
      roles: [
        { id: "r1", title: "Developer", trackKey: "IC", trackName: "IC" },
      ],
    },
  ],
  [
    FIN as string,
    {
      roles: [
        { id: "r2", title: "Controller", trackKey: "IC", trackName: "IC" },
      ],
    },
  ],
])

// The seeded shape: the proposal put Platform Engineer in Engineering, and
// Finance came along as a family the org has and the proposal never targeted.
function seededDraft(): DraftFamily[] {
  return [
    {
      id: 1,
      familyId: ENG,
      name: "Engineering",
      roles: [{ id: 2, title: "Platform Engineer", trackKey: "IC" }],
    },
    { id: 3, familyId: FIN, name: "Finance", roles: [] },
  ]
}

const latest: { current: DraftFamily[] } = { current: [] }

function Harness() {
  const [families, setFamilies] = useState(seededDraft)
  const nextId = useRef(100)
  latest.current = families
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <FamilyReviewTable
        families={families}
        onFamiliesChange={(updater) =>
          setFamilies((current) => updater(current))
        }
        claimId={() => {
          const id = nextId.current
          nextId.current += 1
          return id
        }}
        trackOptions={TRACKS}
        annotations={NO_ANNOTATIONS}
        register={REGISTER}
      />
    </NextIntlClientProvider>
  )
}

const pickUp = () => {
  act(() => {
    dnd.handlers.start?.({ active: { id: "role-2" } })
  })
}
const dragOverFinance = () => {
  act(() => {
    dnd.handlers.over?.({ active: { id: "role-2" }, over: { id: "family-3" } })
  })
}
const drop = () => {
  act(() => {
    dnd.handlers.end?.({ active: { id: "role-2" }, over: { id: "family-3" } })
  })
}
const cancel = () => {
  act(() => {
    dnd.handlers.cancel?.({ active: { id: "role-2" } })
  })
}

const groups = (container: HTMLElement) =>
  container.querySelectorAll('[data-slot="table-body"]')

describe("FamilyReviewTable drag between family groups", () => {
  beforeEach(() => {
    dnd.droppableIds.length = 0
    dnd.droppableNodes.clear()
    dnd.handlers.start = null
    dnd.handlers.over = null
    dnd.handlers.end = null
    dnd.handlers.cancel = null
  })

  afterEach(() => {
    cleanup()
  })

  // The drop targets are the family GROUPS, so each family's own <tbody>
  // carries the droppable. A group that merely looked like a drop zone would
  // leave the entire point of putting the register on screen unreachable, and
  // nothing about its appearance would say so.
  it("registers each family group as a real droppable under its own id", () => {
    render(<Harness />)
    expect(dnd.droppableIds).toContain("family-1")
    expect(dnd.droppableIds).toContain("family-3")
    // Registered against the GROUP ITSELF, not merely declared: a setNodeRef
    // that never reaches an element leaves the droppable attached to nothing.
    const group = dnd.droppableNodes.get("family-3")
    expect(group?.tagName).toBe("TBODY")
    expect(group?.getAttribute("data-slot")).toBe("table-body")
    // The family the proposal never targeted is a whole group all the same:
    // its name, the role it already holds, and its own row-actions menu, which
    // is what gives the pointer something to aim at.
    expect(group?.textContent).toContain("Finance")
    expect(group?.textContent).toContain("Controller")
    expect(group?.querySelector("button")?.getAttribute("aria-label")).toBe(
      familyActions("Finance")
    )
  })

  // Add-family sits below the table entirely, so there is no group behind it
  // to absorb a drop meant for a family: FamilyGroup is the only component
  // that calls useDroppable, so every registered droppable is a family's own
  // group and a new family still has to be created and dropped into on
  // purpose.
  it("keeps add-family out of the droppable set", () => {
    const view = render(<Harness />)
    const addFamily = screen.getByRole("button", { name: t.addFamily })
    expect(addFamily.closest("table")).toBeNull()
    for (const node of dnd.droppableNodes.values()) {
      expect(node.contains(addFamily)).toBe(false)
    }
    expect(groups(view.container)).toHaveLength(2)
  })

  it("moves a proposed role into another family group and yields its familyId", () => {
    render(<Harness />)
    pickUp()
    dragOverFinance()
    drop()

    expect(latest.current).toEqual([
      { id: 1, familyId: ENG, name: "Engineering", roles: [] },
      {
        id: 3,
        familyId: FIN,
        name: "Finance",
        roles: [{ id: 2, title: "Platform Engineer", trackKey: "IC" }],
      },
    ])

    // The write that follows targets the family the role was dropped into.
    const resolved = resolveImportTargets(latest.current, EXISTING_FAMILIES, [
      { title: "Developer", familyId: ENG },
    ])
    expect(resolved.payload).toEqual([
      {
        familyId: FIN,
        name: "Finance",
        roles: [{ title: "Platform Engineer", trackKey: "IC" }],
      },
    ])
    expect(resolved.canCreate).toBe(true)
  })

  // The move applies live during onDragOver, so the source group empties while
  // the pointer is still down. Nothing may change shape under the cursor: a
  // group that turned into something else mid-gesture would take a chunk out of
  // the table and slide the drop target away from the pointer.
  it("keeps the table's shape steady across the whole drag", () => {
    const view = render(<Harness />)
    const rowCount = () => view.container.querySelectorAll("tbody tr").length
    // One tbody per family; add-family is not in the table.
    expect(groups(view.container)).toHaveLength(2)
    const before = rowCount()

    pickUp()
    dragOverFinance()
    expect(groups(view.container)).toHaveLength(2)
    expect(rowCount()).toBe(before)

    drop()
    expect(groups(view.container)).toHaveLength(2)
    expect(rowCount()).toBe(before)
  })

  it("restores the table when the drag is cancelled", () => {
    render(<Harness />)
    pickUp()
    dragOverFinance()
    expect(latest.current[1]?.roles).toHaveLength(1)

    cancel()
    expect(latest.current).toEqual(seededDraft())
  })

  // A role the org already has is never picked up in the first place, but the
  // handler is the last line of that invariant: it resolves the dragged id out
  // of the DRAFT, and a register row has no draft id at all.
  it("does nothing when the dragged id is not a proposed row", () => {
    render(<Harness />)
    act(() => {
      dnd.handlers.start?.({ active: { id: "role-r1" } })
      dnd.handlers.over?.({
        active: { id: "role-r1" },
        over: { id: "family-3" },
      })
      dnd.handlers.end?.({
        active: { id: "role-r1" },
        over: { id: "family-3" },
      })
    })
    expect(latest.current).toEqual(seededDraft())
    expect(screen.getByText("Developer")).toBeTruthy()
  })

  // The add-role control moved into the header (a prior row that used to
  // close every group is gone), so a family with no register roles and
  // nothing proposed for it is down to its header row alone. The whole tbody
  // is still the droppable, and dropping into it still has to land.
  it("still presents a drop surface for a family with nothing in it at all, and still receives a dropped role", () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: t.addFamily }))

    // Its own group, registered as a droppable, with nothing but the header
    // row: no register entry and no proposed role gave it a second row.
    expect(dnd.droppableIds).toContain("family-100")
    const group = dnd.droppableNodes.get("family-100")
    expect(group?.querySelectorAll("tr")).toHaveLength(1)

    pickUp()
    act(() => {
      dnd.handlers.over?.({
        active: { id: "role-2" },
        over: { id: "family-100" },
      })
    })
    act(() => {
      dnd.handlers.end?.({
        active: { id: "role-2" },
        over: { id: "family-100" },
      })
    })

    expect(latest.current.find((family) => family.id === 100)?.roles).toEqual([
      { id: 2, title: "Platform Engineer", trackKey: "IC" },
    ])
  })
})
