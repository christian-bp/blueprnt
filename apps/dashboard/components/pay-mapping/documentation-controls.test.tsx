import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", role: "admin" }),
}))

import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import {
  DocumentationBadges,
  documentationFor,
  DocumentationMenu,
} from "@/components/pay-mapping/documentation-controls"
import type {
  ActionTargetWire,
  PayMappingActionWire,
  PayMappingNoteWire,
} from "@/components/pay-mapping/pay-mapping-gap-types"

const m = messages.dashboard.payMapping.actions

const RUN_ID = "run-1" as Id<"payMappingRuns">

const GROUP_TARGET: ActionTargetWire = {
  kind: "group",
  scope: "equalWork",
  groupKey: "SWE|3|Senior",
}
const PERSON_TARGET: ActionTargetWire = {
  kind: "person",
  scope: "equalWork",
  groupKey: "SWE|3|Senior",
  personPublicId: "p1",
}

function action(
  overrides: Partial<PayMappingActionWire> = {}
): PayMappingActionWire {
  return {
    actionId: "a1" as Id<"payMappingActions">,
    target: GROUP_TARGET,
    number: 1,
    problem: "Gap",
    plannedAction: "Review",
    reason: null,
    ownerUserId: "u1",
    ownerName: "HR Person",
    plannedDate: Date.UTC(2026, 11, 1),
    estimatedCost: null,
    estimatedCostUnit: null,
    priority: "high",
    status: "notStarted",
    erased: false,
    createdAt: 1,
    ...overrides,
  }
}

function note(overrides: Partial<PayMappingNoteWire> = {}): PayMappingNoteWire {
  return {
    noteId: "n1" as Id<"payMappingNotes">,
    target: GROUP_TARGET,
    text: "Discuss",
    noteType: "discussionNeeded",
    erased: false,
    createdBy: "u1",
    createdByName: "HR Person",
    createdAt: 1,
    ...overrides,
  }
}

function renderWithIntl(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {node}
    </NextIntlClientProvider>
  )
}

describe("documentationFor", () => {
  it("keeps only the records anchored to exactly this target", () => {
    const own = documentationFor(
      GROUP_TARGET,
      [
        action(),
        action({
          actionId: "a2" as Id<"payMappingActions">,
          target: PERSON_TARGET,
        }),
      ],
      [
        note(),
        note({ noteId: "n2" as Id<"payMappingNotes">, target: PERSON_TARGET }),
      ]
    )
    expect(own.actions.map((a) => a.actionId)).toEqual(["a1"])
    expect(own.notes.map((n) => n.noteId)).toEqual(["n1"])
  })

  it("distinguishes two people in the same group", () => {
    const other: ActionTargetWire = { ...PERSON_TARGET, personPublicId: "p2" }
    const own = documentationFor(
      PERSON_TARGET,
      [
        action({ target: PERSON_TARGET }),
        action({ actionId: "a2" as Id<"payMappingActions">, target: other }),
      ],
      []
    )
    expect(own.actions.map((a) => a.actionId)).toEqual(["a1"])
  })

  it("matches a comparison on both keys, and treats an undefined work layer as empty", () => {
    // Both halves must match: a group is measured against many jobs, and a
    // reason written for one of them says nothing about the others.
    const comparison: ActionTargetWire = {
      kind: "comparison",
      groupKey: "Nurse|2|Mid",
      comparisonKey: "Support|3|Junior",
    }
    const otherJob: ActionTargetWire = {
      kind: "comparison",
      groupKey: "Nurse|2|Mid",
      comparisonKey: "IT|3|Mid",
    }
    const own = documentationFor(
      comparison,
      [
        action({ target: comparison }),
        action({ actionId: "a2" as Id<"payMappingActions">, target: otherJob }),
      ],
      undefined
    )
    expect(own.actions.map((a) => a.actionId)).toEqual(["a1"])
    expect(own.notes).toEqual([])
  })
})

describe("DocumentationBadges", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders nothing when the target has no documentation", () => {
    const { container } = renderWithIntl(
      <DocumentationBadges actions={[]} notes={[]} />
    )
    expect(container.textContent).toBe("")
  })

  it("leads with the LEAST advanced action status (is this handled yet?)", () => {
    renderWithIntl(
      <DocumentationBadges
        actions={[action({ status: "done" }), action({ status: "inProgress" })]}
        notes={[]}
      />
    )
    expect(screen.getByText(m.status.inProgress)).toBeDefined()
    expect(screen.queryByText(m.status.done)).toBeNull()
  })

  it("counts notes in their own chip", () => {
    renderWithIntl(
      <DocumentationBadges actions={[]} notes={[note(), note()]} />
    )
    expect(screen.getByText("2 notes")).toBeDefined()
  })
})

describe("DocumentationMenu", () => {
  afterEach(() => {
    cleanup()
  })

  function renderMenu(
    overrides: Partial<Parameters<typeof DocumentationMenu>[0]> = {}
  ) {
    return renderWithIntl(
      <DocumentationMenu
        runId={RUN_ID}
        target={GROUP_TARGET}
        targetLabel="SWE · Senior"
        actions={[]}
        notes={[]}
        currency="SEK"
        locked={false}
        {...overrides}
      />
    )
  }

  it("offers create items for an undocumented target", () => {
    renderMenu()
    fireEvent.click(
      screen.getByRole("button", {
        name: m.menuLabel.replace("{target}", "SWE · Senior"),
      })
    )
    expect(screen.getByText(m.createTitle)).toBeDefined()
    expect(screen.getByText(m.createNoteTitle)).toBeDefined()
    // Nothing to delete yet.
    expect(screen.queryByText(m.deleteAction)).toBeNull()
  })

  it("switches to edit + delete once the target carries an action", () => {
    renderMenu({ actions: [action()] })
    fireEvent.click(
      screen.getByRole("button", {
        name: m.menuLabel.replace("{target}", "SWE · Senior"),
      })
    )
    expect(screen.getByText(m.editTitle)).toBeDefined()
    expect(screen.getByText(m.deleteAction)).toBeDefined()
  })

  it("disables every item on a locked (completed) run", () => {
    renderMenu({ actions: [action()], locked: true })
    fireEvent.click(
      screen.getByRole("button", {
        name: m.menuLabel.replace("{target}", "SWE · Senior"),
      })
    )
    for (const label of [m.editTitle, m.createNoteTitle, m.deleteAction]) {
      const item = screen.getByText(label).closest('[role="menuitem"]')
      expect(item?.getAttribute("data-disabled")).not.toBeNull()
    }
  })
})
