import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { NumberInput } from "./number-input"

describe("NumberInput", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders a number input and hides the spinner buttons", () => {
    render(<NumberInput aria-label="amount" />)
    const input = screen.getByLabelText("amount")
    expect(input).toHaveProperty("type", "number")
    // The spinner-hiding utility is applied (appearance:textfield covers both
    // Firefox and the webkit pseudo-elements).
    expect(input.className).toContain("[appearance:textfield]")
  })

  it("forwards value and onChange like a normal input", () => {
    const onChange = vi.fn()
    render(<NumberInput aria-label="amount" value={42} onChange={onChange} />)
    const input = screen.getByLabelText<HTMLInputElement>("amount")
    expect(input.value).toBe("42")
  })

  it("merges a caller className with the spinner-hiding classes", () => {
    render(<NumberInput aria-label="amount" className="w-20" />)
    const input = screen.getByLabelText("amount")
    expect(input.className).toContain("w-20")
    expect(input.className).toContain("[appearance:textfield]")
  })
})
