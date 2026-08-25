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
import { mockMutation, onQuery } from "@/test/convex-mocks"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)

import { OrganizationProvider } from "@/components/org-context"
import { RoleSheetProvider, useRoleSheet } from "@/components/role-sheet"

function baseRole() {
  return {
    roleId: "role_1",
    slug: "role_1",
    title: "Engineer",
    function: "Backend",
    team: "Platform",
    trackKey: "IC",
    trackName: "Individual contributor",
    purpose: "Builds the platform.",
    responsibilities: "Ship features\nReview code",
    archived: false,
    profileComplete: true,
    ratedCount: 2,
    totalCriteria: 3,
    familyId: null,
    familyName: null,
    anchorRole: null as {
      expectedLevel: number
      motivation: string
      status: "active" | "underReview" | "replaced"
      reviewedAt: number
    } | null,
    ratings: [],
  }
}
type Role = ReturnType<typeof baseRole>

type Result = {
  roleId: string
  title: string
  complete: boolean
  completed: boolean
  methodDrift?: boolean
  calibrated?: boolean
  profileLimited?: boolean | null
  profileFailures?:
    | { criterionId: string; name: string; required: number; actual: number }[]
    | null
  ratedCount: number
  totalCriteria: number
  score: number | null
  level: number | null
  criteria: {
    criterionId: string
    name: string
    weightPoints: number
    value: number | null
    motivation: string | null
  }[]
}

let role: Role | null | undefined
let result: Result | null | undefined

function install() {
  onQuery((ref) =>
    ref === "assessment.roles.getRole"
      ? role
      : ref === "assessment.results.getRoleResult"
        ? result
        : undefined
  )
}

function Trigger() {
  const { openRole } = useRoleSheet()
  return (
    <button type="button" onClick={() => openRole("role_1")}>
      trigger
    </button>
  )
}

function renderSheet() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OrganizationProvider
        value={{ orgId: "org_1", name: "Acme", role: "admin" }}
      >
        <RoleSheetProvider>
          <Trigger />
        </RoleSheetProvider>
      </OrganizationProvider>
    </NextIntlClientProvider>
  )
}

function open() {
  fireEvent.click(screen.getByRole("button", { name: "trigger" }))
}

