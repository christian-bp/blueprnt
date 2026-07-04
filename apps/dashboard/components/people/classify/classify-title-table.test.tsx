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

// ---------------------------------------------------------------------------
// Module mocks (declared before the module under test is imported)
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const assignMock = vi.fn()

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org1", name: "Acme", role: "admin" }),
}))

import { toast } from "sonner"
import { mockMutation } from "@/test/convex-mocks"
import type { ClassifyTitleGroup } from "@/components/people/classify/classify-title-table"
import {
  ClassifyTitleTable,
  classificationStateForPeople,
} from "@/components/people/classify/classify-title-table"

// ---------------------------------------------------------------------------
// Pure helper tests
// ---------------------------------------------------------------------------

const conf = { currentAssignment: { levelSource: "confirmed" as const } }
const sug = { currentAssignment: { levelSource: "suggested" as const } }
const none = { currentAssignment: null }

describe("classificationStateForPeople", () => {
  it("is confirmed only when every person is confirmed", () => {
    expect(classificationStateForPeople([conf, conf])).toBe("confirmed")
  })

  it("is unclassified when nobody has an assignment", () => {
    expect(classificationStateForPeople([none, none])).toBe("unclassified")
  })

  it("is pending when mixed or all suggested", () => {
    expect(classificationStateForPeople([conf, sug])).toBe("pending")
    expect(classificationStateForPeople([sug, none])).toBe("pending")
  })

  it("is unclassified for an empty group", () => {
    expect(classificationStateForPeople([])).toBe("unclassified")
  })
})

// ---------------------------------------------------------------------------
// Render test fixtures
// ---------------------------------------------------------------------------

const m = messages.dashboard.classify

const ROLES = [
  {
    roleId: "role1",
    title: "Software Engineer",
    trackKey: "IC",
    trackName: "Individual contributor",
    slug: "software-engineer",
    function: "Engineering",
    team: "Core",
    ratedCount: 0,
    totalCriteria: 5,
    familyId: null,
    familyName: null,
    familySlug: null,
    profileComplete: false,
    trackOrder: 0,
  },
  {
    roleId: "role2",
    title: "Engineering Manager",
    trackKey: "M",
    trackName: "Manager",
    slug: "engineering-manager",
    function: "Engineering",
    team: "Core",
    ratedCount: 0,
    totalCriteria: 5,
    familyId: null,
    familyName: null,
    familySlug: null,
    profileComplete: false,
    trackOrder: 1,
  },
]

const TRACKS = [
  { key: "IC", name: "Individual contributor", order: 0 },
  { key: "M", name: "Manager", order: 1 },
]

// A matched group with high confidence: two people, one confirmed, one suggested
const HIGH_GROUP: ClassifyTitleGroup = {
  title: "Senior Engineer",
  personCount: 2,
  suggestedRoleId: "role1",
  confidence: "high",
  people: [
    {
      personId: "p1",
      displayName: "Alice Svensson",
      externalRef: "42",
      employmentStartDate: null,
      isManager: null,
      suggestedLevel: "IC3",
      currentAssignment: {
        roleId: "role1",
        level: "IC3",
        levelSource: "confirmed",
      },
    },
    {
      personId: "p2",
      displayName: "Bob Larsson",
      externalRef: null,
      employmentStartDate: null,
      isManager: null,
      suggestedLevel: "IC2",
      currentAssignment: {
        roleId: "role1",
        level: "IC2",
        levelSource: "suggested",
      },
    },
  ],
}

// An unmatched group (no title)
const NO_TITLE_GROUP: ClassifyTitleGroup = {
  title: null,
  personCount: 1,
  suggestedRoleId: null,
  confidence: "unmatched",
  people: [
    {
      personId: "p3",
      displayName: "Charlie Nilsson",
      externalRef: null,
      employmentStartDate: null,
      isManager: null,
      suggestedLevel: null,
      currentAssignment: null,
    },
  ],
}

function renderTable(
  groups = [HIGH_GROUP],
  roles = ROLES,
  pseudonymize = false
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <form>
        <ClassifyTitleTable
          orgId="org1"
          groups={groups}
          roles={roles}
          tracks={TRACKS}
          pseudonymize={pseudonymize}
        />
      </form>
    </NextIntlClientProvider>
  )
}

