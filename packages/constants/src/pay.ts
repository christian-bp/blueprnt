// Pay component kinds: the extensible set of compensation component types that
// a company may track beyond basic monthly salary. Values are persisted in the
// payRecords components array; never repurpose or remove a value once data exists.
export const PAY_COMPONENT_KINDS = [
  "variable",
  "bonus",
  "benefitInKind",
  "fixedSupplement",
  "allowance",
  "equity",
  "other",
] as const

export type PayComponentKind = (typeof PAY_COMPONENT_KINDS)[number]

// Pure helper: total monthly comp = basicMonthly + sum of all component
// monthlyAmounts. Used for pay-gap analysis under the EU Pay Transparency
// Directive. No I/O, no clock reads.
export function totalMonthlyComp(
  basicMonthly: number,
  components: ReadonlyArray<{ monthlyAmount: number }>
): number {
  return basicMonthly + components.reduce((sum, c) => sum + c.monthlyAmount, 0)
}

// Pure helper: FTE-adjusted total monthly comp. Grosses a part-time person's
// compensation up to its full-time equivalent so pay-gap comparisons are like
// for like (EU Pay Transparency Directive). ftePercent is a percentage
// (100 = full time). A missing, zero, or non-positive ftePercent is treated as
// 100 (no adjustment), so this never divides by zero. No I/O, no clock reads.
export function fteTotalMonthlyComp(
  basicMonthly: number,
  components: ReadonlyArray<{ monthlyAmount: number }>,
  ftePercent: number | undefined
): number {
  const total = totalMonthlyComp(basicMonthly, components)
  const fraction =
    ftePercent !== undefined && ftePercent > 0 ? ftePercent / 100 : 1
  return total / fraction
}

// Whether a mapped pay column is expressed per month or per year. Annual
// columns are divided by 12 at import ingestion so payRecords stays monthly.
export const PAY_BASIS = ["monthly", "annual"] as const
export type PayBasis = (typeof PAY_BASIS)[number]

// Pure helper: normalize an amount to a monthly figure. No I/O, no clock reads.
export function toMonthly(amount: number, basis: PayBasis): number {
  return basis === "annual" ? amount / 12 : amount
}

// Default basis per money field, used when the import mapping does not specify
// one (an annual-flavoured header can still override this client-side; see
// @workspace/import defaultBasis). Bonus/variable/equity are typically annual.
export const DEFAULT_BASIS_BY_FIELD: Record<
  "basicMonthly" | PayComponentKind,
  PayBasis
> = {
  basicMonthly: "monthly",
  variable: "annual",
  bonus: "annual",
  benefitInKind: "monthly",
  fixedSupplement: "monthly",
  allowance: "monthly",
  equity: "annual",
  other: "monthly",
}
