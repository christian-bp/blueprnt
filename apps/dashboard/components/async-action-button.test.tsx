import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AsyncActionButton } from "./async-action-button"

afterEach(() => cleanup())

describe("AsyncActionButton", () => {
  it("runs the action and swaps to the done label", async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    render(
      <AsyncActionButton action={action} doneLabel="Sent">
        Resend
      </AsyncActionButton>
    )
    expect(screen.getByText("Resend")).toBeDefined()

    fireEvent.click(screen.getByRole("button"))

    await waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1)
      expect(screen.getByText("Sent")).toBeDefined()
    })
  })

  it("skips the done label and stays idle when the action returns false", async () => {
    const action = vi.fn().mockResolvedValue(false)
    render(
      <AsyncActionButton action={action} doneLabel="Sent">
        Resend
      </AsyncActionButton>
    )

    fireEvent.click(screen.getByRole("button"))

    await waitFor(() => expect(action).toHaveBeenCalled())
    await waitFor(() => {
      expect(screen.queryByText("Sent")).toBeNull()
      expect(screen.getByText("Resend")).toBeDefined()
    })
  })

  it("disables the button and guards against a second run while loading", async () => {
    let resolve: () => void = () => {}
    const action = vi.fn(
      () =>
        new Promise<undefined>((r) => {
          resolve = () => r(undefined)
        })
    )
    render(<AsyncActionButton action={action}>Resend</AsyncActionButton>)
    const button = screen.getByRole("button") as HTMLButtonElement

    fireEvent.click(button)
    await waitFor(() => expect(button.disabled).toBe(true))

    // A click while the action is in flight must not start a second run.
    fireEvent.click(button)
    expect(action).toHaveBeenCalledTimes(1)

    resolve()
    await waitFor(() => expect(button.disabled).toBe(false))
  })
})
