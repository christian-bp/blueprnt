import type { ChangeEvent } from "react"

// The parts of a react-hook-form Controller render `field` that a number
// <Input> needs. Kept structural (rather than importing RHF's generic
// ControllerRenderProps) so callers pass `field` directly and the helper stays
// unit-testable without constructing a whole form.
export interface RhfNumberField {
  name: string
  ref: (instance: HTMLInputElement | null) => void
  onBlur: () => void
  value: number | undefined
  onChange: (value: number | undefined) => void
}

// Props for a controlled number <Input> bound to a react-hook-form field.
//
// An empty (or otherwise non-numeric) <input type="number"> reports
// valueAsNumber === NaN. Storing NaN in form state feeds it straight back into
// the input's `value` attribute, which React rejects ("Received NaN for the
// value attribute"), and it is not a valid number for the Zod resolver either.
// So a cleared field maps to `undefined` (which the resolver treats as the
// missing / "required" case), and the value prop coalesces nullish to "" to
// keep the input controlled. A real 0 is preserved (only null/undefined blank).
export function numberInputField(field: RhfNumberField) {
  return {
    name: field.name,
    ref: field.ref,
    onBlur: field.onBlur,
    value: field.value ?? "",
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const next = event.target.valueAsNumber
      field.onChange(Number.isNaN(next) ? undefined : next)
    },
  }
}
