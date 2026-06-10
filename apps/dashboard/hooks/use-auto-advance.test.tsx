import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useAutoAdvance } from "@/hooks/use-auto-advance"

// Minimal probe exposing the hook's full contract; the screens cover the
// integrated behavior, this covers the corners (re-entrancy, picked survival).
function Probe({
  persist,
  onAdvance,
}: {
  persist: (code: string) => Promise<unknown>
  onAdvance: () => void
}) {
  const { chosen, picked, failed, choose } = useAutoAdvance({
    persist,
    onAdvance,
  })
  return (
    <div>
      <button type="button" onClick={() => choose("a")}>
        pick-a
      </button>
      <button type="button" onClick={() => choose("b")}>
        pick-b
      </button>
      <span data-testid="chosen">{chosen ?? "none"}</span>
      <span data-testid="picked">{picked ?? "none"}</span>
      <span data-testid="failed">{String(failed)}</span>
    </div>
  )
}

describe("useAutoAdvance", () => {
  afterEach(() => {
    cleanup()
  })

  it("persists the pick and advances once both the save and the fade are done", async () => {
    const persist = vi.fn().mockResolvedValue(undefined)
    const onAdvance = vi.fn()
    render(<Probe persist={persist} onAdvance={onAdvance} />)

    fireEvent.click(screen.getByText("pick-a"))

    expect(persist).toHaveBeenCalledWith("a")
    expect(onAdvance).not.toHaveBeenCalled() // the fade delay has not elapsed yet
    await waitFor(
      () => {
        expect(onAdvance).toHaveBeenCalledTimes(1)
      },
      { timeout: 2000 }
    )
  })

  it("ignores a second pick while one is in flight", async () => {
    const persist = vi.fn().mockResolvedValue(undefined)
    const onAdvance = vi.fn()
    render(<Probe persist={persist} onAdvance={onAdvance} />)

    fireEvent.click(screen.getByText("pick-a"))
    fireEvent.click(screen.getByText("pick-b"))

    expect(persist).toHaveBeenCalledTimes(1)
    expect(persist).toHaveBeenCalledWith("a")
    await waitFor(
      () => {
        expect(onAdvance).toHaveBeenCalledTimes(1)
      },
      { timeout: 2000 }
    )
  })

  it("unmounting during the wait kills the pending advance", async () => {
    const persist = vi.fn().mockResolvedValue(undefined)
    const onAdvance = vi.fn()
    const view = render(<Probe persist={persist} onAdvance={onAdvance} />)

    fireEvent.click(screen.getByText("pick-a"))
    // The user navigates away (the wizard unmounts the screen) mid-pause.
    view.unmount()

    // Wait past the full advance delay: the save completed but the advance
    // must never fire against the wizard's new position.
    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(persist).toHaveBeenCalledTimes(1)
    expect(onAdvance).not.toHaveBeenCalled()
  })

  it("a failed save clears chosen, keeps picked, and flags failed", async () => {
    const persist = vi.fn().mockRejectedValue(new Error("nope"))
    const onAdvance = vi.fn()
    render(<Probe persist={persist} onAdvance={onAdvance} />)

    fireEvent.click(screen.getByText("pick-a"))

    await waitFor(() => {
      expect(screen.getByTestId("failed").textContent).toBe("true")
    })
    expect(screen.getByTestId("chosen").textContent).toBe("none")
    expect(screen.getByTestId("picked").textContent).toBe("a")
    expect(onAdvance).not.toHaveBeenCalled()

    // The hook accepts a new pick after the failure.
    persist.mockResolvedValue(undefined)
    fireEvent.click(screen.getByText("pick-b"))
    await waitFor(
      () => {
        expect(onAdvance).toHaveBeenCalledTimes(1)
      },
      { timeout: 2000 }
    )
    expect(screen.getByTestId("picked").textContent).toBe("b")
  })
})
