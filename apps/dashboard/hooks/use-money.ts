import { useLocale } from "next-intl"
import { formatMoney } from "@/lib/currency"

// Ergonomic money formatter bound to the active locale: `const money = useMoney()`
// then `money(value, currency)` (or `money(delta, currency, { signed: true })`
// for a signed gap). Wraps the pure formatMoney so components never thread the
// locale through or re-derive the currency formatting rules.
export function useMoney() {
  const locale = useLocale()
  return (value: number, currency: string, options?: { signed?: boolean }) =>
    formatMoney(value, currency, locale, options)
}
