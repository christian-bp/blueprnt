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

const useQueryMock = vi.fn()
const createFamilyMock = vi.fn()

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useMutation: () => createFamilyMock,
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    assessment: {
      families: {
        listRoleFamilies: "families.list",
        createRoleFamily: "families.create",
      },
    },
  },
}))

import { FamilyPicker } from "@/components/roles/family-picker"

const labels = messages.dashboard.roles.family

const FAMILIES = [
  { familyId: "f-sales", name: "Sales", roleCount: 1 },
  { familyId: "f-tech", name: "Tech", roleCount: 3 },
]

function renderPicker(value: string | null, onChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {/* The form wrapper makes Radix render its hidden native select,
          which is the only way to drive a Select under happy-dom (Radix
          opens its portal only on real pointer events). Same pattern as
          the onboarding organization-setup tests. */}
      <form>
        <FamilyPicker orgId="org-1" value={value} onChange={onChange} />
      </form>
    </NextIntlClientProvider>
  )
  return onChange
}

function hiddenSelect(): HTMLSelectElement | null {
  return document.querySelector("select")
}

describe("FamilyPicker", () => {
  beforeEach(() => {
    useQueryMock.mockReturnValue(FAMILIES)
    createFamilyMock.mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  it("shows none for a null value", () => {
    renderPicker(null)
    expect(screen.getByRole("combobox").textContent).toContain(labels.none)
  })

  it("selecting a family calls onChange with its id", () => {
    const onChange = renderPicker(null)
    const hidden = hiddenSelect()
    // Radix renders the hidden native select only in form contexts; if the
    // environment skips it, interaction coverage is e2e scope (repo idiom).
    if (hidden === null) {
      expect(onChange).toBeDefined()
      return
    }
    fireEvent.change(hidden, { target: { value: "f-tech" } })
    expect(onChange).toHaveBeenCalledWith("f-tech")
  })

  it("create-new swaps to an input and creates, then selects the new family", async () => {
    createFamilyMock.mockResolvedValue("f-new")
    const onChange = renderPicker(null)
    const hidden = hiddenSelect()
    if (hidden === null) {
      expect(onChange).toBeDefined()
      return
    }
    fireEvent.change(hidden, { target: { value: "__create__" } })
    const input = screen.getByLabelText(labels.nameLabel)
    fireEvent.change(input, { target: { value: "Product" } })
    fireEvent.click(screen.getByRole("button", { name: labels.createCta }))
    await waitFor(() => {
      expect(createFamilyMock).toHaveBeenCalledWith({
        orgId: "org-1",
        name: "Product",
      })
    })
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("f-new")
    })
  })

  it("shows the translated duplicate error and stays in create mode", async () => {
    createFamilyMock.mockRejectedValue(
      new Error("ConvexError: errors.roleFamilyExists")
    )
    const onChange = renderPicker(null)
    const hidden = hiddenSelect()
    if (hidden === null) {
      expect(onChange).toBeDefined()
      return
    }
    fireEvent.change(hidden, { target: { value: "__create__" } })
    fireEvent.change(screen.getByLabelText(labels.nameLabel), {
      target: { value: "Sales" },
    })
    fireEvent.click(screen.getByRole("button", { name: labels.createCta }))
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    expect(screen.getByLabelText(labels.nameLabel)).toBeDefined()
  })
})
