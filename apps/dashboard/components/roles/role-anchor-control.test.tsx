import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { pickSelectOption } from "@/test/select"

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
  AnchorDialog,
  type AnchorRoleInfo,
} from "@/components/roles/role-anchor-control"

const anchor = messages.dashboard.roles.anchor

const designated: AnchorRoleInfo = {
  expectedBand: 2,
  motivation: "Reference role for the platform track",
  status: "active",
  reviewedAt: 1_700_000_000_000,
}

function wrap(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {node}
    </NextIntlClientProvider>
  )
}

// A stateful host so AnchorDialog actually unmounts its form when it closes on
// success (open flips to false via onOpenChange).
function HostedDialog({ anchorRole }: { anchorRole: AnchorRoleInfo | null }) {
  const [open, setOpen] = useState(true)
  return (
    <AnchorDialog
      open={open}
      onOpenChange={setOpen}
      orgId="org-1"
      roleId={"role-1" as never}
      anchorRole={anchorRole}
    />
  )
}

describe("AnchorDialog", () => {
  beforeEach(() => {
    designateMock.mockReset()
    updateMock.mockReset()
  })
  afterEach(() => cleanup())

  it("submits the designate form and closes on success", async () => {
    designateMock.mockResolvedValue(null)
    wrap(<HostedDialog anchorRole={null} />)

    // The real Base UI Select works inside the portaled dialog; drive its
    // popup listbox directly.
    await pickSelectOption(
      screen.getByRole("combobox", { name: anchor.expectedBandLabel }),
      anchor.bandOption.replace("{band}", "2")
    )
    fireEvent.change(screen.getByLabelText(anchor.motivationLabel), {
      target: { value: "  Stable reference role.  " },
    })
    fireEvent.click(screen.getByRole("button", { name: anchor.designateCta }))

    await waitFor(() => {
      expect(designateMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        expectedBand: 2,
        motivation: "Stable reference role.",
      })
    })
    await waitFor(() =>
      expect(screen.queryByLabelText(anchor.motivationLabel)).toBeNull()
    )
  })

  it("submits the edit form and closes on success", async () => {
    updateMock.mockResolvedValue(null)
    wrap(<HostedDialog anchorRole={designated} />)

    fireEvent.change(screen.getByLabelText(anchor.motivationLabel), {
      target: { value: "Updated rationale" },
    })
    fireEvent.click(screen.getByRole("button", { name: anchor.updateCta }))

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        motivation: "Updated rationale",
      })
    })
    await waitFor(() =>
      expect(screen.queryByLabelText(anchor.motivationLabel)).toBeNull()
    )
  })
})
