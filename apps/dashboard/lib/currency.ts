// Locale-aware currency formatting for the whole app. Renders `value` in
// `currency` for the given locale, to whole units by default (comp figures
// are shown without minor units).
// `signed` shows an explicit +/- for deltas (e.g. a pay gap; zero stays
// unsigned). `minorUnits` shows up to two fraction digits instead, for a
// base-pay figure whose decimals are real (an hourly rate); callers decide
// when that applies, this function always shows exactly two digits when set.
// Imported currency codes are not schema-constrained, so an invalid code
// falls back to "<value> <currency>" instead of throwing.
//
// This is the single source of truth for money display. The "kr" a Swedish
// user sees and the "$" / "€" a USD / EUR org sees are both just this function
// with a different locale and currency; nothing hardcodes a unit.
export function formatMoney(
  value: number,
  currency: string,
  locale: string,
  options?: { signed?: boolean; minorUnits?: boolean }
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: options?.minorUnits ? 2 : 0,
      ...(options?.signed ? { signDisplay: "exceptZero" } : {}),
    }).format(value)
  } catch {
    return `${value} ${currency}`
  }
}
