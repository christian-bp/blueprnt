import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock("@workspace/backend/convex/_generated/api", async () => ({
  ...(await import("@/test/convex-mocks")).apiModule,
  // Something in the section's import chain reaches for the component handles
  // (the audit aggregates). They are never called here; the shape only has to
  // exist so the module resolves.
  components: {},
}))
// The digit animation is the library's business, and its custom element does
// not exist in jsdom: an updating count throws out of the whole tree.
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}))
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: "admin" }),
}))

import { OrgAuditLogSection } from "@/components/org-audit-log-section"
import { onQuery } from "@/test/convex-mocks"

const log = messages.dashboard.auditLog

type Row = {
  id: string
  at: number
  actorId: string
  actorName: string
  type: string
  category?: string
  batchId?: string
  payload: unknown
  names: Record<string, string>
}

function row(overrides: Partial<Row> & { id: string; type: string }): Row {
  return {
    at: Date.UTC(2026, 7, 23, 9, 0),
    actorId: "u1",
    actorName: "Alex Berg",
    category: "model",
    payload: {},
    names: {},
    ...overrides,
  }
}

// The compliance dialog's three-call gesture, newest-first as the log serves
// it: the re-approval finished the act, the write is in the middle, the
// reopening started it.
const GESTURE_ROWS = [
  row({ id: "r1", type: "criterion.approved", batchId: "g1" }),
  row({ id: "r2", type: "model.updated", batchId: "g1" }),
  row({ id: "r3", type: "criterion.reopened", batchId: "g1" }),
]
const LONE_ROW = row({ id: "r4", type: "role.created", category: "role" })

let browseRows: Row[] = []
let searchRows: Row[] | null = null

onQuery((ref) => {
  if (ref === "accounts.audit.getAuditLogPage") {
    return { rows: browseRows, total: browseRows.length }
  }
  if (ref === "accounts.audit.searchAuditLog") {
    return searchRows === null ? undefined : { rows: searchRows }
  }
  return undefined
})

let container: HTMLElement

function renderLog() {
  const result = render(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={messages}>
      <OrgAuditLogSection />
    </NextIntlClientProvider>
  )
  container = result.container
  return result
}

function storyRow() {
  return screen.getByRole("button", { name: log.story.toggle })
}

// Every clickable line of the log. Queried by attribute rather than by the
// "row" role, because these rows carry role="button" (they open the detail
// sheet or a story), which replaces the implicit row role.
function dataRows() {
  return [...container.querySelectorAll('tr[tabindex="0"]')]
}

describe("OrgAuditLogSection stories", () => {
  beforeEach(() => {
    browseRows = [...GESTURE_ROWS, LONE_ROW]
    searchRows = null
  })
  afterEach(() => cleanup())

  it("folds one gesture's rows into a single collapsed story row", () => {
    renderLog()
    // Four rows of data, three of them one gesture: two lines on screen.
    expect(dataRows()).toHaveLength(2)
    expect(
      screen.getByText(log.story.count.replace("{count}", "3"))
    ).toBeTruthy()
    // Collapsed: the gesture's other events are not on screen.
    expect(screen.queryByText(log.events.modelUpdated)).toBeNull()
  })

  it("summarizes the story with its own event, not a generic word", () => {
    renderLog()
    expect(storyRow().textContent).toContain(log.events.criterionApproved)
  })

  it("opens the gesture's own rows, and closes them again", () => {
    renderLog()
    expect(storyRow().getAttribute("aria-expanded")).toBe("false")
    fireEvent.click(storyRow())
    expect(storyRow().getAttribute("aria-expanded")).toBe("true")
    // The summary, the gesture's three rows, and the lone row.
    expect(dataRows()).toHaveLength(5)
    expect(screen.getByText(log.events.modelUpdated)).toBeTruthy()
    fireEvent.click(storyRow())
    expect(dataRows()).toHaveLength(2)
  })

  it("leaves a single-mutation act as an ordinary row", () => {
    browseRows = [LONE_ROW]
    renderLog()
    expect(screen.queryByRole("button", { name: log.story.toggle })).toBeNull()
    const [only] = dataRows()
    expect(only?.getAttribute("aria-label")).toBe(log.detail.viewDetails)
    expect(only?.textContent).toContain(log.events.roleCreated)
  })

  // The aggregates count ROWS, so a three-row story pages as three. The count
  // beside the title is the row total, never a story total.
  it("counts rows, not stories, in the total", () => {
    renderLog()
    // The panel's count chip is the aggregates' ROW total. Four rows, three of
    // which read as one story on screen, still count as four: the aggregates
    // count rows and the pager pages rows, which is what keeps jump-to-page
    // O(log n). A story is a way of READING a page, not a unit of paging.
    const chip = container.querySelector('[data-slot="badge"]')
    expect(chip?.textContent).toContain("4")
    expect(dataRows()).toHaveLength(2)
  })

  // A search shows the rows that MATCHED; folding one into a story would hide
  // the hit inside a collapsed summary, or imply that its unmatched siblings
  // matched too. The search input debounces, so this waits it out.
  it("groups nothing in search results", async () => {
    searchRows = GESTURE_ROWS
    renderLog()
    fireEvent.change(screen.getByPlaceholderText(log.search.placeholder), {
      target: { value: "compliance" },
    })
    // The search input debounces by 300ms before its query fires.
    await new Promise((resolve) => setTimeout(resolve, 500))
    await waitFor(() => {
      expect(screen.getByText(log.events.modelUpdated)).toBeTruthy()
    })
    expect(screen.queryByRole("button", { name: log.story.toggle })).toBeNull()
    expect(dataRows()).toHaveLength(3)
  })
})
