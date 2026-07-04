import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ErasePersonControl } from "./erase-person-control"

const erase = vi.hoisted(() => vi.fn().mockResolvedValue(null))
const toastSuccess = vi.hoisted(() => vi.fn())
const push = vi.hoisted(() => vi.fn())

vi.mock("convex/react", () => ({ useMutation: () => erase }))
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn() } }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }))
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org_1", name: "Acme", role: "admin" }),
}))

describe("ErasePersonControl", () => {
  it("gates the delete until the external ref is typed, then erases and navigates", async () => {
    render(
      <ErasePersonControl
        personId={"p1" as never}
        displayName="Alex Doe"
        externalRef="E-1"
      />
    )

    // Open the dialog.
    fireEvent.click(screen.getByRole("button", { name: "trigger" }))

    // The confirm action is disabled until the ref matches.
    const confirm = () =>
      screen.getByRole("button", { name: "confirm" }) as HTMLButtonElement
    expect(confirm().disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(/confirmLabel/), {
      target: { value: "E-1" },
    })
    await waitFor(() => expect(confirm().disabled).toBe(false))

    fireEvent.click(confirm())

    await waitFor(() =>
      expect(erase).toHaveBeenCalledWith({ orgId: "org_1", personId: "p1" })
    )
    expect(toastSuccess).toHaveBeenCalledWith("personErased")
    expect(push).toHaveBeenCalledWith("/people")
  })
})
