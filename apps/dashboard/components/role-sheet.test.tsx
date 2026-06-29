import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { onQuery } from "@/test/convex-mocks"

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
    anchorRole: null,
    ratings: [],
  }
}
type Role = ReturnType<typeof baseRole>

type Result = {
  roleId: string
  title: string
  complete: boolean
  ratedCount: number
  totalCriteria: number
  score: number | null
  band: number | null
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
      ratedCount: 3,
      totalCriteria: 3,
      score: 71,
      band: 3,
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

  it("shows the band and a compact breakdown (no raw score) for a complete role", () => {
    renderSheet()
    open()
    expect(screen.getByText("Engineer")).toBeTruthy()
    expect(screen.getByText("Band 3")).toBeTruthy()
    // The raw 0-100 weighting is intentionally not shown in the sheet.
    expect(screen.queryByText("71 / 100")).toBeNull()
    // Breakdown is present but compact: names + shares, no "rated X / 5".
    expect(screen.getByText("Complexity")).toBeTruthy()
    expect(screen.getByText("57%")).toBeTruthy()
    expect(screen.queryByText("rated 5 / 5")).toBeNull()
  })

  it("shows progress and no per-criterion values for an incomplete role", () => {
    result = { ...(result as Result), complete: false, score: null, band: null }
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
