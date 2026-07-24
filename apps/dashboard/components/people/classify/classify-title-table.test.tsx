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

function renderTable(groups = [HIGH_GROUP], roles = ROLES) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <form>
        <ClassifyTitleTable
          orgId="org1"
          groups={groups}
          roles={roles}
          tracks={TRACKS}
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

  function expandFirst() {
    const toggle = screen.getAllByRole("button", { name: m.expandLabel })[0]
    if (toggle === undefined) throw new Error("expand toggle not found")
    fireEvent.click(toggle)
  }

  it("renders column headers", () => {
    renderTable()
    expect(screen.getByText(m.columns.title)).toBeDefined()
    expect(screen.getByText(m.columns.people)).toBeDefined()
    expect(screen.getAllByText(m.columns.role).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(m.columns.state)).toBeDefined()
  })

  it("renders the title, person count, and resolved role as text", () => {
    renderTable()
    expect(screen.getByText("Senior Engineer")).toBeDefined()
    expect(screen.getByText("2")).toBeDefined()
    // The collapsed row shows the resolved role read-only (no select).
    expect(screen.getByText("Software Engineer")).toBeDefined()
    expect(screen.queryByRole("combobox")).toBeNull()
  })

  it("renders the state badge reflecting classificationStateForPeople", () => {
    // HIGH_GROUP has one confirmed + one suggested -> "pending"
    renderTable()
    expect(screen.getByText(m.state.pending)).toBeDefined()
  })

  it("renders the Empty state with an icon when there are no title groups", () => {
    renderTable([])
    expect(screen.getByText(m.empty)).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
    expect(
      document.querySelector('[data-slot="empty-icon"] svg')
    ).not.toBeNull()
  })

  it("renders the noTitle label and the no-match hint for the null-title group", () => {
    renderTable([NO_TITLE_GROUP])
    expect(screen.getByText(m.noTitle)).toBeDefined()
    expect(screen.getByText(m.noRoleMatch)).toBeDefined()
    expect(screen.getByText(m.state.unclassified)).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // The review gate: Confirm exists ONLY inside the expanded panel
  // ---------------------------------------------------------------------------

  it("offers no Confirm anywhere while the group is collapsed", () => {
    renderTable()
    expect(screen.queryByRole("button", { name: m.assignCta })).toBeNull()
  })

  it("clicking the row expands the review panel", async () => {
    renderTable()
    fireEvent.click(screen.getByText("Senior Engineer"))
    await waitFor(() => {
      expect(screen.getByText("Alice Svensson")).toBeDefined()
    })
  })

  it("expanding reveals the people, the role select, and Confirm", async () => {
    renderTable()
    expandFirst()
    await waitFor(() => {
      expect(screen.getByText("Alice Svensson")).toBeDefined()
      expect(screen.getByText("Bob Larsson")).toBeDefined()
    })
    expect(screen.getByRole("combobox", { name: m.columns.role })).toBeDefined()
    expect(screen.getByRole("button", { name: m.assignCta })).toBeDefined()
  })

  it("collapse hides the panel again", async () => {
    renderTable()
    expandFirst()
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

  it("fires assignPeopleToRole ONCE with every person on Confirm", async () => {
    renderTable()
    expandFirst()
    fireEvent.click(screen.getByRole("button", { name: m.assignCta }))
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
    expect(toast.success).toHaveBeenCalledWith(
      messages.dashboard.toast.classificationConfirmed
    )
  })

  it("uses each person's resolved level when confirming", async () => {
    renderTable()
    expandFirst()
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
    expandFirst()
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

  it("confirm passes a changed per-person level", async () => {
    renderTable()
    expandFirst()
    await waitFor(() => {
      expect(screen.getByText("Alice Svensson")).toBeDefined()
    })
    // Level selects: one per person row, index 0 = p1.
    await pickLevel("IC4", 0)
    fireEvent.click(screen.getByRole("button", { name: m.assignCta }))
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith(
        expect.objectContaining({
          assignments: [
            expect.objectContaining({ personId: "p1", level: "IC4" }),
            expect.objectContaining({ personId: "p2", level: "IC2" }),
          ],
        })
      )
    })
  })

  it("after changing the role to a different track, submitted levels are valid for it", async () => {
    renderTable()
    expandFirst()
    await pickRole("Engineering Manager")
    fireEvent.click(screen.getByRole("button", { name: m.assignCta }))
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalled()
    })
    const [payload] = assignMock.mock.calls[0] as [
      { assignments: Array<{ roleId: string; level: string }> },
    ]
    for (const a of payload.assignments) {
      expect(a.roleId).toBe("role2")
      expect(["M1", "M2", "M3"]).toContain(a.level)
    }
  })

  // ---------------------------------------------------------------------------
  // Confirmed groups: nothing to confirm until something changes
  // ---------------------------------------------------------------------------

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

  it("a confirmed, untouched group shows no Confirm in its panel", async () => {
    renderTable([CONFIRMED_GROUP])
    expandFirst()
    await waitFor(() => {
      expect(screen.getByText("Alice Svensson")).toBeDefined()
    })
    expect(screen.queryByRole("button", { name: m.assignCta })).toBeNull()
  })

  it("shows the confirmed role over a stale engine suggestion", async () => {
    const staleSuggestion: ClassifyTitleGroup = {
      ...CONFIRMED_GROUP,
      suggestedRoleId: "role2",
    }
    renderTable([staleSuggestion])
    // Collapsed row already shows what is actually confirmed.
    expect(screen.getByText("Software Engineer")).toBeDefined()
    expect(screen.queryByText("Engineering Manager")).toBeNull()
  })

  it("role swap on a confirmed group re-surfaces Confirm and submits the new role", async () => {
    renderTable([CONFIRMED_GROUP])
    expandFirst()
    await pickRole("Engineering Manager")
    const confirmButton = await screen.findByRole("button", {
      name: m.assignCta,
    })
    fireEvent.click(confirmButton)
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledTimes(1)
    })
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
    expandFirst()
    await waitFor(() => {
      expect(screen.getByText("Alice Svensson")).toBeDefined()
    })
    await pickLevel("IC4", 0)
    const confirmButton = await screen.findByRole("button", {
      name: m.assignCta,
    })
    fireEvent.click(confirmButton)
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith(
        expect.objectContaining({
          assignments: [
            expect.objectContaining({ personId: "p1", level: "IC4" }),
            expect.objectContaining({ personId: "p2", level: "IC2" }),
          ],
        })
      )
    })
  })

  // ---------------------------------------------------------------------------
  // Unmatched groups: create or pick a role inside the panel
  // ---------------------------------------------------------------------------

  it("an unmatched group offers create-role in its panel instead of Confirm", async () => {
    renderTable([NO_TITLE_GROUP])
    expandFirst()
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: m.createRoleCta })
      ).toBeDefined()
    })
    expect(screen.queryByRole("button", { name: m.assignCta })).toBeNull()
    // Without a role there is no track: the level select states the
    // precondition instead of rendering empty.
    expect(screen.getByText(m.levelNeedsRole)).toBeDefined()
  })

  it("picking a role in the panel replaces create-role with Confirm", async () => {
    renderTable([NO_TITLE_GROUP])
    expandFirst()
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

  // ---------------------------------------------------------------------------
  // Sorting
  // ---------------------------------------------------------------------------

  it("sorts by title ascending by default, no-title bucket pinned last", () => {
    const aardvark: ClassifyTitleGroup = {
      ...HIGH_GROUP,
      title: "Aardvark Handler",
    }
    // Deliberately shuffled input: null-title first, Senior before Aardvark.
    renderTable([NO_TITLE_GROUP, HIGH_GROUP, aardvark])
    const rows = screen.getAllByRole("row")
    expect(rows[1]?.textContent).toContain("Aardvark Handler")
    expect(rows[2]?.textContent).toContain("Senior Engineer")
    expect(rows[3]?.textContent).toContain(m.noTitle)
  })

  it("clicking the title heading flips the direction, no-title still last", () => {
    const aardvark: ClassifyTitleGroup = {
      ...HIGH_GROUP,
      title: "Aardvark Handler",
    }
    renderTable([NO_TITLE_GROUP, HIGH_GROUP, aardvark])
    fireEvent.click(screen.getByRole("button", { name: m.columns.title }))
    const rows = screen.getAllByRole("row")
    expect(rows[1]?.textContent).toContain("Senior Engineer")
    expect(rows[2]?.textContent).toContain("Aardvark Handler")
    expect(rows[3]?.textContent).toContain(m.noTitle)
  })
})
