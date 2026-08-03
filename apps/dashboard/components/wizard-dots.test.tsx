import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { WizardDots } from "@/components/wizard-dots"

const STEPS = [
  { key: "a", label: "Step A" },
  { key: "b", label: "Step B" },
  { key: "c", label: "Step C" },
]

describe("WizardDots", () => {
  afterEach(() => {
    cleanup()
  })

  it("marks the active step and disables unreached steps", () => {
    render(
      <WizardDots
        steps={STEPS}
        activeIndex={1}
        maxReachedIndex={1}
        onSelect={vi.fn()}
      />
    )
    const active = screen.getByRole("button", { name: "Step B" })
    expect(active.getAttribute("aria-current")).toBe("step")
    const future = screen.getByRole("button", { name: "Step C" })
    expect(future.hasAttribute("disabled")).toBe(true)
  })

  it("selects reached steps and ignores future ones", () => {
    const onSelect = vi.fn()
    render(
      <WizardDots
        steps={STEPS}
        activeIndex={2}
        maxReachedIndex={2}
        onSelect={onSelect}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Step A" }))
    expect(onSelect).toHaveBeenCalledWith(0)
  })

  it("disables every dot when not interactive, without greying the active one", () => {
    const onSelect = vi.fn()
    const { container } = render(
      <WizardDots
        steps={STEPS}
        activeIndex={1}
        maxReachedIndex={1}
        onSelect={onSelect}
        interactive={false}
      />
    )
    const reached = screen.getByRole("button", { name: "Step A" })
    expect(reached.hasAttribute("disabled")).toBe(true)
    fireEvent.click(reached)
    expect(onSelect).not.toHaveBeenCalled()

    // Reached styling still comes from maxReachedIndex: an inert phase must
    // not grey the active dot out and misreport which step the user is on.
    const active = screen.getByRole("button", { name: "Step B" })
    const activeDot = active.querySelector("span")
    expect(activeDot?.className).toContain("bg-brand")
    expect(activeDot?.className).not.toContain("bg-muted")
    // The hover highlight is the click affordance, so it is gone too.
    expect(container.innerHTML).not.toContain("group-hover:bg-brand/60")
  })
})
