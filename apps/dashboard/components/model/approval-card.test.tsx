import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { toast } from "@/lib/toast"

const ALL_GREEN_CHECKS = [
  { key: "dimensionCoverage", level: "blocker", ok: true },
  { key: "workingConditionsTested", level: "blocker", ok: true },
  { key: "criterionCount", level: "blocker", ok: true },
  { key: "dimensionCaps", level: "blocker", ok: true },
  { key: "anchorsComplete", level: "blocker", ok: true },
  { key: "documentationComplete", level: "blocker", ok: true },
  { key: "weightBudget", level: "blocker", ok: true },
  { key: "levelRulesValid", level: "blocker", ok: true },
  { key: "zoneProfileMonotonic", level: "blocker", ok: true },
  { key: "dimensionWeightBalance", level: "warning", ok: true },
  { key: "peopleLeadershipWeight", level: "warning", ok: true },
  { key: "overlapPairs", level: "warning", ok: true },
] as const

// Whole-model shares, as the engine returns them (fractions of 1). Responsibility
// dominates at 46%, which is what makes the dominance remedy quotable.
const DIMENSION_SHARES = [
  { key: "competence", share: 0.3 },
  { key: "effort", share: 0.24 },
  { key: "responsibility", share: 0.46 },
  { key: "workingConditions", share: 0 },
]

let queryResult: unknown
let previewResult: unknown
let orgRole = "admin"

// Two queries render behind this card: the card's own getMethodChecks
// ({ orgId }) and, once the restore dialog is open, getModelRestorePreview
// ({ orgId, locale }). They are told apart by their args rather than by
// function identity, since the api proxy is not comparable inside a hoisted
// mock factory.
vi.mock("convex/react", () => ({
  useQuery: (_fn: unknown, args: unknown) => {
    if (args === "skip") return undefined
    if (args !== null && typeof args === "object" && "locale" in args) {
      return previewResult
    }
    return queryResult
  },
  useMutation: () => vi.fn(),
}))
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org1", name: "Acme", role: orgRole }),
}))

import { ApprovalCard } from "@/components/model/approval-card"

function renderCard(orgId = "org1") {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ApprovalCard orgId={orgId} />
    </NextIntlClientProvider>
  )
}

