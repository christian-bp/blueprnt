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
  gestureId?: string
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

// Every fixture below carries a REAL payload whose detail resolves to a
// distinctive string. An empty payload renders an empty details cell, which
// makes "the details cell is blank" indistinguishable from "the details cell
// was suppressed", and a test written against it cannot fail.
const LEAD_DETAIL = "Scope and impact"
const LONE_DETAIL = "Data Engineer"
const SOLO_DETAIL = "Platform Engineer"

// The compliance dialog's three-call gesture, newest-first as the log serves
// it: the re-approval finished the act, the write is in the middle, the
// reopening started it. Mixed types, so the lead really is the row that names
// the act and its detail belongs on the story's face.
const GESTURE_ROWS = [
  row({
    id: "r1",
    type: "criterion.approved",
    gestureId: "g1",
    payload: { criterionId: "c1" },
    names: { c1: LEAD_DETAIL },
  }),
  row({ id: "r2", type: "model.updated", gestureId: "g1" }),
  row({ id: "r3", type: "criterion.reopened", gestureId: "g1" }),
]
const LONE_ROW = row({
  id: "r4",
  type: "role.created",
  category: "role",
  payload: { roleId: "role-9" },
  names: { "role-9": LONE_DETAIL },
})

let browseRows: Row[] = []
let searchRows: Row[] | null = null
// The first-load state, where the browse query has not answered yet.
let loading = false

onQuery((ref) => {
  if (ref === "accounts.audit.getAuditLogPage") {
    if (loading) return undefined
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

// The one story on a page. Each story's toggle names its OWN gesture, so the
// label is composed from the lead's action and the count rather than shared.
function storyLabel(action: string, count: number) {
  return log.story.toggleNamed
    .replace("{count}", String(count))
    .replace("{action}", action)
}

function storyRow() {
  return screen.getByRole("button", {
    name: storyLabel(log.events.criterionApproved, 3),
  })
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
    loading = false
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
    expect(
      screen.queryByRole("button", {
        name: storyLabel(log.events.roleCreated, 1),
      })
    ).toBeNull()
    const [only] = dataRows()
    expect(only?.getAttribute("aria-label")).toBe(log.detail.viewDetails)
    expect(only?.textContent).toContain(log.events.roleCreated)
    expect(only?.textContent).toContain(LONE_DETAIL)
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

  // THE BULK CASE. assignPeopleToRole writes one assignment.set row PER
  // PERSON, so a 25-person classify confirm is 25 rows of one type sharing one
  // gesture id. Every row ties on specificity, so the "lead" is just the first
  // row, and its own detail is ONE employee's role change with their name
  // resolved. Rendering that as the story's face reads as a claim about that
  // person on behalf of the other twenty-four. The event label and the count
  // carry the summary instead, and no employee's name appears on it.
  it("headlines a bulk story by its event and count, never by one person's name", () => {
    browseRows = Array.from({ length: 25 }, (_, index) =>
      row({
        id: `p${index}`,
        type: "assignment.set",
        category: "people",
        gestureId: "bulk-1",
        payload: { personId: `person-${index}`, roleId: "role-1" },
        names: {
          [`person-${index}`]: `Employee ${index}`,
          "role-1": "Analyst",
        },
      })
    )
    renderLog()
    const summary = screen.getByRole("button", {
      name: storyLabel(log.events.assignmentSet, 25),
    })
    expect(summary.textContent).toContain(log.events.assignmentSet)
    expect(summary.textContent).toContain(
      log.story.count.replace("{count}", "25")
    )
    // Not one employee, and not one role either: nothing from a single row's
    // own detail is on the story's face.
    for (let index = 0; index < 25; index++) {
      expect(summary.textContent).not.toContain(`Employee ${index}`)
    }
    expect(summary.textContent).not.toContain("Analyst")
  })

  // The mixed story keeps its lead's DETAIL, not merely its action label: the
  // label is on the row either way, so asserting it cannot tell a kept detail
  // from a suppressed one. Suppressing detail everywhere has to fail here.
  it("keeps the lead's detail on a story whose rows differ", () => {
    renderLog()
    expect(storyRow().textContent).toContain(LEAD_DETAIL)
  })

  // The other half of the same guard: the suppression is scoped to a story
  // SUMMARY. An ordinary row is a story of one and is uniform by definition,
  // so a check that forgot to ask whether this is a summary at all would blank
  // the details column on every row in the log.
  it("keeps the detail on an ordinary row, which is a uniform story of one", () => {
    browseRows = [LONE_ROW]
    renderLog()
    const [only] = dataRows()
    expect(only?.textContent).toContain(LONE_DETAIL)
  })

  // A gesture that ended up writing ONE row is still a story of one: it renders
  // as a plain row, with its detail, exactly like a row that carries no gesture
  // id at all. Pinned with an id present, because the ordinary-row test above
  // uses a row without one and so pins nothing about this branch.
  it("renders a one-row gesture as a plain row, detail and all", () => {
    browseRows = [
      row({
        id: "solo",
        type: "role.created",
        category: "role",
        gestureId: "22222222-3333-4444-5555-666666666666",
        payload: { roleId: "role-7" },
        names: { "role-7": SOLO_DETAIL },
      }),
    ]
    renderLog()
    const [only] = dataRows()
    expect(only?.getAttribute("aria-label")).toBe(log.detail.viewDetails)
    expect(only?.textContent).toContain(SOLO_DETAIL)
  })

  // The skeleton must MEASURE like a data row, not merely look like one. The
  // action cell leads with a fixed chevron box on every row, so a skeleton
  // without it jumps the action text its width to the right on the swap.
  it("reserves the action cell's chevron box in the loading skeleton", () => {
    browseRows = []
    loading = true
    renderLog()
    const cells = container.querySelectorAll("tbody tr:first-child td")
    const action = cells[3]
    expect(action).toBeDefined()
    expect(action?.querySelector(".size-4")).not.toBeNull()
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
    expect(
      screen.queryByRole("button", {
        name: storyLabel(log.events.criterionApproved, 3),
      })
    ).toBeNull()
    expect(dataRows()).toHaveLength(3)
  })
})