describe("RoleSheet", () => {
  beforeEach(() => {
    role = baseRole()
    result = {
      roleId: "role_1",
      title: "Engineer",
      complete: true,
      completed: true,
      ratedCount: 3,
      totalCriteria: 3,
      score: 71,
      level: 3,
      criteria: [
        {
          criterionId: "scope",
          name: "Scope",
          weightPoints: 5,
          value: 3,
          motivation: null,
        },
        {
          criterionId: "complexity",
          name: "Complexity",
          weightPoints: 4,
          value: 5,
          motivation: null,
        },
      ],
    }
    install()
  })
  afterEach(() => cleanup())

  it("shows the level and a compact breakdown (no raw score) for a completed role", () => {
    renderSheet()
    open()
    expect(screen.getByText("Engineer")).toBeTruthy()
    expect(screen.getByText("Level 3")).toBeTruthy()
    // The raw 0-100 weighting is intentionally not shown in the sheet.
    expect(screen.queryByText("71 / 100")).toBeNull()
    // Breakdown is present but compact: names + shares, no "rated X / 5".
    expect(screen.getByText("Complexity")).toBeTruthy()
    expect(screen.getByText("57%")).toBeTruthy()
    expect(screen.queryByText("rated 5 / 5")).toBeNull()
    expect(screen.getByText("Completed")).toBeTruthy()
  })

  it("flags method drift on a completed role with a stale-method chip", () => {
    result = { ...(result as Result), methodDrift: true }
    install()
    renderSheet()
    open()
    expect(screen.getByText("Assessed under a previous method")).toBeTruthy()
  })

  it("leaves the stale-method chip off a role completed under the current method", () => {
    result = { ...(result as Result), methodDrift: false }
    install()
    renderSheet()
    open()
    expect(screen.queryByText("Assessed under a previous method")).toBeNull()
  })

  it("marks a confirmed placement as calibrated, and an unconfirmed one not", () => {
    renderSheet()
    open()
    expect(screen.queryByText("Calibrated")).toBeNull()
    cleanup()
    result = { ...(result as Result), calibrated: true }
    install()
    renderSheet()
    open()
    expect(screen.getByText("Calibrated")).toBeTruthy()
  })

  it("hides the breakdown for a completed-but-incomplete role (drift added a criterion after completion)", () => {
    // results.ts: a criterion added afterwards can leave a completed role
    // incomplete again, reading back as complete=false, level=null while
    // completed stays true. The breakdown must not render a partial reveal for
    // that state (mirrors rating-result.tsx's own completed/complete/level gate).
    result = {
      ...(result as Result),
      complete: false,
      score: null,
      level: null,
    }
    install()
    renderSheet()
    open()
    expect(screen.queryByText("Level 3")).toBeNull()
    expect(screen.queryByText("Complexity")).toBeNull()
    // The completion is real and stays named: what changed is that the role now
    // carries an unrated criterion, which is a different thing from never
    // having been evaluated.
    expect(screen.getByText("Completed")).toBeTruthy()
    expect(
      screen.getByText(messages.dashboard.roles.detail.completedIncomplete)
    ).toBeTruthy()
    expect(screen.queryByText("Not yet evaluated")).toBeNull()
  })

  it("shows ready-to-complete wording for a rated role that is not yet completed", () => {
    result = {
      ...(result as Result),
      completed: false,
      score: null,
      level: null,
    }
    install()
    renderSheet()
    open()
    expect(screen.getByText("Ready to complete")).toBeTruthy()
    // Not revealed: no level badge, no breakdown, no incomplete-progress line.
    expect(screen.queryByText("Level 3")).toBeNull()
    expect(screen.queryByText("Complexity")).toBeNull()
    expect(screen.queryByText("3 / 3 criteria assessed")).toBeNull()
  })

  it("shows progress and no per-criterion values for an incomplete role", () => {
    result = {
      ...(result as Result),
      complete: false,
      completed: false,
      score: null,
      level: null,
    }
    install()
    renderSheet()
    open()
    expect(screen.getByText("Not yet evaluated")).toBeTruthy()
    expect(screen.getByText("2 / 3 criteria assessed")).toBeTruthy()
    expect(screen.queryByText("Scope")).toBeNull()
  })

  it("links to the full role page", () => {
    renderSheet()
    open()
    const link = screen.getByRole("link", { name: "Open role" })
    expect(link.getAttribute("href")).toBe("/roles/role_1")
  })

  it("shows a not-found message when the role is null", () => {
    role = null
    install()
    renderSheet()
    open()
    expect(screen.getByText("This role does not exist.")).toBeTruthy()
  })
})

