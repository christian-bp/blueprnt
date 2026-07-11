// Digits-only view of a string: drops grouping separators, spaces, and any
// other non-digit the user or the formatter introduced.
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "")
}

// Formats a non-negative integer with the locale's thousands grouping and no
// decimals (1000000 -> "1,000,000" in en, "1 000 000" in sv). CurrencyInput
// shows this while the bound value stays a plain number.
export function formatGroupedInteger(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    value
  )
}

// The caret index in `formatted` that sits just after its first `digitCount`
// digits. As the user types, grouping separators shift, so restoring the caret
// by raw string offset drifts; restoring it after the same NUMBER OF DIGITS
// keeps it where the user is typing.
export function caretIndexAfterDigits(
  formatted: string,
  digitCount: number
): number {
  if (digitCount <= 0) return 0
  let seen = 0
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted.charAt(i))) {
      seen += 1
      if (seen === digitCount) return i + 1
    }
  }
  return formatted.length
}
