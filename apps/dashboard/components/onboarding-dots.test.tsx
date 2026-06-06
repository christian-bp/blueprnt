import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { OnboardingDots } from "@/components/onboarding-dots"

const STEPS = [
  { key: "a", label: "Step A" },
  { key: "b", label: "Step B" },
  { key: "c", label: "Step C" },
]

describe("OnboardingDots", () => {
  afterEach(() => {
    cleanup()
  })

  it("marks the active step and disables unreached steps", () => {
    render(
      <OnboardingDots
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
      <OnboardingDots
        steps={STEPS}
        activeIndex={2}
        maxReachedIndex={2}
        onSelect={onSelect}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Step A" }))
    expect(onSelect).toHaveBeenCalledWith(0)
  })
})
