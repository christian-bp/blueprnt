import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// NumberFlow's custom element does not exist in jsdom. The summary strip
// formats its cost roll-up through NumberFlow's format prop, so the stand-in
// formats too instead of dumping the raw number.
vi.mock("@number-flow/react", () => ({
  default: ({
    value,
    format,
    locales,
  }: {
    value: number
    format?: Intl.NumberFormatOptions
    locales?: string | string[]
  }) => (
    <span>{new Intl.NumberFormat(locales ?? "en", format).format(value)}</span>
  ),
}))

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
vi.mock("next/navigation", () => ({
  usePathname: () => "/pay-mappings/2026/actions",
}))

import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { PayMappingActionsOverview } from "@/components/pay-mapping/actions-overview"
import type {
  PayMappingActionWire,
  PayMappingGapResult,
  PayMappingNoteWire,
  PayMappingRunDetail,
} from "@/components/pay-mapping/pay-mapping-gap-types"
import { PayMappingRunProvider } from "@/components/pay-mapping/pay-mapping-run-context"
import { mockMutation } from "@/test/convex-mocks"
import { pickSelectOption } from "@/test/select"
import {
  makeExcluded,
  makeGapGroup,
  makeRunDetail,
} from "@/test/pay-mapping-fixtures"
import { toast } from "@/lib/toast"

const m = messages.dashboard.payMapping.actions
const mo = messages.dashboard.payMapping.actionsOverview
const tToast = messages.dashboard.toast

const setStatus = mockMutation("payMapping.actions.setActionStatus")

const RUN: PayMappingRunDetail = makeRunDetail({
  runId: "run-1" as Id<"payMappingRuns">,
  label: "2026",
})

const GAP: PayMappingGapResult = {
  currency: "SEK",
  org: {
    womenCount: 1,
    menCount: 1,
    womenMeanComp: 90000,
    menMeanComp: 100000,
    gapPct: 10,
    flag: "elevated",
  },
  equalWork: [makeGapGroup()],
  excluded: makeExcluded(),
  equivalentWork: [],
  womenDominated: [],
  population: { women: 1, men: 1 },
  quartiles: [
    { women: 0, men: 0 },
    { women: 0, men: 0 },
    { women: 0, men: 0 },
    { women: 0, men: 0 },
  ],
}

function action(
  overrides: Partial<PayMappingActionWire> = {}
): PayMappingActionWire {
  return {
    actionId: "a1" as Id<"payMappingActions">,
    target: { kind: "group", scope: "equalWork", groupKey: "SWE|3" },
    problem: "Unexplained gap",
    plannedAction: "Salary review",
    reason: null,
    ownerUserId: "u1",
    ownerName: "Alice Admin",
    // Two weeks after the run's reference date: inside the 30-day window.
    plannedDate: Date.UTC(2026, 6, 15),
    estimatedCost: 40000,
    priority: "high",
    status: "notStarted",
    createdAt: 1,
    ...overrides,
  }
}

function note(overrides: Partial<PayMappingNoteWire> = {}): PayMappingNoteWire {
  return {
    noteId: "n1" as Id<"payMappingNotes">,
    target: { kind: "group", scope: "equalWork", groupKey: "SWE|3" },
    text: "Discuss with the union",
    noteType: "discussionNeeded",
    createdBy: "u1",
    createdByName: "Alice Admin",
    createdAt: Date.UTC(2026, 6, 2),
    ...overrides,
  }
}

function renderOverview(
  overrides: Partial<{
    run: PayMappingRunDetail | undefined
    actions: PayMappingActionWire[] | undefined
    notes: PayMappingNoteWire[] | undefined
  }> = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PayMappingRunProvider
        value={{
          run: "run" in overrides ? overrides.run : RUN,
          gap: GAP,
          analyses: [],
          actions: "actions" in overrides ? overrides.actions : [action()],
          notes: "notes" in overrides ? overrides.notes : [note()],
          runsList: [],
        }}
      >
        <PayMappingActionsOverview />
      </PayMappingRunProvider>
    </NextIntlClientProvider>
  )
}

// Row texts of the actions table (the first table on the page).
function actionRowTexts(): string[] {
  const tables = screen.getAllByRole("table")
  const table = tables[0]
  if (table === undefined) return []
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.textContent ?? "")
}

