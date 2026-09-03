import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { formatMoney } from "@/lib/currency"
import { pickSelectOption } from "@/test/select"
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
  // The pay-defaults query supplies the currency the amount fields display
  // and the mutation stores, plus the person's resolved full-time hours the
  // derived monthly line uses.
  useQuery: () => ({
    currency: "SEK",
    hoursPerMonth: 165,
  }),
}))
vi.mock("@/lib/toast", () => ({
  toast: { success: toastSuccess, error: vi.fn() },
}))
vi.mock("next-intl", () => ({
  // Echoes params so a message's computed arguments (the derived monthly
  // line's amount and hours) are pinned at the surface, not just the key.
  useTranslations:
    () =>
    (k: string, v?: Record<string, unknown>): string =>
      v ? `${k}:${JSON.stringify(v)}` : k,
  useLocale: () => "en",
}))
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org_1", name: "Acme", role: "admin" }),
}))

describe("AddSalaryDialog", () => {
  it("opens from the trigger, saves the entered monthly salary, toasts, and closes", async () => {
    render(<AddSalaryDialog personId={"p1" as never} />)

    // The form lives in a dialog behind the card-header trigger.
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "addTitle" }))
    expect(screen.getByRole("dialog")).toBeDefined()

    fireEvent.change(screen.getByLabelText("payYear"), {
      target: { value: "2026" },
    })
    fireEvent.blur(screen.getByLabelText("payYear"))
    // Default basis is monthly, so the amount field is still labeled
    // basicMonthly.
    fireEvent.change(screen.getByLabelText("basicMonthly"), {
      target: { value: "50000" },
    })
    fireEvent.blur(screen.getByLabelText("basicMonthly"))
    // There is no currency field: the org's currency (SEK here, from the
    // defaults query) is what reaches the mutation, asserted below.
    // The derived monthly line only renders under the hourly basis; the
    // reserved slot stays empty here.
    expect(screen.queryByText(/^derivedMonthly:/)).toBeNull()

    const form = screen
      .getByLabelText("payYear")
      .closest("form") as HTMLFormElement
    fireEvent.submit(form)

    await waitFor(() => {
      expect(setSalary).toHaveBeenCalledWith(
        expect.objectContaining({
          personId: "p1",
          payYear: 2026,
          basis: "monthly",
          basicAmount: 50000,
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

  it("switches to hourly, shows the derived monthly line, and saves the hourly rate", async () => {
    render(<AddSalaryDialog personId={"p1" as never} />)
    fireEvent.click(screen.getByRole("button", { name: "addTitle" }))

    await pickSelectOption(screen.getByLabelText("basis.label"), "basis.hourly")

    fireEvent.change(screen.getByLabelText("payYear"), {
      target: { value: "2026" },
    })
    fireEvent.blur(screen.getByLabelText("payYear"))
    // The amount field relabels to hourlyAmount once basis is hourly.
    fireEvent.change(screen.getByLabelText("hourlyAmount"), {
      target: { value: "195" },
    })
    fireEvent.blur(screen.getByLabelText("hourlyAmount"))

    // The derived monthly line renders with the actual computed amount
    // (195 x 165 = 32175, formatted) and hours (165), not a stale or raw
    // value: normalizedMonthlyBase(195, "hourly", 165) = 32175.
    // testing-library's default text normalizer collapses whitespace runs
    // (Intl's non-breaking space between currency code and amount included)
    // to a plain space before matching, so the query string is normalized
    // the same way rather than compared against the raw NBSP.
    const expectedAmount = formatMoney(32175, "SEK", "en").replace(
      /\u00a0/g,
      " "
    )
    expect(
      screen.getByText(
        `derivedMonthly:${JSON.stringify({ amount: expectedAmount, hours: 165 })}`
      )
    ).toBeDefined()

    const form = screen
      .getByLabelText("payYear")
      .closest("form") as HTMLFormElement
    fireEvent.submit(form)

    await waitFor(() => {
      expect(setSalary).toHaveBeenCalledWith(
        expect.objectContaining({
          personId: "p1",
          payYear: 2026,
          basis: "hourly",
          basicAmount: 195,
          currency: "SEK",
          components: [],
        })
      )
    })
  })

  it("keeps the typed amount across a basis change in either direction", async () => {
    render(<AddSalaryDialog personId={"p1" as never} />)
    fireEvent.click(screen.getByRole("button", { name: "addTitle" }))

    // Type the amount under the default monthly basis first.
    fireEvent.change(screen.getByLabelText("basicMonthly"), {
      target: { value: "195" },
    })
    fireEvent.blur(screen.getByLabelText("basicMonthly"))

    await pickSelectOption(screen.getByLabelText("basis.label"), "basis.hourly")

    // The amount field relabels to hourlyAmount, but the typed figure is
    // still there: switching basis must not clear it.
    expect(
      (screen.getByLabelText("hourlyAmount") as HTMLInputElement).value
    ).toBe("195")
    expect(screen.getByText(/^derivedMonthly:/)).toBeDefined()

    await pickSelectOption(
      screen.getByLabelText("basis.label"),
      "basis.monthly"
    )

    // Back to monthly: the derived line (hourly-only) is gone, and the
    // value the user typed is still there under its monthly label.
    expect(screen.queryByText(/^derivedMonthly:/)).toBeNull()
    expect(
      (screen.getByLabelText("basicMonthly") as HTMLInputElement).value
    ).toBe("195")
  })

  it("renders the pay-basis help next to the dialog title", () => {
    render(<AddSalaryDialog personId={"p1" as never} />)
    fireEvent.click(screen.getByRole("button", { name: "addTitle" }))
    expect(screen.getByRole("button", { name: "payBasisLabel" })).toBeDefined()
  })

  it("cancel closes the dialog without saving", () => {
    render(<AddSalaryDialog personId={"p1" as never} />)
    fireEvent.click(screen.getByRole("button", { name: "addTitle" }))
    fireEvent.click(screen.getByRole("button", { name: "cancel" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(setSalary).not.toHaveBeenCalled()
  })
})
