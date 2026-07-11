"use client"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group"
import { useLocale } from "next-intl"
import { type ComponentProps, useLayoutEffect, useRef } from "react"
import {
  caretIndexAfterDigits,
  digitsOnly,
  formatGroupedInteger,
} from "@/lib/grouped-number"

// A money field: a text input that shows the amount grouped by thousands
// (1,000,000) with the currency as a trailing addon, while the bound value
// stays a plain whole number. The currency is display-only (set once in org
// settings); this control never changes it. Bind value/onChange like a
// react-hook-form field (see currencyInputField): an empty field maps to
// undefined (the resolver's required case), never NaN.
//
// Grouping is applied in JS (no input type / CSS can do it), so this is a text
// input, not type="number". The caret is restored after the same NUMBER of
// digits across reformatting, so inserting separators does not make it jump.
export function CurrencyInput({
  value,
  onChange,
  currency,
  onBlur,
  name,
  inputRef,
  className,
  ...rest
}: {
  value: number | undefined
  onChange: (value: number | undefined) => void
  currency: string
  onBlur?: () => void
  name?: string
  inputRef?: (instance: HTMLInputElement | null) => void
  className?: string
} & Pick<ComponentProps<"input">, "aria-label" | "placeholder" | "id">) {
  const locale = useLocale()
  const ref = useRef<HTMLInputElement | null>(null)
  // Digit index the caret should sit after once the reformatted value renders.
  const caretDigits = useRef<number | null>(null)

  const display =
    value === undefined || Number.isNaN(value)
      ? ""
      : formatGroupedInteger(value, locale)

  useLayoutEffect(() => {
    const el = ref.current
    if (el === null || caretDigits.current === null) return
    // Only reposition while the field is focused (avoid stealing the caret on
    // an external value change).
    if (el.ownerDocument.activeElement === el) {
      const pos = caretIndexAfterDigits(display, caretDigits.current)
      el.setSelectionRange(pos, pos)
    }
    caretDigits.current = null
  }, [display])

  return (
    <InputGroup className={className}>
      <InputGroupInput
        {...rest}
        inputMode="numeric"
        name={name}
        value={display}
        onBlur={onBlur}
        ref={(el) => {
          ref.current = el
          inputRef?.(el)
        }}
        onChange={(event) => {
          const raw = event.target.value
          const caret = event.target.selectionStart ?? raw.length
          caretDigits.current = digitsOnly(raw.slice(0, caret)).length
          const digits = digitsOnly(raw)
          onChange(digits === "" ? undefined : Number(digits))
        }}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupText>{currency}</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  )
}

// Adapter from a react-hook-form field to CurrencyInput's binding props,
// mirroring numberInputField for NumberInput so call sites do not repeat the
// block. `currency` is passed separately (it is display-only, not a form field).
export function currencyInputField(field: {
  value: number | undefined
  onChange: (value: number | undefined) => void
  onBlur: () => void
  name: string
  ref: (instance: HTMLInputElement | null) => void
}) {
  return {
    value: field.value,
    onChange: field.onChange,
    onBlur: field.onBlur,
    name: field.name,
    inputRef: field.ref,
  }
}
