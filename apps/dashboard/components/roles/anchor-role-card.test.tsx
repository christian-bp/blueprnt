import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)

const orgMock = { orgId: "org-1", name: "Acme", role: "admin" }
vi.mock("@/components/org-context", () => ({
  useOrganization: () => orgMock,
}))

import { AnchorRoleCard } from "@/components/roles/anchor-role-card"
import { mockMutation, onQuery } from "@/test/convex-mocks"

const labels = messages.dashboard.roles.anchor

const designateMock = mockMutation("assessment.anchorRoles.designateAnchorRole")
const updateMock = mockMutation("assessment.anchorRoles.updateAnchorRole")

// Seven bands, like the standard template.
const MODEL = {
  bandThresholds: Array.from({ length: 7 }, (_, index) => ({
    band: index + 1,
    minScore: 90 - index * 10,
  })),
}

let anchorList: { status: string }[] = []
onQuery((ref) => {
  if (ref === "evaluationModel.model.getModel") return MODEL
  if (ref === "assessment.anchorRoles.listAnchorRoles") return anchorList
  return undefined
})

const ACTIVE_ANCHOR = {
  expectedBand: 3,
  motivation: "Well-known reference role.",
  status: "active" as const,
  reviewedAt: Date.UTC(2026, 5, 1),
}

function renderCard(props?: Partial<Parameters<typeof AnchorRoleCard>[0]>) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {/* The form wrapper makes Radix render its hidden native selects,
          which is the only way to drive a Select under happy-dom (same
          pattern as the family-picker tests). */}
      <form>
        <AnchorRoleCard
          orgId="org-1"
          roleId={"role-1" as never}
          anchorRole={null}
          assessmentComplete={true}
          archived={false}
          {...props}
        />
      </form>
    </NextIntlClientProvider>
  )
}

function hiddenSelects(): HTMLSelectElement[] {
  return [...document.querySelectorAll("select")]
}

describe("AnchorRoleCard", () => {
  beforeEach(() => {
    designateMock.mockReset()
    updateMock.mockReset()
    orgMock.role = "admin"
    anchorList = []
  })
  afterEach(() => {
    cleanup()
  })

  it("renders nothing for a non-admin when the role is not an anchor", () => {
    orgMock.role = "editor"
    renderCard()
    expect(screen.queryByText(labels.heading)).toBeNull()
  })

  it("gates designation on a complete assessment", () => {
    renderCard({ assessmentComplete: false })
    expect(screen.getByText(labels.requiresAssessment)).toBeDefined()
    expect(
      screen.queryByRole("button", { name: labels.designateCta })
    ).toBeNull()
  })

  it("designates with the chosen band and motivation", async () => {
    designateMock.mockResolvedValue(null)
    renderCard()

    const designateButton = screen.getByRole("button", {
      name: labels.designateCta,
    })
    // No band and no motivation yet: the call is not possible.
    expect(designateButton.hasAttribute("disabled")).toBe(true)

    const bandSelect = hiddenSelects()[0]
    if (bandSelect === undefined) throw new Error("band select not rendered")
    fireEvent.change(bandSelect, { target: { value: "3" } })
    fireEvent.change(screen.getByLabelText(labels.motivationLabel), {
      target: { value: "  Stable reference.  " },
    })
    fireEvent.click(screen.getByRole("button", { name: labels.designateCta }))

    await waitFor(() => {
      expect(designateMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        expectedBand: 3,
        motivation: "Stable reference.",
      })
    })
  })

  it("shows the error line when designation fails", async () => {
    designateMock.mockRejectedValue(new Error("errors.invalidInput"))
    renderCard()

    const bandSelect = hiddenSelects()[0]
    if (bandSelect === undefined) throw new Error("band select not rendered")
    fireEvent.change(bandSelect, { target: { value: "3" } })
    fireEvent.change(screen.getByLabelText(labels.motivationLabel), {
      target: { value: "m" },
    })
    fireEvent.click(screen.getByRole("button", { name: labels.designateCta }))

    await waitFor(() => {
      expect(screen.getByText(labels.error)).toBeDefined()
    })
  })

  it("hints that 2 to 5 anchors are enough once 5 are active", () => {
    anchorList = Array.from({ length: 5 }, () => ({ status: "active" }))
    renderCard()
    expect(
      screen.getByText(labels.tooMany.replace("{count}", "5"))
    ).toBeDefined()
  })

  it("updates only the changed fields of an existing designation", async () => {
    updateMock.mockResolvedValue(null)
    renderCard({ anchorRole: ACTIVE_ANCHOR })

    const saveButton = screen.getByRole("button", { name: labels.updateCta })
    // Nothing changed yet.
    expect(saveButton.hasAttribute("disabled")).toBe(true)

    fireEvent.change(screen.getByLabelText(labels.motivationLabel), {
      target: { value: "Updated motivation." },
    })
    fireEvent.click(screen.getByRole("button", { name: labels.updateCta }))

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        motivation: "Updated motivation.",
      })
    })
  })

  it("shows a read-only summary to non-admins when the role is an anchor", () => {
    orgMock.role = "editor"
    renderCard({ anchorRole: ACTIVE_ANCHOR })
    expect(screen.getByText(labels.statusActive)).toBeDefined()
    expect(screen.getByText(ACTIVE_ANCHOR.motivation)).toBeDefined()
    expect(screen.queryByRole("button", { name: labels.updateCta })).toBeNull()
  })
})