// STATE PRIORITY. The sheet leads with whatever the role most needs from the
// reader, and a flagged placement REPLACES the evaluation: a role raising a
// question has one thing to say, and the weighting breakdown under it is what
// the reader would otherwise scroll past to reach the act.
describe("RoleSheet state priority", () => {
  beforeEach(() => install())
  afterEach(() => cleanup())

  const cal = messages.dashboard.levels.calibration
  const anchor = messages.dashboard.roles.anchor

  function completed(over: Partial<Result> = {}): Result {
    return {
      roleId: "role_1",
      title: "Engineer",
      complete: true,
      completed: true,
      calibrated: false,
      methodDrift: false,
      profileLimited: false,
      profileFailures: null,
      ratedCount: 3,
      totalCriteria: 3,
      score: 70,
      level: 4,
      criteria: [
        {
          criterionId: "c1",
          name: "Scope",
          weightPoints: 3,
          value: 4,
          motivation: null,
        },
      ],
      ...over,
    }
  }

  it("replaces the evaluation with the review block for a capped placement", () => {
    role = baseRole()
    result = completed({
      profileLimited: true,
      profileFailures: [
        { criterionId: "c1", name: "Scope", required: 4, actual: 3 },
      ],
    })
    renderSheet()
    open()
    // Reason before act, and the evidence for it.
    expect(screen.getByText(cal.profileLimitedReason)).toBeDefined()
    expect(screen.getByRole("button", { name: cal.confirmCta })).toBeDefined()
    // The evaluation is GONE, not pushed below the fold.
    expect(screen.queryByText("Scope")).toBeNull()
  })

  it("offers the review's own decisions for a deviating anchor", () => {
    role = {
      ...baseRole(),
      anchorRole: {
        expectedLevel: 2,
        motivation: "Reference role",
        status: "active" as const,
        reviewedAt: 0,
      },
    }
    result = completed({ level: 4 })
    renderSheet()
    open()
    expect(
      screen.getByText(
        cal.anchorDeviationReason
          .replace("{level}", "4")
          .replace("{expected}", "2")
      )
    ).toBeDefined()
    // The decisions, not the manage form: the form is the advanced path now.
    expect(
      screen.getByRole("button", {
        name: anchor.alignCta.replace("{level}", "4"),
      })
    ).toBeDefined()
    expect(screen.queryByRole("button", { name: anchor.manageCta })).toBeNull()
  })

  it("sends a stale placement back to its assessment", () => {
    role = baseRole()
    result = completed({ methodDrift: true })
    renderSheet()
    open()
    expect(screen.getByText(cal.staleMethodReason)).toBeDefined()
    expect(
      screen.getByRole("link", { name: cal.rateCta }).getAttribute("href")
    ).toBe("/roles/role_1/rate")
  })

  // An unflagged ANCHOR manages where you SEE it. The role page's own menu
  // keeps its shortcut, but a reader who opened this sheet from the ladder
  // should not have to leave it to change an agreed level.
  it("offers anchor management on an unflagged anchor role", () => {
    role = {
      ...baseRole(),
      anchorRole: {
        expectedLevel: 4,
        motivation: "Reference role",
        status: "active" as const,
        reviewedAt: 0,
      },
    }
    result = completed({ level: 4 })
    renderSheet()
    open()
    expect(screen.queryByText(cal.profileLimitedReason)).toBeNull()
    expect(screen.getByRole("button", { name: anchor.manageCta })).toBeDefined()
    // And the evaluation it did not replace.
    expect(screen.getByText("Scope")).toBeDefined()
  })

  it("shows an unflagged role its contributions and no review block", () => {
    role = baseRole()
    result = completed()
    renderSheet()
    open()
    expect(screen.getByText("Scope")).toBeDefined()
    expect(screen.queryByText(cal.profileLimitedReason)).toBeNull()
    expect(screen.queryByRole("button", { name: cal.confirmCta })).toBeNull()
  })
})

// The close button's corner is RESERVED, structurally.
//
// The owner saw the close covered by the header's own content: this sheet
// lays a title, a track chip, a level badge and up to three status chips on
// one row, and with nothing reserving the corner they ran under the button and
// took its clicks. The reservation lives in the vendored SheetHeader, so no
// call site can forget it and no future sheet inherits the bug.
//
// jsdom measures no boxes, so what is pinned is the ANATOMY that guarantees
// the geometry: the header reserves the corner, the close renders in its own
// slot above it, and the title truncates inside the reserved space rather than
// wrapping under the button.
describe("RoleSheet close-button reservation", () => {
  beforeEach(() => install())
  afterEach(() => cleanup())

  it("keeps the close clear of a long title and its trailing chips", () => {
    role = {
      ...baseRole(),
      title:
        "Senior Principal Engineering Manager for Platform Infrastructure and Reliability",
    }
    result = {
      roleId: "role_1",
      title: "Engineer",
      complete: true,
      completed: true,
      calibrated: true,
      methodDrift: true,
      profileLimited: false,
      profileFailures: null,
      ratedCount: 3,
      totalCriteria: 3,
      score: 70,
      level: 4,
      criteria: [],
    }
    renderSheet()
    open()

    const header = document.querySelector(
      '[data-slot="sheet-header"]'
    ) as HTMLElement
    // The reserved corner. pr-12 against a size-7 close at right-3.
    expect(header.className).toContain("pr-12")

    // The close is its own slot, outside the header's flow, and layered above.
    const close = document.querySelector(
      '[data-slot="sheet-content"] > [data-slot="sheet-close"]'
    ) as HTMLElement
    expect(close).not.toBeNull()
    expect(header.contains(close)).toBe(false)
    expect(close.className).toContain("z-10")

    // A title too long for its line gives way INSIDE the reserved space.
    const title = document.querySelector(
      '[data-slot="sheet-title"]'
    ) as HTMLElement
    expect(title.className).toContain("truncate")
    // And the chips that sit beside it are still inside the header, so the
    // reservation governs them too.
    expect(
      header.querySelector('[data-slot="badge"], .rounded-full, span')
    ).not.toBeNull()
  })
})

