import type { ChangeEvent } from "react"
import { describe, expect, it, vi } from "vitest"
import { numberInputField, type RhfNumberField } from "./number-field"

// A react-hook-form field stub with a spy onChange, so we can assert exactly
// what value the helper writes back into form state.
function fieldStub(value: number | undefined) {
  const onChange = vi.fn<(value: number | undefined) => void>()
  const field: RhfNumberField = {
    name: "amount",
    ref: () => {},
    onBlur: () => {},
    value,
    onChange,
  }
  return { field, onChange }
}

// A synthetic change event carrying the browser's valueAsNumber (NaN for an
// empty or non-numeric input, a number otherwise).
function changeEvent(valueAsNumber: number): ChangeEvent<HTMLInputElement> {
  return {
    target: { valueAsNumber },
  } as ChangeEvent<HTMLInputElement>
}

describe("numberInputField", () => {
  it("writes a real number straight through on change", () => {
    const { field, onChange } = fieldStub(0)
    numberInputField(field).onChange(changeEvent(10000))
    expect(onChange).toHaveBeenCalledWith(10000)
  })

  it("writes undefined (never NaN) when the input is cleared", () => {
    const { field, onChange } = fieldStub(0)
    // An empty <input type="number"> reports valueAsNumber === NaN; this is the
    // exact case that used to flow NaN back into the value attribute.
    numberInputField(field).onChange(changeEvent(Number.NaN))
    expect(onChange).toHaveBeenCalledWith(undefined)
    expect(onChange).not.toHaveBeenCalledWith(Number.NaN)
  })

  it("coalesces an absent value to an empty string so the input stays controlled", () => {
    expect(numberInputField(fieldStub(undefined).field).value).toBe("")
  })

  it("preserves a real zero rather than blanking it", () => {
    expect(numberInputField(fieldStub(0).field).value).toBe(0)
  })

  it("passes name, ref, and onBlur through unchanged", () => {
    const { field } = fieldStub(5)
    const props = numberInputField(field)
    expect(props.name).toBe(field.name)
    expect(props.ref).toBe(field.ref)
    expect(props.onBlur).toBe(field.onBlur)
  })
})
