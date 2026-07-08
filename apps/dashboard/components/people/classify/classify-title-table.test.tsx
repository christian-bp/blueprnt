import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { pickSelectOption } from "@/test/select"
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

// Base UI Selects are driven through their popup listbox: open the labeled
// trigger and commit an option. Triggers share per-column labels, so pick
// by index (role selects come one per group row; level selects one per
// person row after expanding).
async function pickRole(title: string, index = 0) {
  const trigger = screen.getAllByRole("combobox", { name: m.columns.role })[
    index
  ] as HTMLElement
  await pickSelectOption(trigger, title)
}
async function pickLevel(level: string, index: number) {
  const trigger = screen.getAllByRole("combobox", { name: m.levelLabel })[
    index
  ] as HTMLElement
  await pickSelectOption(trigger, level)
}

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

// A matched group: two people, one confirmed, one suggested
const HIGH_GROUP: ClassifyTitleGroup = {
  title: "Senior Engineer",
  personCount: 2,
  suggestedRoleId: "role1",
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

// An unmatched group (no title, no resolvable role)
const NO_TITLE_GROUP: ClassifyTitleGroup = {
  title: null,
  personCount: 1,
  suggestedRoleId: null,
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
    mockMutation("people.assignments.assignPeopleToRole").mockImplementation(
      assignMock
    )
    assignMock.mockResolvedValue(["assignment-id"])
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("renders column headers", () => {
    renderTable()
    expect(screen.getByText(m.columns.title)).toBeDefined()
    expect(screen.getByText(m.columns.people)).toBeDefined()
    expect(screen.getByText(m.columns.role)).toBeDefined()
    expect(screen.getByText(m.columns.state)).toBeDefined()
  })

  it("renders the title and person count for a matched group", () => {
    renderTable()
    expect(screen.getByText("Senior Engineer")).toBeDefined()
    expect(screen.getByText("2")).toBeDefined()
  })

  it("renders the state badge reflecting classificationStateForPeople", () => {
    // HIGH_GROUP has one confirmed + one suggested -> "pending"
    renderTable()
    expect(screen.getByText(m.state.pending)).toBeDefined()
  })

  it("renders the noTitle label for the null-title group", () => {
    renderTable([NO_TITLE_GROUP])
    expect(screen.getByText(m.noTitle)).toBeDefined()
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

  it("fires assignPeopleToRole ONCE with every person on Confirm", async () => {
    renderTable()
    const confirmButton = screen.getByRole("button", { name: m.assignCta })
    fireEvent.click(confirmButton)
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledTimes(1)
    })
    expect(assignMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org1",
        levelSource: "confirmed",
        assignments: [
          expect.objectContaining({ personId: "p1", roleId: "role1" }),
          expect.objectContaining({ personId: "p2", roleId: "role1" }),
        ],
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
        expect.objectContaining({
          assignments: [
            expect.objectContaining({ personId: "p1", level: "IC3" }),
            expect.objectContaining({ personId: "p2", level: "IC2" }),
          ],
        })
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
        expect.objectContaining({
          assignments: [expect.objectContaining({ level: "IC1" })],
        })
      )
    })
  })

  it("renders createRoleCta for an unmatched group instead of assignCta", () => {
    // Unmatched rows show UnmatchedTitleActions (create role) rather than the
    // confirm button; picking an existing role happens in the row's select.
    renderTable([NO_TITLE_GROUP])
    expect(screen.getByRole("button", { name: m.createRoleCta })).toBeDefined()
    expect(screen.queryByRole("button", { name: m.assignCta })).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // Bulk selection + Confirm selected
  // ---------------------------------------------------------------------------

  it("select-all plus Confirm selected assigns every selectable group's people", async () => {
    // A second matched, unconfirmed group alongside HIGH_GROUP; the null-title
    // group has no role and must be excluded from select-all.
    const secondGroup: ClassifyTitleGroup = {
      title: "Data Analyst",
      personCount: 1,
      suggestedRoleId: "role1",
      people: [
        {
          personId: "p4",
          displayName: "Dana Ek",
          externalRef: null,
          employmentStartDate: null,
          isManager: null,
          suggestedLevel: "IC1",
          currentAssignment: null,
        },
      ],
    }
    renderTable([HIGH_GROUP, secondGroup, NO_TITLE_GROUP])

    fireEvent.click(screen.getByRole("checkbox", { name: m.selectAll }))
    fireEvent.click(screen.getByTestId("confirm-selected"))

    await waitFor(() => {
      // ONE batched mutation for the whole selection (a single transaction,
      // so the reactive summary updates once, not per person).
      expect(assignMock).toHaveBeenCalledTimes(1)
    })
    // HIGH_GROUP has 2 people, secondGroup has 1; NO_TITLE_GROUP is skipped.
    const [payload] = assignMock.mock.calls[0] as [
      { assignments: Array<{ personId: string }> },
    ]
    expect(payload.assignments).toHaveLength(3)
    expect(payload.assignments).toContainEqual(
      expect.objectContaining({ personId: "p4", roleId: "role1" })
    )
    // One toast for the whole bulk action.
    expect(toast.success).toHaveBeenCalledTimes(1)
  })

  it("ticking a row shows the selected count", () => {
    renderTable()
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select Senior Engineer" })
    )
    expect(screen.getByText("1 selected")).toBeDefined()
  })

  it("disables the checkbox for a group without a resolvable role", () => {
    renderTable([NO_TITLE_GROUP])
    const checkbox = screen.getByRole("checkbox", {
      name: `Select ${m.noTitle}`,
    })
    // Base UI checkboxes render a span: disabled surfaces as aria-disabled.
    expect(checkbox.getAttribute("aria-disabled")).toBe("true")
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
      // Radix Select renders a hidden native <select> whose value reflects the
      // controlled value. IC3 is p1's suggestedLevel; IC2 is p2's.
      expect(screen.getAllByDisplayValue("IC3")).toHaveLength(1)
      expect(screen.getAllByDisplayValue("IC2")).toHaveLength(1)
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
    // After expanding: one level select per person row; p1 is the first.
    await pickLevel("IC4", 0)
    // Confirm
    fireEvent.click(screen.getByRole("button", { name: m.assignCta }))
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledTimes(1)
    })
    // p1 should have IC4 (changed), p2 should have IC2 (suggestedLevel unchanged)
    expect(assignMock).toHaveBeenCalledWith(
      expect.objectContaining({
        assignments: [
          expect.objectContaining({ personId: "p1", level: "IC4" }),
          expect.objectContaining({ personId: "p2", level: "IC2" }),
        ],
      })
    )
  })

  it("after changing row role to a different track, submitted level is valid for the new track", async () => {
    // HIGH_GROUP suggests role1 (IC track). We'll switch to role2 (M track).
    renderTable()
    // The first group row.s role select.
    await pickRole("Engineering Manager")
    // Confirm without expanding: levels must reset to M track defaults.
    fireEvent.click(screen.getByRole("button", { name: m.assignCta }))
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalled()
    })
    const [payload] = assignMock.mock.calls[0] as [
      { assignments: Array<{ level: string }> },
    ]
    for (const a of payload.assignments) {
      expect(["M1", "M2", "M3"]).toContain(a.level)
    }
  })

  // ---------------------------------------------------------------------------
  // Confirmed groups: no redundant Confirm, dirty on change
  // ---------------------------------------------------------------------------

  // Every person confirmed to role1: nothing to confirm until something changes.
  const CONFIRMED_GROUP: ClassifyTitleGroup = {
    title: "Platform Engineer",
    personCount: 2,
    suggestedRoleId: "role1",
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
          levelSource: "confirmed",
        },
      },
    ],
  }

  it("shows no Confirm button and a disabled checkbox for a confirmed, untouched group", () => {
    renderTable([CONFIRMED_GROUP])
    expect(screen.queryByRole("button", { name: m.assignCta })).toBeNull()
    const checkbox = screen.getByRole("checkbox", {
      name: "Select Platform Engineer",
    })
    // Base UI checkboxes render a span: disabled surfaces as aria-disabled.
    expect(checkbox.getAttribute("aria-disabled")).toBe("true")
  })

  it("shows the confirmed role in the select over a stale engine suggestion", () => {
    // Suggestion says role2, but everyone is confirmed to role1: the select
    // must show what is actually confirmed.
    const staleSuggestion: ClassifyTitleGroup = {
      ...CONFIRMED_GROUP,
      suggestedRoleId: "role2",
    }
    renderTable([staleSuggestion])
    const trigger = screen.getByRole("combobox", { name: m.columns.role })
    expect(trigger.textContent).toContain("Software Engineer")
    expect(trigger.textContent).not.toContain("Engineering Manager")
  })

  it("role swap on a confirmed group re-surfaces Confirm and submits the new role", async () => {
    renderTable([CONFIRMED_GROUP])
    await pickRole("Engineering Manager")

    // The change makes the group dirty: Confirm reappears.
    const confirmButton = await screen.findByRole("button", {
      name: m.assignCta,
    })
    fireEvent.click(confirmButton)
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledTimes(1)
    })
    // role2 is on the M track; the stale IC levels must be replaced.
    const [payload] = assignMock.mock.calls[0] as [
      { assignments: Array<{ roleId: string; level: string }> },
    ]
    expect(payload.assignments).toHaveLength(2)
    for (const a of payload.assignments) {
      expect(a.roleId).toBe("role2")
      expect(["M1", "M2", "M3"]).toContain(a.level)
    }
  })

  it("level change on a confirmed group re-surfaces Confirm and keeps other levels", async () => {
    renderTable([CONFIRMED_GROUP])
    fireEvent.click(screen.getByRole("button", { name: m.expandLabel }))
    await waitFor(() => {
      expect(screen.getByText("Alice Svensson")).toBeDefined()
    })
    // After expanding: one level select per person row; p1 is the first.
    await pickLevel("IC4", 0)

    const confirmButton = await screen.findByRole("button", {
      name: m.assignCta,
    })
    fireEvent.click(confirmButton)
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledTimes(1)
    })
    expect(assignMock).toHaveBeenCalledWith(
      expect.objectContaining({
        assignments: [
          expect.objectContaining({ personId: "p1", level: "IC4" }),
          expect.objectContaining({ personId: "p2", level: "IC2" }),
        ],
      })
    )
  })

  it("picking a role on an unmatched group replaces create-role with Confirm", async () => {
    renderTable([NO_TITLE_GROUP])
    await pickRole("Software Engineer")

    const confirmButton = await screen.findByRole("button", {
      name: m.assignCta,
    })
    expect(screen.queryByRole("button", { name: m.createRoleCta })).toBeNull()

    fireEvent.click(confirmButton)
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith(
        expect.objectContaining({
          assignments: [
            expect.objectContaining({
              personId: "p3",
              roleId: "role1",
              level: "IC1",
            }),
          ],
        })
      )
    })
  })
})