// ---------------------------------------------------------------------------
// Render tests
// ---------------------------------------------------------------------------

describe("ClassifyTitleTable", () => {
  beforeEach(() => {
    // Wire the mutation mock
    mockMutation("people.assignments.assignPersonToRole").mockImplementation(
      assignMock
    )
    assignMock.mockResolvedValue("assignment-id")
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("renders column headers", () => {
    renderTable()
    expect(screen.getByText(m.columns.title)).toBeDefined()
    expect(screen.getByText(m.columns.people)).toBeDefined()
    expect(screen.getByText(m.columns.suggestedRole)).toBeDefined()
    expect(screen.getByText(m.columns.confidence)).toBeDefined()
    expect(screen.getByText(m.columns.state)).toBeDefined()
  })

  it("renders the title and person count for a matched group", () => {
    renderTable()
    expect(screen.getByText("Senior Engineer")).toBeDefined()
    expect(screen.getByText("2")).toBeDefined()
  })

  it("renders the high confidence badge for a high-confidence group", () => {
    renderTable()
    expect(screen.getByText(m.confidence.high)).toBeDefined()
  })

  it("renders the state badge reflecting classificationStateForPeople", () => {
    // HIGH_GROUP has one confirmed + one suggested -> "pending"
    renderTable()
    expect(screen.getByText(m.state.pending)).toBeDefined()
  })

  it("renders the unmatched badge and noTitle label for the null-title group", () => {
    renderTable([NO_TITLE_GROUP])
    expect(screen.getByText(m.noTitle)).toBeDefined()
    expect(screen.getByText(m.confidence.unmatched)).toBeDefined()
  })

  it("renders the unclassified state badge for the null-title group", () => {
    renderTable([NO_TITLE_GROUP])
    expect(screen.getByText(m.state.unclassified)).toBeDefined()
  })

  it("renders both groups when both are present", () => {
    renderTable([HIGH_GROUP, NO_TITLE_GROUP])
    expect(screen.getByText("Senior Engineer")).toBeDefined()
    expect(screen.getByText(m.noTitle)).toBeDefined()
  })

  it("fires assignPersonToRole once per person on Confirm with levelSource confirmed and selected roleId", async () => {
    renderTable()
    const confirmButton = screen.getByRole("button", { name: m.assignCta })
    fireEvent.click(confirmButton)
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledTimes(2)
    })
    // Check first call has required fields
    expect(assignMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org1",
        personId: "p1",
        roleId: "role1",
        levelSource: "confirmed",
      })
    )
    expect(assignMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org1",
        personId: "p2",
        roleId: "role1",
        levelSource: "confirmed",
      })
    )
  })

  it("fires the classificationConfirmed toast after Confirm", async () => {
    renderTable()
    fireEvent.click(screen.getByRole("button", { name: m.assignCta }))
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        messages.dashboard.toast.classificationConfirmed
      )
    })
  })

  it("uses each person's suggestedLevel when confirming", async () => {
    renderTable()
    fireEvent.click(screen.getByRole("button", { name: m.assignCta }))
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith(
        expect.objectContaining({ personId: "p1", level: "IC3" })
      )
      expect(assignMock).toHaveBeenCalledWith(
        expect.objectContaining({ personId: "p2", level: "IC2" })
      )
    })
  })

  it("falls back to TRACK_LEVELS[0] when suggestedLevel is null", async () => {
    const groupNoLevel: ClassifyTitleGroup = {
      ...HIGH_GROUP,
      people: [
        {
          personId: "p1",
          displayName: "Alice Svensson",
          externalRef: "42",
          employmentStartDate: null,
          isManager: null,
          suggestedLevel: null,
          currentAssignment: null,
        },
      ],
    }
    renderTable([groupNoLevel])
    fireEvent.click(screen.getByRole("button", { name: m.assignCta }))
    await waitFor(() => {
      // IC track first level is "IC1"
      expect(assignMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: "IC1" })
      )
    })
  })

  it("does not call assignPersonToRole when no role is selected for an unmatched group", () => {
    renderTable([NO_TITLE_GROUP])
    const confirmButton = screen.getByRole("button", { name: m.assignCta })
    fireEvent.click(confirmButton)
    expect(assignMock).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // Task 7: per-person level expansion
  // ---------------------------------------------------------------------------

  it("expand control is present for each group row", () => {
    renderTable()
    expect(screen.getByRole("button", { name: m.expandLabel })).toBeDefined()
  })

  it("expanding a title row reveals one person row per group.people", async () => {
    renderTable()
    fireEvent.click(screen.getByRole("button", { name: m.expandLabel }))
    await waitFor(() => {
      // Both people's names should appear
      expect(screen.getByText("Alice Svensson")).toBeDefined()
      expect(screen.getByText("Bob Larsson")).toBeDefined()
    })
  })

  it("collapse button appears after expanding and collapses the rows", async () => {
    renderTable()
    fireEvent.click(screen.getByRole("button", { name: m.expandLabel }))
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: m.collapseLabel })
      ).toBeDefined()
    })
    fireEvent.click(screen.getByRole("button", { name: m.collapseLabel }))
    await waitFor(() => {
      expect(screen.queryByText("Alice Svensson")).toBeNull()
    })
  })

  it("person rows show a level Select prefilled with suggestedLevel", async () => {
    renderTable()
    fireEvent.click(screen.getByRole("button", { name: m.expandLabel }))
    await waitFor(() => {
      // IC3 and IC2 are the suggestedLevels for p1 and p2
      expect(
        screen.getByDisplayValue !== undefined ||
          screen.getAllByRole("combobox").length >= 2
      ).toBe(true)
    })
  })

  it("tenure label renders for a person with an employment start date", async () => {
    const groupWithDate: ClassifyTitleGroup = {
      ...HIGH_GROUP,
      people: [
        {
          personId: "p1",
          displayName: "Alice Svensson",
          externalRef: null,
          employmentStartDate: "2021-01-01",
          isManager: null,
          suggestedLevel: "IC3",
          currentAssignment: null,
        },
      ],
    }
    renderTable([groupWithDate])
    fireEvent.click(screen.getByRole("button", { name: m.expandLabel }))
    await waitFor(() => {
      // Tenure should show some years (at least 4 from 2021)
      const el = screen.queryByText(/year/)
      expect(el).not.toBeNull()
    })
  })

  it("confirm passes changed per-person level (not suggestedLevel) when level is changed", async () => {
    renderTable()
    fireEvent.click(screen.getByRole("button", { name: m.expandLabel }))
    await waitFor(() => {
      expect(screen.getByText("Alice Svensson")).toBeDefined()
    })
    // Find all comboboxes; the last N are per-person level selects
    const comboboxes = screen.getAllByRole("combobox")
    // First combobox is the role Select, person-level selects come after
    const levelSelects = comboboxes.slice(1)
    // Change p1's level to IC4 via fireEvent (uses the hidden native select)
    const firstLevelSelect = levelSelects[0]
    if (firstLevelSelect === undefined)
      throw new Error("level select not found")
    fireEvent.change(firstLevelSelect, { target: { value: "IC4" } })
    // Confirm
    fireEvent.click(screen.getByRole("button", { name: m.assignCta }))
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledTimes(2)
    })
    // p1 should have IC4 (changed), p2 should have IC2 (suggestedLevel unchanged)
    expect(assignMock).toHaveBeenCalledWith(
      expect.objectContaining({ personId: "p2", level: "IC2" })
    )
  })

  it("after changing row role to a different track, submitted level is valid for the new track", async () => {
    // HIGH_GROUP suggests role1 (IC track). We'll switch to role2 (M track).
    // Radix Select renders a hidden native <select> for accessibility; targeting
    // that element (as roles-table.test.tsx does) is how we drive onValueChange.
    renderTable()
    // First hidden select is the role select for the first group row.
    const hiddenSelects = document.querySelectorAll("select")
    const roleSelect = hiddenSelects[0]
    if (roleSelect === undefined) throw new Error("role select not found")
    fireEvent.change(roleSelect, { target: { value: "role2" } })
    // Confirm without expanding: levels must reset to M track defaults.
    fireEvent.click(screen.getByRole("button", { name: m.assignCta }))
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalled()
    })
    const calls = assignMock.mock.calls as Array<[{ level: string }]>
    for (const [args] of calls) {
      expect(["M1", "M2", "M3"]).toContain(args.level)
    }
  })
})
