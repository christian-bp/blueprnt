import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { OptionCard } from "@/components/option-card"

describe("OptionCard", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders title, description, and badge, and reports selection", () => {
    const onSelect = vi.fn()
    render(
      <OptionCard
        title="Standard template"
        description="9 criteria with anchors"
        badge="Recommended"
        selected={false}
        onSelect={onSelect}
      />
    )
    expect(screen.getByText("Recommended")).toBeDefined()
    const card = screen.getByRole("button", { name: /Standard template/ })
    expect(card.getAttribute("aria-pressed")).toBe("false")
    fireEvent.click(card)
    expect(onSelect).toHaveBeenCalled()
  })

  it("marks the selected state", () => {
    render(<OptionCard title="Swedish" selected onSelect={vi.fn()} />)
    expect(
      screen
        .getByRole("button", { name: "Swedish" })
        .getAttribute("aria-pressed")
    ).toBe("true")
  })
})
