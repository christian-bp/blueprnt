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

const designateMock = vi.fn()
const updateMock = vi.fn()

// Radix Select renders its hidden native <select> only when the trigger is
// inside a <form>. Because the dialog content is portaled to document.body
// (outside any <form>), the hidden-select pattern is unavailable for the band
// field. Mock the Select primitives with simple native elements so
// fireEvent.change works directly in the dialog tests.
import * as React from "react"

type SelectCtx = {
  value: string
  onChange: (v: string) => void
  disabled: boolean
}
const SelectContext = React.createContext<SelectCtx>({
  value: "",
  onChange: () => {},
  disabled: false,
})

function MockSelect({
  value = "",
  onValueChange = () => {},
  disabled = false,
  children,
}: {
  value?: string
  onValueChange?: (v: string) => void
  disabled?: boolean
  children?: React.ReactNode
}) {
  return (
    <SelectContext.Provider
      value={{ value, onChange: onValueChange, disabled }}
    >
      {children}
    </SelectContext.Provider>
  )
}
function MockSelectTrigger({
  id,
  children,
}: {
  id?: string
  children?: React.ReactNode
}) {
  const ctx = React.useContext(SelectContext)
  return (
    <button
      type="button"
      id={id}
      role="combobox"
      aria-expanded={false}
      disabled={ctx.disabled}
    >
      {children}
    </button>
  )
}
function MockSelectValue({ placeholder }: { placeholder?: string }) {
  const ctx = React.useContext(SelectContext)
  return <span>{ctx.value || placeholder}</span>
}
function MockSelectContent({ children }: { children?: React.ReactNode }) {
  const ctx = React.useContext(SelectContext)
  return (
    <select
      value={ctx.value}
      disabled={ctx.disabled}
      onChange={(e) => ctx.onChange(e.target.value)}
      aria-hidden
    >
      {children}
    </select>
  )
}
function MockSelectItem({
  value,
  children,
}: {
  value: string
  children?: React.ReactNode
}) {
  return <option value={value}>{children}</option>
}

vi.mock("@workspace/ui/components/select", () => ({
  Select: MockSelect,
  SelectTrigger: MockSelectTrigger,
  SelectValue: MockSelectValue,
  SelectContent: MockSelectContent,
  SelectItem: MockSelectItem,
}))

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

    const bandSelect = [
      ...document.querySelectorAll("select"),
    ][0] as HTMLSelectElement
    if (bandSelect === undefined) throw new Error("band select not found")
    fireEvent.change(bandSelect, { target: { value: "2" } })
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