describe("PayMappingActionsOverview", () => {
  beforeEach(() => {
    setStatus.mockReset()
    setStatus.mockResolvedValue(null)
    vi.mocked(toast.success).mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("shows a content-shaped skeleton while the run is loading", () => {
    const { container } = renderOverview({ run: undefined })
    // The page keeps its real structure while loading: the summary strip's
    // labels, the real filter toolbar, and both tables with their headers.
    // "Actions" labels both the summary count and the table heading.
    expect(screen.getAllByText(mo.totalLabel).length).toBeGreaterThan(0)
    expect(screen.getByLabelText(mo.statusAll)).toBeDefined()
    const tables = screen.getAllByRole("table")
    expect(tables).toHaveLength(2)
    // The skeleton shows a full page of rows (the pager's own PAGE_SIZE),
    // so the table never grows when the first page arrives.
    const first = tables[0]
    expect(
      first === undefined ? 0 : within(first).getAllByRole("row").length
    ).toBe(1 + 25)
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(10)
  })

  it("paginates the actions table past one page and resets on a filter change", async () => {
    const many = Array.from({ length: 26 }, (_, index) =>
      action({
        actionId: `a${index}` as Id<"payMappingActions">,
        problem: `Problem ${index}`,
      })
    )
    renderOverview({ actions: many })
    expect(actionRowTexts()).toHaveLength(25)
    fireEvent.click(
      screen.getByLabelText(messages.dashboard.payMapping.toolbar.next)
    )
    await waitFor(() => {
      expect(actionRowTexts()).toHaveLength(1)
    })
    // Narrowing from page 2 goes back to page 1 of the narrowed list.
    await pickSelectOption(
      screen.getByLabelText(mo.priorityAll),
      m.priority.high
    )
    await waitFor(() => {
      expect(actionRowTexts()).toHaveLength(25)
    })
  })

  it("summarizes counts and rolls up the estimated cost", () => {
    renderOverview({
      actions: [
        action(),
        action({
          actionId: "a2" as Id<"payMappingActions">,
          status: "done",
          estimatedCost: 10000,
        }),
      ],
    })
    // "Actions" labels both the summary count and the table section, so
    // assert on the roll-up figure itself: 40 000 + 10 000 in the run's own
    // currency.
    expect(screen.getByText(mo.costLabel)).toBeDefined()
    expect(screen.getByText(/50,000/)).toBeDefined()
  })

  it("guides to the analysis when nothing is documented yet", () => {
    renderOverview({ actions: [], notes: [] })
    expect(screen.getByText(mo.emptyTitle)).toBeDefined()
    expect(
      screen.getByRole("link", { name: mo.emptyCta }).getAttribute("href")
      // The section has no page of its own, so a bare link goes to the
      // first chapter rather than through a redirect.
    ).toBe("/pay-mappings/2026/analysis/start")
    // No filter toolbar when there is nothing to filter.
    expect(screen.queryByLabelText(mo.statusAll)).toBeNull()
  })

  it("lists an action with its owner, group link, planned action and date", () => {
    renderOverview()
    const rows = actionRowTexts()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toContain("Alice Admin")
    expect(rows[0]).toContain("SWE")
    expect(rows[0]).toContain("Unexplained gap")
    // The planned action rides under the problem in the same cell.
    expect(rows[0]).toContain("Salary review")
    // Every "linked to" cell deep-links to the record's OWN group, on the
    // page that lists it. Chapters are pages since Iteration 4, so a link
    // to the section index would land on Läget, which lists no steps, and
    // open nothing.
    expect(
      screen.getAllByRole("link", { name: "SWE" })[0]?.getAttribute("href")
    ).toBe("/pay-mappings/2026/analysis/equal-work?step=equalWork:SWE%7C3")
  })

  it("narrows the list by status and says so when nothing matches", async () => {
    renderOverview()
    await pickSelectOption(screen.getByLabelText(mo.statusAll), m.status.done)
    await waitFor(() => {
      expect(screen.getByText(mo.noMatches)).toBeDefined()
    })
  })

  it("updates a status inline and toasts", async () => {
    renderOverview()
    await pickSelectOption(
      screen.getByLabelText(mo.columns.status),
      m.status.inProgress
    )
    await waitFor(() => {
      expect(setStatus).toHaveBeenCalled()
    })
    const args = setStatus.mock.calls[0]?.[0] as Record<string, unknown>
    expect(args.actionId).toBe("a1")
    expect(args.status).toBe("inProgress")
    expect(toast.success).toHaveBeenCalledWith(
      tToast.payMappingActionStatusChanged
    )
  })

  it("row menus see the target's existing note, so they edit instead of duplicating", async () => {
    // The default fixtures share one target: the action row's menu must
    // read the note that already exists there ("Edit note"), never offer a
    // second "Add note".
    renderOverview()
    fireEvent.click(
      screen.getByRole("button", {
        name: m.menuLabel.replace("{target}", "SWE"),
      })
    )
    await waitFor(() => {
      expect(screen.getByText(m.editNoteTitle)).toBeDefined()
    })
    expect(screen.queryByText(m.createNoteTitle)).toBeNull()
  })

  it("says notes do not exist yet rather than blaming the filters", () => {
    renderOverview({ notes: [] })
    expect(screen.getByText(mo.noNotesYet)).toBeDefined()
    expect(screen.queryByText(mo.noNotes)).toBeNull()
  })

  it("lists notes separately, flagging how many need further discussion", () => {
    renderOverview()
    expect(
      screen.getByRole("heading", { name: new RegExp(mo.notesHeading) })
    ).toBeDefined()
    expect(
      screen.getByText(mo.discussionCount.replace("{count}", "1"))
    ).toBeDefined()
    expect(screen.getByText("Discuss with the union")).toBeDefined()
  })
})
