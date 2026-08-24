import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { PayMappingPreconditionsPanel } from "@/components/pay-mapping/pay-mapping-preconditions-panel"

// modelApproved/driftedRolesCount default to the all-clear state so every
// pre-existing call below (about the people/role rows only) keeps exercising
// exactly what it did before; the approval and drift tests override them.
function renderPanel(
  props: Omit<
    Parameters<typeof PayMappingPreconditionsPanel>[0],
    "modelApproved" | "driftedRolesCount"
  > &
    Partial<
      Pick<
        Parameters<typeof PayMappingPreconditionsPanel>[0],
        "modelApproved" | "driftedRolesCount"
      >
    >
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PayMappingPreconditionsPanel
        modelApproved={true}
        driftedRolesCount={0}
        {...props}
      />
    </NextIntlClientProvider>
  )
}

describe("PayMappingPreconditionsPanel", () => {
  afterEach(cleanup)

  it("shows the classify line with the live count, linking to the classify surface", () => {
    renderPanel({ peopleCount: 8, unclassifiedCount: 6, unevaluatedRoles: [] })
    expect(screen.getByText("Not ready yet")).toBeDefined()
    const line = screen.getByText("6 people are not classified yet")
    expect(line.closest("a")?.getAttribute("href")).toBe("/people/classify")
    expect(screen.queryByText(/evaluation/)).toBeNull()
  })

  it("shows the import line first, linking to the import, when the org has no people", () => {
    renderPanel({ peopleCount: 0, unclassifiedCount: 0, unevaluatedRoles: [] })
    const line = screen.getByText("No employees have been imported yet")
    expect(line.closest("a")?.getAttribute("href")).toBe("/people/import")
    expect(screen.queryByText(/classified/)).toBeNull()
  })

  it("singularizes the classify line for one person", () => {
    renderPanel({ peopleCount: 8, unclassifiedCount: 1, unevaluatedRoles: [] })
    expect(screen.getByText("1 person is not classified yet")).toBeDefined()
  })

  it("shows the evaluate line and lists the unevaluated roles, each linking to its own page", () => {
    renderPanel({
      peopleCount: 8,
      unclassifiedCount: 0,
      unevaluatedRoles: [
        { roleId: "r1", title: "Designer", slug: "designer" },
        { roleId: "r2", title: "Analyst", slug: "analyst" },
      ],
    })
    const line = screen.getByText(
      "2 roles with employees still need their assessments completed"
    )
    expect(line.closest("a")?.getAttribute("href")).toBe("/roles")
    const designerLink = screen.getByText("Designer").closest("a")
    expect(designerLink?.getAttribute("href")).toBe("/roles/designer")
    const analystLink = screen.getByText("Analyst").closest("a")
    expect(analystLink?.getAttribute("href")).toBe("/roles/analyst")
  })

  it("caps the listed roles at MAX_ITEMS while the evaluate line keeps the full count", () => {
    const unevaluatedRoles = Array.from({ length: 6 }, (_, i) => ({
      roleId: `r${i}`,
      title: `Role ${i}`,
      slug: `role-${i}`,
    }))
    renderPanel({ peopleCount: 8, unclassifiedCount: 0, unevaluatedRoles })
    expect(
      screen.getByText(
        "6 roles with employees still need their assessments completed"
      )
    ).toBeDefined()
    expect(screen.getAllByText(/^Role \d$/)).toHaveLength(4)
  })

  it("shows both lines together when both conditions are unmet", () => {
    renderPanel({
      peopleCount: 8,
      unclassifiedCount: 2,
      unevaluatedRoles: [{ roleId: "r1", title: "Designer", slug: "designer" }],
    })
    expect(screen.getByText("2 people are not classified yet")).toBeDefined()
    expect(
      screen.getByText(
        "1 role with employees still needs its assessment completed"
      )
    ).toBeDefined()
  })

  it("shows the approval line, leading the other rows, linking to the model's Approval chapter, only while the model is unapproved", () => {
    renderPanel({
      peopleCount: 8,
      unclassifiedCount: 2,
      unevaluatedRoles: [],
      modelApproved: false,
    })
    const line = screen.getByText(
      "The model must be approved before a pay mapping can start"
    )
    expect(line.closest("a")?.getAttribute("href")).toBe("/model/approval")
  })

  it("omits the approval line once the model is approved", () => {
    renderPanel({ peopleCount: 8, unclassifiedCount: 2, unevaluatedRoles: [] })
    expect(
      screen.queryByText(
        "The model must be approved before a pay mapping can start"
      )
    ).toBeNull()
  })

  it("shows the non-blocking drift warning alongside a blocking row, pluralized by count", () => {
    renderPanel({
      peopleCount: 8,
      unclassifiedCount: 2,
      unevaluatedRoles: [],
      driftedRolesCount: 2,
    })
    expect(
      screen.getByText(
        "2 roles were assessed under an earlier version of the method. Consider re-evaluating them first."
      )
    ).toBeDefined()
  })

  it("singularizes the drift warning for one role", () => {
    renderPanel({
      peopleCount: 8,
      unclassifiedCount: 0,
      unevaluatedRoles: [],
      driftedRolesCount: 1,
    })
    expect(
      screen.getByText(
        "1 role was assessed under an earlier version of the method. Consider re-evaluating it first."
      )
    ).toBeDefined()
  })

  it("omits the drift warning when no role is drifted", () => {
    renderPanel({ peopleCount: 8, unclassifiedCount: 2, unevaluatedRoles: [] })
    expect(screen.queryByText(/earlier version of the method/)).toBeNull()
  })
})
