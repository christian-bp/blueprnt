import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { ConvexError } from "convex/values"
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
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { LibraryPickerDialog } from "@/components/model/library-picker-dialog"
import { toast } from "@/lib/toast"
import { mockMutation } from "@/test/convex-mocks"

const activateCriterionMock = mockMutation(
  "evaluationModel.criteria.activateCriterion"
)
const picker = messages.dashboard.model.picker
const errors = messages.errors

function renderPicker(selectedKeys: readonly string[] = []) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <LibraryPickerDialog
        orgId="org-1"
        dimensionKey="effort"
        dimensionName="Effort"
        selectedKeys={selectedKeys}
      />
    </NextIntlClientProvider>
  )
}

describe("LibraryPickerDialog", () => {
  beforeEach(() => {
    activateCriterionMock.mockReset()
  })
  afterEach(() => cleanup())

  it("lists the dimension's unselected library entries, excluding selected ones", async () => {
    renderPicker(["complexity-ambiguity"])
    fireEvent.click(screen.getByRole("button", { name: picker.addCta }))
    // complexity-ambiguity (effort) is already selected: not offered again.
    expect(
      await screen.findByText("Analytical and problem-solving effort")
    ).toBeDefined()
    expect(screen.queryByText("Complexity and ambiguity")).toBeNull()
    // A competence-dimension entry never appears in an effort picker.
    expect(
      screen.queryByText("Knowledge depth and specialist level")
    ).toBeNull()
  })

  it("shows the empty state once every entry in the dimension is selected", async () => {
    renderPicker([
      "complexity-ambiguity",
      "analytical-effort",
      "communication-effort",
      "operational-intensity",
      "physical-sensory",
    ])
    fireEvent.click(screen.getByRole("button", { name: picker.addCta }))
    expect(await screen.findByText(picker.empty)).toBeDefined()
  })

  it("adding a criterion calls activateCriterion and shows a success toast", async () => {
    activateCriterionMock.mockResolvedValue("crit-1")
    renderPicker()
    fireEvent.click(screen.getByRole("button", { name: picker.addCta }))
    const row = await screen.findByText("Complexity and ambiguity")
    fireEvent.click(
      row.closest("li")?.querySelector("button:last-child") as HTMLElement
    )
    await waitFor(() => {
      expect(activateCriterionMock).toHaveBeenCalledWith({
        orgId: "org-1",
        libraryKey: "complexity-ambiguity",
      })
    })
    expect(toast.success).toHaveBeenCalledWith(
      messages.dashboard.toast.criterionActivated
    )
  })

  it("surfaces a cap error as an error toast, not inline text", async () => {
    activateCriterionMock.mockRejectedValue(
      new ConvexError({ code: "errors.dimensionCapExceeded" })
    )
    renderPicker()
    fireEvent.click(screen.getByRole("button", { name: picker.addCta }))
    const row = await screen.findByText("Complexity and ambiguity")
    fireEvent.click(
      row.closest("li")?.querySelector("button:last-child") as HTMLElement
    )
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(errors.dimensionCapExceeded)
    })
  })

  it("the footer close button closes the dialog", async () => {
    renderPicker()
    fireEvent.click(screen.getByRole("button", { name: picker.addCta }))
    await screen.findByText("Complexity and ambiguity")
    // Scoped to the footer (portaled outside the render container, hence
    // document rather than container): the dialog's own top-right dismiss
    // icon carries an unrelated (vendor, unlocalized) "Close" accessible
    // name too.
    const footer = document.querySelector('[data-slot="dialog-footer"]')
    if (footer === null) throw new Error("no dialog footer rendered")
    fireEvent.click(
      within(footer as HTMLElement).getByRole("button", {
        name: picker.closeCta,
      })
    )
    await waitFor(() => {
      expect(screen.queryByText("Complexity and ambiguity")).toBeNull()
    })
  })
})
