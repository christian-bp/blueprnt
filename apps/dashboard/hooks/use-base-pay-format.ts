import type { BasePayBasis } from "@workspace/constants"
import { useTranslations } from "next-intl"
import { useMoney } from "@/hooks/use-money"

// A base-pay figure with its unit ("195 kr/h", "32 000 kr/mo"): the money
// through the app's one formatter, the unit through i18n. Every surface that
// shows a RAW base-pay figure (never a normalized one) formats through this.
// An hourly rate carries real decimals (158.50 kr/h is a common figure), so a
// non-whole hourly amount keeps up to two fraction digits; a monthly figure
// always stays whole-unit, the comp convention every other money display keeps.
export function useBasePayFormat() {
  const money = useMoney()
  const t = useTranslations("dashboard.people.payUnit")
  return (amount: number, basis: BasePayBasis, currency: string) =>
    t(basis, {
      amount: money(amount, currency, {
        minorUnits: basis === "hourly" && !Number.isInteger(amount),
      }),
    })
}