describe("ApprovalCard", () => {
  beforeEach(() => {
    orgRole = "admin"
    previewResult = undefined
  })
  afterEach(() => {
    cleanup()
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  // The gate reads as two groups now: what blocks approval, and what is merely
  // recommended. The distinction used to ride every row as a parenthetical,
  // twelve times on one card.
  describe("the checklist's shape", () => {
    const m = messages.dashboard.model.method

    const renderChecks = (
      checks: readonly { key: string; level: string; ok: boolean }[]
    ) => {
      queryResult = {
        checks,
        approval: null,
        lastApprovedAt: null,
        workingConditions: null,
        dimensionShares: DIMENSION_SHARES,
      }
      return renderCard()
    }
    // By ROLE and accessible name, which is what a screen reader has to work
    // with: a label that only reads on screen leaves a reader moving by group
    // or by list with no idea which items block approval.
    const groupOf = (label: string) =>
      screen.getByRole("region", { name: label })
    const rowFor = (label: string) =>
      screen.getByText(label).closest("li") as HTMLElement

    it("groups the twelve into required and recommended, each naming itself", () => {
      const { container } = renderChecks(ALL_GREEN_CHECKS)
      const required = within(groupOf(m.requiredChecks))
      const recommended = within(groupOf(m.recommendedChecks))
      expect(required.getAllByRole("listitem")).toHaveLength(9)
      expect(recommended.getAllByRole("listitem")).toHaveLength(3)
      // Membership, not just the counts: a blocker in the recommended group
      // would keep both numbers right.
      expect(required.getByText(m.checks.documentationComplete)).toBeDefined()
      expect(recommended.getByText(m.checks.overlapPairs)).toBeDefined()
      // The per-row parenthetical is gone: the group says it once.
      expect(container.textContent).not.toContain("(Required)")
      expect(container.textContent).not.toContain("(Recommended)")
    })

    // A settled row is not what the reader came for: it recedes into muted
    // text behind a small calm mark, with no circle chrome around it.
    it("lets a passing row recede", () => {
      renderChecks(ALL_GREEN_CHECKS)
      const row = rowFor(m.checks.overlapPairs)
      expect(row.className).toContain("text-muted-foreground")
      const mark = row.querySelector("svg") as SVGElement
      expect(mark.getAttribute("class")).toContain("text-success")
      // Small and bare: the icons carry 24px unless a size class says
      // otherwise, and a circled check at this size reads as a control.
      expect(mark.getAttribute("class")).toContain("size-4")
      expect(mark.getAttribute("aria-hidden")).toBe("true")
      // Decorative mark, so the state is carried in text a reader can hear.
      expect(row.textContent).toContain(m.checkMet)
      // And the level comes from the group the row sits in, which is where the
      // retired per-row parenthetical went.
      expect(row.closest("section")).toBe(groupOf(m.recommendedChecks))
    })

    it("lets a failing blocker lead, with its remedy under it", () => {
      renderChecks(
        ALL_GREEN_CHECKS.map((check) =>
          check.key === "criterionCount"
            ? { ...check, ok: false, count: 4 }
            : check
        )
      )
      const row = rowFor(m.checks.criterionCount)
      // Full-strength ink: nothing about this row is receding.
      expect(row.className).not.toContain("text-muted-foreground")
      const mark = row.querySelector("svg") as SVGElement
      expect(mark.getAttribute("class")).toContain("text-destructive")
      expect(mark.getAttribute("class")).toContain("size-4")
      expect(row.textContent).toContain(m.checkNotMet)
      // The remedy line still lands under the finding, untouched.
      expect(row.textContent).toContain("it needs 6 to 8")
    })

    it("marks a failing recommendation in the app's amber", () => {
      renderChecks(
        ALL_GREEN_CHECKS.map((check) =>
          check.key === "overlapPairs"
            ? { ...check, ok: false, pairs: [["knowledge-depth", "on-call"]] }
            : check
        )
      )
      const row = rowFor(m.checks.overlapPairs)
      const mark = row.querySelector("svg") as SVGElement
      expect(mark.getAttribute("class")).toContain("amber")
      expect(row.className).not.toContain("text-muted-foreground")
    })

    // The approved model's own reading: every row settled, so the whole
    // checklist is a quiet receipt under the sign-off metadata.
    it("recedes entirely once the model is approved", () => {
      queryResult = {
        checks: ALL_GREEN_CHECKS,
        approval: {
          approvedBy: "u1",
          approvedByName: "Alex",
          approvedAt: Date.UTC(2026, 1, 2),
        },
        lastApprovedAt: null,
        workingConditions: null,
        dimensionShares: DIMENSION_SHARES,
      }
      renderCard()
      for (const row of screen.getAllByRole("listitem")) {
        expect(row.className).toContain("text-muted-foreground")
      }
    })

    // The boundary of that claim, recorded rather than assumed: the muting is
    // driven per ROW by the check's own result, not by the model's approval, so
    // an approved model that still fails a recommendation keeps that one row at
    // full strength with its remedy. A warning never blocked approval, and a
    // receipt that quietly greyed out the one thing still outstanding would be
    // hiding it.
    it("keeps a failing recommendation loud even on an approved model", () => {
      queryResult = {
        checks: ALL_GREEN_CHECKS.map((check) =>
          check.key === "overlapPairs"
            ? { ...check, ok: false, pairs: [["knowledge-depth", "on-call"]] }
            : check
        ),
        approval: {
          approvedBy: "u1",
          approvedByName: "Alex",
          approvedAt: Date.UTC(2026, 1, 2),
        },
        lastApprovedAt: null,
        workingConditions: null,
        dimensionShares: DIMENSION_SHARES,
      }
      renderCard()
      const loud = rowFor(m.checks.overlapPairs)
      expect(loud.className).not.toContain("text-muted-foreground")
      expect(
        (loud.querySelector("svg") as SVGElement).getAttribute("class")
      ).toContain("amber")
      // Its remedy stands too: the way to clear it is still on the card.
      expect(loud.textContent).toContain("Overlapping criteria")
      // Every other row still recedes, so the one outstanding item is the only
      // thing on the card with any weight.
      expect(
        screen
          .getAllByRole("listitem")
          .filter((row) => !row.className.includes("text-muted-foreground"))
      ).toHaveLength(1)
    })
  })

  it("shows the draft state and an enabled Approve button when every blocker passes", () => {
    queryResult = {
      checks: ALL_GREEN_CHECKS,
      approval: null,
      lastApprovedAt: null,
      workingConditions: null,
      dimensionShares: DIMENSION_SHARES,
    }
    renderCard()
    expect(screen.getByText("Not yet approved")).toBeDefined()
    const approveButton = screen.getByRole("button", { name: "Approve model" })
    expect(approveButton.hasAttribute("disabled")).toBe(false)
    // Every check row rendered with its localized label.
    expect(
      screen.getByText(
        "Competence, effort, and responsibility are each covered"
      )
    ).toBeDefined()
    expect(screen.getByText("Overlapping criteria are reviewed")).toBeDefined()
  })

  it("disables the Approve button while a blocker fails", () => {
    queryResult = {
      checks: ALL_GREEN_CHECKS.map((check) =>
        check.key === "documentationComplete" ? { ...check, ok: false } : check
      ),
      approval: null,
      lastApprovedAt: null,
      workingConditions: null,
      dimensionShares: DIMENSION_SHARES,
    }
    renderCard()
    const approveButton = screen.getByRole("button", { name: "Approve model" })
    expect(approveButton.hasAttribute("disabled")).toBe(true)
  })

  it("does not disable on a failing warning (only blockers gate)", () => {
    queryResult = {
      checks: ALL_GREEN_CHECKS.map((check) =>
        check.key === "overlapPairs" ? { ...check, ok: false } : check
      ),
      approval: null,
      lastApprovedAt: null,
      workingConditions: null,
      dimensionShares: DIMENSION_SHARES,
    }
    renderCard()
    const approveButton = screen.getByRole("button", { name: "Approve model" })
    expect(approveButton.hasAttribute("disabled")).toBe(false)
  })

  it("shows the approved state and hides the Approve button once approved", () => {
    queryResult = {
      checks: ALL_GREEN_CHECKS,
      approval: {
        approvedBy: "auth-1",
        approvedByName: "Alex",
        approvedAt: 1_700_000_000_000,
      },
      lastApprovedAt: null,
      workingConditions: {
        status: "active",
        motivation: "Standby duty is a recurring requirement.",
        decidedBy: "auth-1",
        decidedAt: 1_700_000_000_000,
      },
      dimensionShares: DIMENSION_SHARES,
    }
    renderCard()
    expect(screen.getByText(/Approved by Alex on/)).toBeDefined()
    expect(screen.queryByRole("button", { name: "Approve model" })).toBeNull()
  })

  it("calls approveModel and toasts success on click", async () => {
    queryResult = {
      checks: ALL_GREEN_CHECKS,
      approval: null,
      lastApprovedAt: null,
      workingConditions: null,
      dimensionShares: DIMENSION_SHARES,
    }
    renderCard()
    fireEvent.click(screen.getByRole("button", { name: "Approve model" }))
    await vi.waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Model approved")
    })
  })

  it("renders a content-shaped skeleton while loading", () => {
    queryResult = undefined
    renderCard()
    expect(screen.getByText("Approval")).toBeDefined()
    expect(
      screen.getByText(
        "The model must pass every required check below before roles can be rated."
      )
    ).toBeDefined()
  })

  it("renders nothing when the org has no model yet", () => {
    queryResult = null
    const { container } = renderCard()
    expect(container.textContent).toBe("")
  })

  // The checks READ for every member (the section's spine needs them), but
  // every write behind this card is an adminMutation. An editor sees where the
  // model stands and is offered none of the controls that change it.
  it("shows an editor the state without offering the writes", () => {
    orgRole = "editor"
    queryResult = {
      checks: ALL_GREEN_CHECKS,
      approval: null,
      lastApprovedAt: null,
      workingConditions: null,
      dimensionShares: DIMENSION_SHARES,
    }
    renderCard()
    // The state is readable.
    expect(screen.getByText("Not yet approved")).toBeDefined()
    expect(
      screen.getByText("Weight points balanced to the budget")
    ).toBeDefined()
    // The card's one write is not on offer.
    expect(screen.queryByRole("button", { name: "Approve model" })).toBeNull()
  })

  // The materiality DECISION moved to the Metod chapter, where the spine
  // counts it; this card keeps the check ROW that reports it. Asserted for an
  // ADMIN, because an editor never saw the form anyway: it is the admin render
  // that would still carry it if the move had been half done.
  it("reports the working-conditions decision without making it", () => {
    queryResult = {
      checks: ALL_GREEN_CHECKS,
      approval: null,
      lastApprovedAt: null,
      workingConditions: {
        status: "active",
        motivation: "Standby duty is a recurring requirement.",
        decidedBy: "auth-1",
        decidedAt: 1_700_000_000_000,
      },
      dimensionShares: DIMENSION_SHARES,
    }
    renderCard()
    // The check row stays.
    expect(screen.getByText("Working conditions tested")).toBeDefined()
    // The decision's own controls do not: no status toggle, no motivation
    // field, no save.
    expect(
      screen.queryByRole("button", { name: "Tested, not material" })
    ).toBeNull()
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.queryByRole("button", { name: "Save decision" })).toBeNull()
  })
  // The restore control (ADR-0023 decision 11) is offered only where it is
  // meaningful: approval re-opened by a method-affecting edit AND a stored
  // last-approved buffer to go back to. Admin-only, like approve.
  describe("restore to last approved", () => {
    const REOPENED_WITH_BUFFER = {
      checks: ALL_GREEN_CHECKS,
      approval: null,
      lastApprovedAt: 1_700_000_000_000,
      workingConditions: null,
      dimensionShares: DIMENSION_SHARES,
    }

    it("offers the restore, naming the date it goes back to", () => {
      queryResult = REOPENED_WITH_BUFFER
      renderCard()
      expect(
        screen.getByRole("button", { name: "Restore to last approved" })
      ).toBeDefined()
      expect(
        screen.getByText(/The model approved on .* can be restored\./)
      ).toBeDefined()
    })

    it("hides it while the model carries no buffer", () => {
      queryResult = {
        checks: ALL_GREEN_CHECKS,
        approval: null,
        lastApprovedAt: null,
        workingConditions: null,
        dimensionShares: DIMENSION_SHARES,
      }
      renderCard()
      expect(
        screen.queryByRole("button", { name: "Restore to last approved" })
      ).toBeNull()
    })

    it("hides it while the approval still stands", () => {
      queryResult = {
        checks: ALL_GREEN_CHECKS,
        approval: {
          approvedBy: "auth-1",
          approvedByName: "Alex",
          approvedAt: 1_700_000_000_000,
        },
        lastApprovedAt: 1_700_000_000_000,
        workingConditions: null,
        dimensionShares: DIMENSION_SHARES,
      }
      renderCard()
      expect(
        screen.queryByRole("button", { name: "Restore to last approved" })
      ).toBeNull()
    })

    it("hides it from an editor", () => {
      orgRole = "editor"
      queryResult = REOPENED_WITH_BUFFER
      renderCard()
      expect(
        screen.queryByRole("button", { name: "Restore to last approved" })
      ).toBeNull()
    })
  })
  // Every FAILING row says what to do and where, with the specifics the check
  // already computed. The card used to state twelve verdicts and no remedies:
  // the two warnings were unactionable, and one of them named no surface that
  // could answer it at all.
  describe("remedy lines", () => {
    const remedies = messages.dashboard.model.method.remedies
    const checks = messages.dashboard.model.method.checks

    // The remedy sits in the same <li> as its finding, and a chapter LINK
    // splits its sentence across elements, so the assertions read the row's
    // whole text rather than hunting for one unbroken string.
    const rowText = (label: string) =>
      screen.getByText(label).closest("li")?.textContent ?? ""

    function failing(key: string, extra: Record<string, unknown> = {}) {
      queryResult = {
        checks: ALL_GREEN_CHECKS.map((check) =>
          check.key === key ? { ...check, ok: false, ...extra } : check
        ),
        approval: null,
        lastApprovedAt: null,
        workingConditions: null,
        dimensionShares: DIMENSION_SHARES,
      }
      renderCard()
    }

    it("says nothing under a passing row", () => {
      queryResult = {
        checks: ALL_GREEN_CHECKS,
        approval: null,
        lastApprovedAt: null,
        workingConditions: null,
        dimensionShares: DIMENSION_SHARES,
      }
      renderCard()
      // The all-green card carries twelve findings and no instructions.
      expect(screen.queryByText(/Adjust the selection in/)).toBeNull()
      expect(screen.queryByText(/Motivate it in/)).toBeNull()
    })

    // The row the owner got stuck on. It names the dimension AND its share, so
    // "which one, and by how much" is answered in the same sentence.
    it("names the dominant dimension and its share, and links to Weighting", () => {
      failing("dimensionWeightBalance", { dimensions: ["responsibility"] })
      const line = rowText(checks.dimensionWeightBalance)
      expect(line).toContain("Responsibility and impact (46%)")
      expect(line).toContain("Weighting")
      expect(line).toContain("move weight points")
      expect(
        screen.getByRole("link", { name: "Weighting" }).getAttribute("href")
      ).toBe("/model/weighting")
    })

    // The other row the owner got stuck on. Overlapping criteria are named as
    // PAIRS, so the reader knows which two to open.
    it("names the overlapping pairs, and links to Method", () => {
      failing("overlapPairs", {
        pairs: [["knowledge-depth", "knowledge-breadth"]],
      })
      const line = rowText(checks.overlapPairs)
      expect(line).toContain(
        "Knowledge depth and specialist level / Knowledge breadth and cross-disciplinary understanding"
      )
      expect(
        screen.getByRole("link", { name: "Method" }).getAttribute("href")
      ).toBe("/model/method")
    })

    // The second warning names its criterion from the library, since the check
    // itself carries no ids (there is only ever one such criterion).
    it("names the people-leadership criterion", () => {
      failing("peopleLeadershipWeight")
      expect(rowText(checks.peopleLeadershipWeight)).toContain(
        "People and management responsibility"
      )
      expect(
        screen.getByRole("link", { name: "Weighting" }).getAttribute("href")
      ).toBe("/model/weighting")
    })

    it("counts the criteria a documentation gap names", () => {
      failing("documentationComplete", { criterionIds: ["c1", "c2", "c3"] })
      expect(rowText(checks.documentationComplete)).toContain(
        "3 criteria are still undocumented or unapproved"
      )
    })

    it("states the model's criterion count against the 6 to 8 range", () => {
      failing("criterionCount", { count: 4 })
      expect(rowText(checks.criterionCount)).toContain(
        "The model holds 4 criteria; it needs 6 to 8"
      )
    })

    it("names the uncovered dimensions", () => {
      failing("dimensionCoverage", { dimensions: ["effort", "responsibility"] })
      expect(rowText(checks.dimensionCoverage)).toContain(
        "Effort and complexity and Responsibility and impact"
      )
    })

    // Nothing in the app edits the level or zone-profile rules, so their
    // remedy points at no chapter rather than at one that cannot fix it.
    it("offers no chapter link where no chapter can fix it", () => {
      failing("levelRulesValid")
      expect(rowText(checks.levelRulesValid)).toContain(
        remedies.levelRulesValid
      )
      expect(screen.queryByRole("link")).toBeNull()
    })

    // An editor cannot approve, but the instructions are exactly what tells
    // them what still has to happen.
    it("shows an editor the remedies", () => {
      orgRole = "editor"
      failing("weightBudget")
      expect(rowText(checks.weightBudget)).toContain(
        "The weight points do not add up to the budget"
      )
    })
  })
})
