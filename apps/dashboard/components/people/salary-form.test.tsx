import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SalaryForm } from "./salary-form"

const setSalary = vi.hoisted(() => vi.fn().mockResolvedValue("pr_1"))
const toastSuccess = vi.hoisted(() => vi.fn())

vi.mock("convex/react", () => ({ useMutation: () => setSalary }))
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn() } }))
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }))
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org_1", name: "Acme", role: "admin" }),
}))

describe("SalaryForm", () => {
  it("calls setSalary with the entered basic salary and shows a success toast", async () => {
    render(<SalaryForm personId={"p1" as never} />)

    fireEvent.change(screen.getByLabelText("payYear"), {
      target: { value: "2026" },
    })
    fireEvent.blur(screen.getByLabelText("payYear"))
    fireEvent.change(screen.getByLabelText("basicMonthly"), {
      target: { value: "50000" },
    })
    fireEvent.blur(screen.getByLabelText("basicMonthly"))
    fireEvent.change(screen.getByLabelText("currency"), {
      target: { value: "SEK" },
    })
    fireEvent.blur(screen.getByLabelText("currency"))

    fireEvent.click(screen.getByRole("button", { name: "submit" }))

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
  })
})
