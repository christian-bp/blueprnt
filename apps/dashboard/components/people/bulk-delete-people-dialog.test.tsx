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

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org1", name: "Acme", role: "admin" }),
}))

import { BulkDeletePeopleDialog } from "@/components/people/bulk-delete-people-dialog"
import { toast } from "@/lib/toast"
import { mockMutation } from "@/test/convex-mocks"

const eraseMock = mockMutation("people.erase.erasePersonAsOrg")
const m = messages.dashboard.people

function renderDialog(
  personIds: string[] = ["p1", "p2"],
  onDeleted = vi.fn(),
  onOpenChange = vi.fn()
) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BulkDeletePeopleDialog
        open={true}
        onOpenChange={onOpenChange}
        personIds={personIds}
        onDeleted={onDeleted}
      />
    </NextIntlClientProvider>
  )
  return { onDeleted, onOpenChange }
}

// Types into the confirm field, which is what arms the destructive action.
function typeToken(token = "DELETE") {
  const input = screen.getByLabelText(m.bulk.confirmLabel)
  fireEvent.change(input, { target: { value: token } })
}

// The destructive action is armed only once the typed token validates, which
// RHF resolves asynchronously.
async function waitForArmed() {
  await waitFor(() =>
    expect(screen.getByRole("button", { name: m.bulk.confirm })).toHaveProperty(
      "disabled",
      false
    )
  )
}

describe("BulkDeletePeopleDialog", () => {
  beforeEach(() => {
    eraseMock.mockReset()
    eraseMock.mockResolvedValue(null)
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  it("keeps the destructive action disabled until DELETE is typed", async () => {
    renderDialog()
    expect(screen.getByRole("button", { name: m.bulk.confirm })).toHaveProperty(
      "disabled",
      true
    )

    typeToken("DELET")
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: m.bulk.confirm })
      ).toHaveProperty("disabled", true)
    )

    typeToken("DELETE")
    await waitForArmed()
  })

  it("erases one person per call, in order, then toasts the count and closes", async () => {
    const { onDeleted, onOpenChange } = renderDialog(["p1", "p2", "p3"])
    typeToken()
    await waitForArmed()
    fireEvent.click(screen.getByRole("button", { name: m.bulk.confirm }))

    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(eraseMock).toHaveBeenCalledTimes(3)
    expect(eraseMock.mock.calls.map((c) => c[0])).toEqual([
      { orgId: "org1", personId: "p1" },
      { orgId: "org1", personId: "p2" },
      { orgId: "org1", personId: "p3" },
    ])
    expect(onDeleted).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("stops at the failing person, keeps the dialog open, and does not report success", async () => {
    eraseMock
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("boom"))
    const { onDeleted, onOpenChange } = renderDialog(["p1", "p2", "p3"])
    typeToken()
    await waitForArmed()
    fireEvent.click(screen.getByRole("button", { name: m.bulk.confirm }))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    // The third person is never attempted: the loop stops at the failure.
    expect(eraseMock).toHaveBeenCalledTimes(2)
    expect(toast.success).not.toHaveBeenCalled()
    expect(onDeleted).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    // The dialog stays mounted with an inline error, so a retry finishes the rest.
    expect(screen.getByRole("alertdialog")).toBeDefined()
    expect(screen.getByRole("alert").textContent).toBe(m.bulk.error)
  })

  it("closes without writing anything when the selection pruned to empty", async () => {
    const { onDeleted, onOpenChange } = renderDialog([])
    typeToken()
    await waitForArmed()
    fireEvent.click(screen.getByRole("button", { name: m.bulk.confirm }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(eraseMock).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(onDeleted).not.toHaveBeenCalled()
  })
})
