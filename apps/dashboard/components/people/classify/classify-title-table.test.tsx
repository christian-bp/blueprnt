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

vi.mock("@/lib/toast", () => ({
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

import { toast } from "@/lib/toast"
import { mockMutation } from "@/test/convex-mocks"
import type { ClassifyTitleGroup } from "@/components/people/classify/classify-title-table"
import {
  ClassifyTitleTable,
  classificationStateForPeople,
} from "@/components/people/classify/classify-title-table"

// ---------------------------------------------------------------------------
// Pure helper tests
// ---------------------------------------------------------------------------

const conf = { currentAssignment: { senioritySource: "confirmed" as const } }
const sug = { currentAssignment: { senioritySource: "suggested" as const } }
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
// by index (role selects come one per group row; seniority selects one per
// person row after expanding).
async function pickRole(title: string, index = 0) {
  const trigger = screen.getAllByRole("combobox", { name: m.columns.role })[
    index
  ] as HTMLElement
  await pickSelectOption(trigger, title)
}
async function pickSeniority(seniority: string, index: number) {
  const trigger = screen.getAllByRole("combobox", { name: m.seniorityLabel })[
    index
  ] as HTMLElement
  await pickSelectOption(trigger, seniority)
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
      suggestedSeniority: "IC3",
      currentAssignment: {
        roleId: "role1",
        seniority: "IC3",
        senioritySource: "confirmed",
      },
    },
    {
      personId: "p2",
      displayName: "Bob Larsson",
      externalRef: null,
      employmentStartDate: null,
      isManager: null,
      suggestedSeniority: "IC2",
      currentAssignment: {
        roleId: "role1",
        seniority: "IC2",
        senioritySource: "suggested",
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
      suggestedSeniority: null,
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

  // Opens the first row's per-person panel (everything mounts collapsed).
  function expandFirst() {
    const toggle = screen.queryAllByRole("button", { name: m.expandLabel })[0]
    if (toggle !== undefined) fireEvent.click(toggle)
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

  it("collapses the panel once the group is confirmed", async () => {
    renderTable()
    expandFirst()
    await waitFor(() => {
      expect(screen.getByText("Alice Svensson")).toBeDefined()
    })

    fireEvent.click(screen.getByRole("button", { name: m.assignCta }))

    // The group's work is done, so its review panel closes instead of
    // burying the rows still to classify.
    await waitFor(() => {
      expect(screen.queryByText("Alice Svensson")).toBeNull()
    })
    expect(screen.getByRole("button", { name: m.expandLabel })).toBeDefined()
  })

  it("keeps the panel open when confirming fails", async () => {
    assignMock.mockRejectedValueOnce(new Error("network"))
    renderTable()
    expandFirst()
    await waitFor(() => {
      expect(screen.getByText("Alice Svensson")).toBeDefined()
    })

    fireEvent.click(screen.getByRole("button", { name: m.assignCta }))

    // Nothing landed, so the panel stays put for the retry.
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
    expect(screen.getByText("Alice Svensson")).toBeDefined()
  })

  it("scrolls a newly opened panel into view", async () => {
    // jsdom has no scrollIntoView, and the panel scrolls only after its
    // height animation settles, so this asserts the call rather than a
    // scroll position.
    const scrollIntoView = vi.fn()
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scrollIntoView
    try {
      renderTable()
      expandFirst()
      await waitFor(() => {
        expect(scrollIntoView).toHaveBeenCalledWith(
          expect.objectContaining({ block: "nearest" })
        )
      })
    } finally {
      Element.prototype.scrollIntoView = original
    }
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
        senioritySource: "confirmed",
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

  it("uses each person's resolved seniority when confirming", async () => {
    renderTable()
    expandFirst()
    fireEvent.click(screen.getByRole("button", { name: m.assignCta }))
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith(
        expect.objectContaining({
          assignments: [
            expect.objectContaining({ personId: "p1", seniority: "IC3" }),
            expect.objectContaining({ personId: "p2", seniority: "IC2" }),
          ],
        })
      )
    })
  })

  it("falls back to TRACK_SENIORITIES[0] when suggestedSeniority is null", async () => {
    const groupNoSeniority: ClassifyTitleGroup = {
      ...HIGH_GROUP,
      people: [
        {
          personId: "p1",
          displayName: "Alice Svensson",
          externalRef: "42",
          employmentStartDate: null,
          isManager: null,
          suggestedSeniority: null,
          currentAssignment: null,
        },
      ],
    }
    renderTable([groupNoSeniority])
    expandFirst()
    fireEvent.click(screen.getByRole("button", { name: m.assignCta }))
    await waitFor(() => {
      // IC track first seniority is "IC1"
      expect(assignMock).toHaveBeenCalledWith(
        expect.objectContaining({
          assignments: [expect.objectContaining({ seniority: "IC1" })],
        })
      )
    })
  })

  it("confirm passes a changed per-person seniority", async () => {
    renderTable()
    expandFirst()
    await waitFor(() => {
      expect(screen.getByText("Alice Svensson")).toBeDefined()
    })
    // Seniority selects: one per person row, index 0 = p1.
    await pickSeniority("IC4", 0)
    fireEvent.click(screen.getByRole("button", { name: m.assignCta }))
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith(
        expect.objectContaining({
          assignments: [
            expect.objectContaining({ personId: "p1", seniority: "IC4" }),
            expect.objectContaining({ personId: "p2", seniority: "IC2" }),
          ],
        })
      )
    })
  })

  it("after changing the role to a different track, submitted seniorities are valid for it", async () => {
    renderTable()
    expandFirst()
    await pickRole("Engineering Manager")
    fireEvent.click(screen.getByRole("button", { name: m.assignCta }))
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalled()
    })
    const [payload] = assignMock.mock.calls[0] as [
      { assignments: Array<{ roleId: string; seniority: string }> },
    ]
    for (const a of payload.assignments) {
      expect(a.roleId).toBe("role2")
      expect(["M1", "M2", "M3"]).toContain(a.seniority)
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
        suggestedSeniority: "IC3",
        currentAssignment: {
          roleId: "role1",
          seniority: "IC3",
          senioritySource: "confirmed",
        },
      },
      {
        personId: "p2",
        displayName: "Bob Larsson",
        externalRef: null,
        employmentStartDate: null,
        isManager: null,
        suggestedSeniority: "IC2",
        currentAssignment: {
          roleId: "role1",
          seniority: "IC2",
          senioritySource: "confirmed",
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
      { assignments: Array<{ roleId: string; seniority: string }> },
    ]
    expect(payload.assignments).toHaveLength(2)
    for (const a of payload.assignments) {
      expect(a.roleId).toBe("role2")
      expect(["M1", "M2", "M3"]).toContain(a.seniority)
    }
  })

  it("seniority change on a confirmed group re-surfaces Confirm and keeps other seniorities", async () => {
    renderTable([CONFIRMED_GROUP])
    expandFirst()
    await waitFor(() => {
      expect(screen.getByText("Alice Svensson")).toBeDefined()
    })
    await pickSeniority("IC4", 0)
    const confirmButton = await screen.findByRole("button", {
      name: m.assignCta,
    })
    fireEvent.click(confirmButton)
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith(
        expect.objectContaining({
          assignments: [
            expect.objectContaining({ personId: "p1", seniority: "IC4" }),
            expect.objectContaining({ personId: "p2", seniority: "IC2" }),
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
    // Without a role there is no track: the seniority select states the
    // precondition instead of rendering empty.
    expect(screen.getByText(m.seniorityNeedsRole)).toBeDefined()
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
              seniority: "IC1",
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

  // ---------------------------------------------------------------------------
  // Mount state: everything collapsed, expansion is opt-in
  // ---------------------------------------------------------------------------

  it("expands nothing on mount, even with unconfirmed groups present", () => {
    renderTable([CONFIRMED_GROUP, HIGH_GROUP])
    // No per-person rows visible without a click.
    expect(screen.queryByText("Alice Svensson")).toBeNull()
    expect(screen.queryByText("Bob Larsson")).toBeNull()
    expect(
      screen.queryAllByRole("button", { name: m.collapseLabel })
    ).toHaveLength(0)
    // Every row still offers its expand control.
    expect(screen.getAllByRole("button", { name: m.expandLabel })).toHaveLength(
      2
    )
  })

  // ---------------------------------------------------------------------------
  // Bulk selection: checkboxes + toolbar
  // ---------------------------------------------------------------------------

  it("renders a checkbox only on actionable groups, never a disabled one", () => {
    renderTable([HIGH_GROUP, NO_TITLE_GROUP])
    // Header select-all + one for the actionable row; the unmatched group
    // (nothing to confirm) shows no checkbox at all rather than a disabled
    // one.
    const boxes = screen.getAllByRole("checkbox")
    expect(boxes).toHaveLength(2)
    expect(
      screen.getByRole("checkbox", {
        name: m.bulk.selectRow.replace("{title}", "Senior Engineer"),
      })
    ).toBeDefined()
    expect(
      screen.queryByRole("checkbox", {
        name: m.bulk.selectRow.replace("{title}", m.noTitle),
      })
    ).toBeNull()
  })

  it("hides the select-all when no group is selectable", () => {
    renderTable([NO_TITLE_GROUP])
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0)
  })

  it("select-all selects only actionable groups and enables the CTA with counts", async () => {
    renderTable([HIGH_GROUP, NO_TITLE_GROUP])
    const cta = screen.getByRole("button", {
      name: m.bulk.cta,
    }) as HTMLButtonElement
    expect(cta.disabled).toBe(true)
    fireEvent.click(screen.getByRole("checkbox", { name: m.bulk.selectAll }))
    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: m.bulk.cta }) as HTMLButtonElement)
          .disabled
      ).toBe(false)
    })
    // 1 actionable title, 2 people (the unmatched group is not selectable).
    expect(screen.getByText(/1 title .* 2 people/)).toBeDefined()
  })

  it("selecting one of several actionable groups marks the header checkbox partially selected", () => {
    const SECOND_GROUP: ClassifyTitleGroup = {
      title: "Engineering Manager",
      personCount: 1,
      suggestedRoleId: "role2",
      people: [
        {
          personId: "p9",
          displayName: "Eva Holm",
          externalRef: null,
          employmentStartDate: null,
          isManager: true,
          suggestedSeniority: "M1",
          currentAssignment: null,
        },
      ],
    }
    renderTable([HIGH_GROUP, SECOND_GROUP])
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: m.bulk.selectRow.replace("{title}", "Senior Engineer"),
      })
    )
    const headerBox = screen.getByRole("checkbox", { name: m.bulk.selectAll })
    expect(headerBox.getAttribute("aria-checked")).toBe("mixed")
  })

  // ---------------------------------------------------------------------------
  // Bulk confirm: the summary dialog gates a chunked write across groups
  // ---------------------------------------------------------------------------

  it("bulk confirm goes through the summary dialog and merges groups into one chunked call", async () => {
    const SECOND_GROUP: ClassifyTitleGroup = {
      title: "Engineering Manager",
      personCount: 1,
      suggestedRoleId: "role2",
      people: [
        {
          personId: "p9",
          displayName: "Eva Holm",
          externalRef: null,
          employmentStartDate: null,
          isManager: true,
          suggestedSeniority: "M1",
          currentAssignment: null,
        },
      ],
    }
    renderTable([HIGH_GROUP, SECOND_GROUP])
    fireEvent.click(screen.getByRole("checkbox", { name: m.bulk.selectAll }))
    fireEvent.click(screen.getByRole("button", { name: m.bulk.cta }))
    // The dialog gates the write: nothing has been submitted yet.
    expect(assignMock).not.toHaveBeenCalled()
    expect(
      screen.getByRole("alertdialog", { name: m.bulk.dialogTitle })
    ).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: m.bulk.confirm }))
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    // Three people across two groups fit one chunk: exactly one mutation
    // call whose payload carries all of them, confirmed.
    expect(assignMock).toHaveBeenCalledTimes(1)
    const [call] = assignMock.mock.calls[0] as [
      {
        senioritySource: string
        assignments: Array<{ personId: string }>
      },
    ]
    expect(call.senioritySource).toBe("confirmed")
    expect(call.assignments.map((a) => a.personId).sort()).toEqual([
      "p1",
      "p2",
      "p9",
    ])
  })

  it("closes the dialog without a success toast when the selection prunes to empty before confirm", async () => {
    const { rerender } = renderTable([HIGH_GROUP])
    fireEvent.click(screen.getByRole("checkbox", { name: m.bulk.selectAll }))
    fireEvent.click(screen.getByRole("button", { name: m.bulk.cta }))
    expect(
      screen.getByRole("alertdialog", { name: m.bulk.dialogTitle })
    ).toBeDefined()
    // The selected group gets confirmed elsewhere (another tab, another
    // admin) while the dialog is still open: re-render with it fully
    // confirmed as-is, which prunes the effective selection to nothing.
    const nowConfirmed: ClassifyTitleGroup = {
      ...HIGH_GROUP,
      people: HIGH_GROUP.people.map((p) => ({
        ...p,
        currentAssignment: {
          roleId: "role1",
          seniority: p.suggestedSeniority ?? "IC1",
          senioritySource: "confirmed" as const,
        },
      })),
    }
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <form>
          <ClassifyTitleTable
            orgId="org1"
            groups={[nowConfirmed]}
            roles={ROLES}
            tracks={TRACKS}
          />
        </form>
      </NextIntlClientProvider>
    )
    fireEvent.click(screen.getByRole("button", { name: m.bulk.confirm }))
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull()
    })
    expect(assignMock).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("keeps the dialog open and shows an error toast when a chunk fails", async () => {
    assignMock.mockRejectedValueOnce(new Error("boom"))
    renderTable([HIGH_GROUP])
    fireEvent.click(screen.getByRole("checkbox", { name: m.bulk.selectAll }))
    fireEvent.click(screen.getByRole("button", { name: m.bulk.cta }))
    fireEvent.click(screen.getByRole("button", { name: m.bulk.confirm }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(
      screen.getByRole("alertdialog", { name: m.bulk.dialogTitle })
    ).toBeDefined()
  })

  it("stops after the failing chunk in a multi-chunk bulk confirm: exactly the chunks tried, error toast, dialog stays open, no success", async () => {
    // 60 people packs into chunks of 50 and 10 (MAX_ASSIGNMENTS_PER_MUTATION
    // is 50). The first chunk lands, the second fails: the surface must not
    // report success for a selection that only partially landed.
    const BIG_GROUP: ClassifyTitleGroup = {
      title: "Retail Associate",
      personCount: 60,
      suggestedRoleId: "role1",
      people: Array.from({ length: 60 }, (_, i) => ({
        personId: `big-${i}`,
        displayName: `Person ${i}`,
        externalRef: null,
        employmentStartDate: null,
        isManager: null,
        suggestedSeniority: "IC1",
        currentAssignment: null,
      })),
    }
    assignMock
      .mockResolvedValueOnce(["assignment-id"])
      .mockRejectedValueOnce(new Error("boom"))
    renderTable([BIG_GROUP])
    fireEvent.click(screen.getByRole("checkbox", { name: m.bulk.selectAll }))
    fireEvent.click(screen.getByRole("button", { name: m.bulk.cta }))
    fireEvent.click(screen.getByRole("button", { name: m.bulk.confirm }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(assignMock).toHaveBeenCalledTimes(2)
    expect(
      screen.getByRole("alertdialog", { name: m.bulk.dialogTitle })
    ).toBeDefined()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("splits a selected group larger than the mutation limit into sequential chunks", async () => {
    // Drives a >MAX_ASSIGNMENTS_PER_MUTATION group through the component's
    // mocked mutation. 60 people -> chunks of 50 and 10, called in order.
    const BIG_GROUP: ClassifyTitleGroup = {
      title: "Retail Associate",
      personCount: 60,
      suggestedRoleId: "role1",
      people: Array.from({ length: 60 }, (_, i) => ({
        personId: `big-${i}`,
        displayName: `Person ${i}`,
        externalRef: null,
        employmentStartDate: null,
        isManager: null,
        suggestedSeniority: "IC1",
        currentAssignment: null,
      })),
    }
    renderTable([BIG_GROUP])
    fireEvent.click(screen.getByRole("checkbox", { name: m.bulk.selectAll }))
    fireEvent.click(screen.getByRole("button", { name: m.bulk.cta }))
    fireEvent.click(screen.getByRole("button", { name: m.bulk.confirm }))
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(assignMock).toHaveBeenCalledTimes(2)
    const calls = assignMock.mock.calls as Array<
      [{ assignments: Array<{ personId: string }> }]
    >
    const sizes = calls
      .map(([payload]) => payload.assignments.length)
      .sort((a, b) => a - b)
    expect(sizes).toEqual([10, 50])
    const allIds = calls.flatMap(([payload]) =>
      payload.assignments.map((a) => a.personId)
    )
    // Exact union, no duplicates: every person lands in exactly one chunk.
    expect(new Set(allIds).size).toBe(60)
    expect(allIds.slice().sort()).toEqual(
      BIG_GROUP.people.map((p) => p.personId).sort()
    )
  })
})
