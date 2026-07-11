import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AddSalaryDialog } from "./add-salary-dialog"

afterEach(() => {
  cleanup()
  setSalary.mockClear()
  toastSuccess.mockClear()
})

const setSalary = vi.hoisted(() => vi.fn().mockResolvedValue("pr_1"))
const toastSuccess = vi.hoisted(() => vi.fn())

vi.mock("convex/react", () => ({
  useMutation: () => setSalary,
  // The org settings query supplies the currency the amount fields display and
  // the mutation stores.
  useQuery: () => ({ currency: "SEK", pseudonymizeNames: false }),
}))
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn() } }))
vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
  useLocale: () => "en",
}))
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org_1", name: "Acme", role: "admin" }),
}))

describe("AddSalaryDialog", () => {
  it("opens from the trigger, saves the entered salary, toasts, and closes", async () => {
    render(<AddSalaryDialog personId={"p1" as never} />)

    // The form lives in a dialog behind the card-header trigger.
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "addTitle" }))
    expect(screen.getByRole("dialog")).toBeDefined()

    fireEvent.change(screen.getByLabelText("payYear"), {
      target: { value: "2026" },
    })
    fireEvent.blur(screen.getByLabelText("payYear"))
    fireEvent.change(screen.getByLabelText("basicMonthly"), {
      target: { value: "50000" },
    })
    fireEvent.blur(screen.getByLabelText("basicMonthly"))
    // There is no currency field: the org's currency (SEK here, from the
    // settings query) is what reaches the mutation, asserted below.

    const form = screen
      .getByLabelText("payYear")
      .closest("form") as HTMLFormElement
    fireEvent.submit(form)

    await waitFor(() => {
      expect(setSalary).toHaveBeenCalledWith(
        expect.objectContaining({
          personId: "p1",
          payYear: 2026,
          basicMonthly: 50000,
          currency: "SEK",
          components: [],
        })
      )
    })
    expect(toastSuccess).toHaveBeenCalledWith("salarySaved")
    // Success closes the dialog.
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
  })

  it("cancel closes the dialog without saving", () => {
    render(<AddSalaryDialog personId={"p1" as never} />)
    fireEvent.click(screen.getByRole("button", { name: "addTitle" }))
    fireEvent.click(screen.getByRole("button", { name: "cancel" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(setSalary).not.toHaveBeenCalled()
  })
})
