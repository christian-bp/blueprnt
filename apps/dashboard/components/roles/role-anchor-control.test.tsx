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

// Radix Select renders its hidden native <select> only when the trigger is
// inside a <form>. Because this component opens a dialog (whose content is
// portaled to document.body, outside any <form>), the hidden-select pattern
// is unavailable for the band field. Mock the Select primitives with simple
// native elements so fireEvent.change works directly in the dialog tests.
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
    // Dialog closes after a successful update.
    await waitFor(() =>
      expect(screen.queryByLabelText(anchor.motivationLabel)).toBeNull()
    )
  })

  it("opens the designate dialog, submits, and closes for an admin on a non-anchor role", async () => {
    designateMock.mockResolvedValue(null)
    renderControl({ anchorRole: null, isAdmin: true })

    // Open the designate dialog via the trigger button.
    fireEvent.click(screen.getByRole("button", { name: anchor.designateCta }))

    // The Select mock renders a native <select> inside SelectContent so we can
    // drive the band field with fireEvent.change (happy-dom pattern).
    const selects = [
      ...document.querySelectorAll("select"),
    ] as HTMLSelectElement[]
    const bandSelect = selects[0]
    if (bandSelect === undefined) throw new Error("band select not found")
    fireEvent.change(bandSelect, { target: { value: "2" } })

    // Fill in a motivation so the submit button becomes enabled.
    fireEvent.change(screen.getByLabelText(anchor.motivationLabel), {
      target: { value: "  Stable reference role.  " },
    })

    // The submit button is the last button named designateCta (the trigger is
    // outside the dialog; the form's submit button is inside it).
    const allButtons = screen.getAllByRole("button", {
      name: anchor.designateCta,
    })
    const submitButton = allButtons[allButtons.length - 1]
    if (submitButton === undefined) throw new Error("submit button not found")
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(designateMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        expectedBand: 2,
        motivation: "Stable reference role.",
      })
    })
    // Dialog closes after a successful designate.
    await waitFor(() =>
      expect(screen.queryByLabelText(anchor.motivationLabel)).toBeNull()
    )
  })
})
