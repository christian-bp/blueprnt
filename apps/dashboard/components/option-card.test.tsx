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

  it("renders media above the title, hidden from assistive tech", () => {
    render(
      <OptionCard
        title="Sweden"
        media={<svg data-testid="card-media" role="presentation" />}
        selected={false}
        onSelect={vi.fn()}
      />
    )
    const media = screen.getByTestId("card-media")
    expect(media.parentElement?.getAttribute("aria-hidden")).toBe("true")
    // The accessible name stays the title alone.
    expect(screen.getByRole("button", { name: "Sweden" })).toBeDefined()
  })

  it("a faded card is disabled and ignores clicks", () => {
    const onSelect = vi.fn()
    render(
      <OptionCard
        title="Norwegian"
        selected={false}
        faded
        onSelect={onSelect}
      />
    )
    const card = screen.getByRole("button", { name: "Norwegian" })
    expect(card).toHaveProperty("disabled", true)
    fireEvent.click(card)
    expect(onSelect).not.toHaveBeenCalled()
  })
})
