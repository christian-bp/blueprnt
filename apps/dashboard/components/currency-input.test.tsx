import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CurrencyInput } from "./currency-input"

function renderInput(props: {
  value: number | undefined
  onChange?: (value: number | undefined) => void
  currency?: string
}) {
  const onChange = props.onChange ?? vi.fn()
  render(
    <NextIntlClientProvider locale="en" messages={{}}>
      <CurrencyInput
        aria-label="amount"
        value={props.value}
        onChange={onChange}
        currency={props.currency ?? "SEK"}
      />
    </NextIntlClientProvider>
  )
  return { onChange, input: screen.getByLabelText<HTMLInputElement>("amount") }
}

describe("CurrencyInput", () => {
  afterEach(() => {
    cleanup()
  })

  it("shows the value grouped by thousands and the currency addon", () => {
    const { input } = renderInput({ value: 1000000 })
    expect(input.value).toBe("1,000,000")
    expect(screen.getByText("SEK")).toBeDefined()
  })

  it("shows an empty field for an undefined value", () => {
    const { input } = renderInput({ value: undefined })
    expect(input.value).toBe("")
  })

  it("parses typed digits (and separators) back to a plain number", () => {
    const { input, onChange } = renderInput({ value: undefined })
    fireEvent.change(input, { target: { value: "1000000" } })
    expect(onChange).toHaveBeenCalledWith(1000000)
    // A pasted, already-grouped value parses too.
    fireEvent.change(input, { target: { value: "2,500,000" } })
    expect(onChange).toHaveBeenCalledWith(2500000)
  })

  it("maps a cleared field to undefined, never NaN", () => {
    const { input, onChange } = renderInput({ value: 500 })
    fireEvent.change(input, { target: { value: "" } })
    expect(onChange).toHaveBeenCalledWith(undefined)
    expect(onChange).not.toHaveBeenCalledWith(Number.NaN)
  })
})