// THE REVIEW OFFERS DECISIONS, NOT A FORM.
//
// The deviation asks one thing: the assessment and the agreement disagree, so
// which of them moves? The front door used to be the manage form, where the
// answer was a status select — bookkeeping vocabulary that asks the reader to
// translate a decision into a field value and then work out what the value
// does. Each answer is an act now, and each says what it will do first.
describe("RoleSheet anchor review acts", () => {
  const updateAnchor = mockMutation("assessment.anchorRoles.updateAnchorRole")
  const anchor = messages.dashboard.roles.anchor

  beforeEach(() => {
    install()
    updateAnchor.mockReset().mockResolvedValue(null)
    role = {
      ...baseRole(),
      anchorRole: {
        expectedLevel: 8,
        motivation: "Reference role",
        status: "active" as const,
        reviewedAt: 0,
      },
    }
    result = {
      roleId: "role_1",
      title: "Engineer",
      complete: true,
      completed: true,
      calibrated: false,
      methodDrift: false,
      profileLimited: false,
      profileFailures: null,
      ratedCount: 3,
      totalCriteria: 3,
      score: 90,
      level: 11,
      criteria: [],
    }
  })
  afterEach(() => cleanup())

  function openSheet() {
    renderSheet()
    open()
  }

  it("offers three answers, each with what it will do", () => {
    openSheet()
    const align = anchor.alignCta.replace("{level}", "11")
    for (const [label, consequence] of [
      [align, anchor.alignConsequence.replace("{level}", "11")],
      [
        messages.dashboard.levels.calibration.rateCta,
        anchor.reassessConsequence,
      ],
      [anchor.retireCta, anchor.retireConsequence],
    ]) {
      expect(screen.getByText(label as string)).toBeDefined()
      expect(screen.getByText(consequence as string)).toBeDefined()
    }
  })

  // Answer 1: the assessment is right, so the agreement moves to meet it.
  it("aligns the agreed level with the computed one", async () => {
    openSheet()
    fireEvent.click(
      screen.getByRole("button", {
        name: anchor.alignCta.replace("{level}", "11"),
      })
    )
    await waitFor(() => {
      expect(updateAnchor).toHaveBeenCalledWith({
        orgId: "org_1",
        roleId: "role_1",
        expectedLevel: 11,
      })
    })
  })

  // Answer 3: the role is no longer a good reference. The role itself is
  // untouched; only its anchor duty ends.
  it("retires the anchor without touching the role", async () => {
    openSheet()
    fireEvent.click(screen.getByRole("button", { name: anchor.retireCta }))
    await waitFor(() => {
      expect(updateAnchor).toHaveBeenCalledWith({
        orgId: "org_1",
        roleId: "role_1",
        status: "replaced",
      })
    })
  })

  // The form survives as the advanced path; a review just never needs it.
  it("keeps the full form reachable behind its own affordance", () => {
    openSheet()
    expect(
      screen.getByRole("button", { name: anchor.detailsCta })
    ).toBeDefined()
  })

  // A retired anchor is not a live reference: it cannot deviate from anything,
  // so it states its retirement instead of wearing the deviation chip, and it
  // raises no review at all.
  it("shows a retired anchor its state, never a deviation", () => {
    role = {
      ...baseRole(),
      anchorRole: {
        expectedLevel: 8,
        motivation: "Reference role",
        status: "replaced" as const,
        reviewedAt: 0,
      },
    }
    openSheet()
    expect(screen.getByText(anchor.statusReplaced)).toBeDefined()
    expect(
      screen.queryByText(
        messages.dashboard.levels.deviation.replace("{level}", "8")
      )
    ).toBeNull()
    expect(screen.queryByText(anchor.retireCta)).toBeNull()
  })
})
