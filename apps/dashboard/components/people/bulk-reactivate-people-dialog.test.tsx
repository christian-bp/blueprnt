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

// NumberFlow's custom element does not exist in jsdom; the progress readout
// only needs to render its value.
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}))

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

import { BulkReactivatePeopleDialog } from "@/components/people/bulk-reactivate-people-dialog"
import { toast } from "@/lib/toast"
import { mockMutation } from "@/test/convex-mocks"

const unarchiveMock = mockMutation("people.people.unarchivePerson")
const m = messages.dashboard.people.bulkReactivate

const ids = ["p1", "p2", "p3"]

function renderDialog(
  personIds: string[] = ids,
  onReactivated = vi.fn(),
  onOpenChange = vi.fn()
) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BulkReactivatePeopleDialog
        open={true}
        onOpenChange={onOpenChange}
        personIds={personIds}
        onReactivated={onReactivated}
      />
    </NextIntlClientProvider>
  )
  return { onReactivated, onOpenChange }
}

describe("BulkReactivatePeopleDialog", () => {
  beforeEach(() => {
    unarchiveMock.mockReset().mockResolvedValue(null)
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  it("reactivates every selected person, one call each in order, then reports success", async () => {
    const { onReactivated } = renderDialog()
    fireEvent.click(screen.getByRole("button", { name: m.confirm }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
    expect(unarchiveMock).toHaveBeenCalledTimes(3)
    expect(unarchiveMock.mock.calls.map((c) => c[0])).toEqual([
      { orgId: "org1", personId: "p1" },
      { orgId: "org1", personId: "p2" },
      { orgId: "org1", personId: "p3" },
    ])
    expect(onReactivated).toHaveBeenCalledTimes(1)
  })

  it("stops at the failing person, keeps the dialog open, and does not report success", async () => {
    unarchiveMock
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("boom"))
    const { onReactivated, onOpenChange } = renderDialog()
    fireEvent.click(screen.getByRole("button", { name: m.confirm }))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(toast.error).toHaveBeenCalledWith(messages.dashboard.toast.error)
    // The third person is never attempted: the loop stops at the failure.
    expect(unarchiveMock).toHaveBeenCalledTimes(2)
    expect(toast.success).not.toHaveBeenCalled()
    expect(onReactivated).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(screen.getByRole("alert").textContent).toBe(m.error)
  })

  it("closes without writing anything when the selection pruned to empty", async () => {
    const { onReactivated, onOpenChange } = renderDialog([])
    fireEvent.click(screen.getByRole("button", { name: m.confirm }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(unarchiveMock).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
    expect(onReactivated).not.toHaveBeenCalled()
  })
})
