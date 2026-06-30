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

const designateMock = vi.fn()
const updateMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) =>
    ref === "assessment.anchorRoles.designateAnchorRole"
      ? designateMock
      : ref === "assessment.anchorRoles.updateAnchorRole"
        ? updateMock
        : vi.fn(),
  useQuery: (ref: unknown) =>
    ref === "evaluationModel.model.getModel"
      ? { bandThresholds: [80, 60, 40, 20] }
      : ref === "assessment.anchorRoles.listAnchorRoles"
        ? []
        : undefined,
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    evaluationModel: { model: { getModel: "evaluationModel.model.getModel" } },
    assessment: {
      anchorRoles: {
        designateAnchorRole: "assessment.anchorRoles.designateAnchorRole",
        updateAnchorRole: "assessment.anchorRoles.updateAnchorRole",
        listAnchorRoles: "assessment.anchorRoles.listAnchorRoles",
      },
    },
  },
}))

import {
  type AnchorRoleInfo,
  RoleAnchorControl,
} from "@/components/roles/role-anchor-control"

const anchor = messages.dashboard.roles.anchor

const designated: AnchorRoleInfo = {
  expectedBand: 2,
  motivation: "Reference role for the platform track",
  status: "active",
  reviewedAt: 1_700_000_000_000,
}

function renderControl(props: {
  anchorRole?: AnchorRoleInfo | null
  isAdmin?: boolean
}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleAnchorControl
        orgId="org-1"
        roleId={"role-1" as never}
        anchorRole={props.anchorRole ?? null}
        isAdmin={props.isAdmin ?? true}
      />
    </NextIntlClientProvider>
  )
}

describe("RoleAnchorControl", () => {
  beforeEach(() => {
    designateMock.mockReset()
    updateMock.mockReset()
  })
  afterEach(() => cleanup())

  it("renders nothing for a non-admin on a role that is not an anchor", () => {
    const { container } = renderControl({ anchorRole: null, isAdmin: false })
    expect(container.textContent).toBe("")
  })

  it("shows the designate action for an admin on a non-anchor role", () => {
    renderControl({ anchorRole: null, isAdmin: true })
    expect(
      screen.getByRole("button", { name: anchor.designateCta })
    ).toBeDefined()
  })

  it("shows the read-only status for a non-admin on an anchor role", () => {
    renderControl({ anchorRole: designated, isAdmin: false })
    expect(screen.getByText(anchor.statusActive)).toBeDefined()
    expect(
      screen.getByText("Reference role for the platform track")
    ).toBeDefined()
    expect(screen.queryByRole("button", { name: anchor.manageCta })).toBeNull()
  })

  it("opens the manage dialog and updates on save for an admin on an anchor role", async () => {
    updateMock.mockResolvedValue(null)
    renderControl({ anchorRole: designated, isAdmin: true })
    fireEvent.click(screen.getByRole("button", { name: anchor.manageCta }))
    // The dialog shows the editable form (motivation pre-filled).
    const motivation = screen.getByLabelText(anchor.motivationLabel)
    fireEvent.change(motivation, { target: { value: "Updated rationale" } })
    fireEvent.click(screen.getByRole("button", { name: anchor.updateCta }))
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        motivation: "Updated rationale",
      })
    })
  })
})
