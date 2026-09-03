import type { CurrencyKey } from "./countries"

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

// The basis a base-pay figure is recorded in. A pay record stores the figure
// as entered or imported (a monthly salary or an hourly rate) together with
// its basis; the monthly figure the analysis reads is DERIVED, never stored
// (except frozen into a run's snapshot). "annual" is deliberately absent: an
// annual column is converted at import time (PAY_BASIS / toMonthly below) and
// lands as a monthly record.
export const BASE_PAY_BASES = ["monthly", "hourly"] as const
export type BasePayBasis = (typeof BASE_PAY_BASES)[number]

// The import review step's soft hourly-pay notice codes, in the fixed order
// they render (one block per code present in the preview's notices). One
// source shared by the backend's wire validator and the dashboard's render
// order, so a new code cannot compile without a label and a render block.
export const HOURLY_NOTICE_CODES = [
  "hourlyLooksMonthly",
  "monthlyLooksHourly",
  "bothBasesPresent",
] as const
export type HourlyNoticeCode = (typeof HOURLY_NOTICE_CODES)[number]

// Pure helper: a base-pay figure as a full-time-equivalent MONTHLY amount. An
// hourly rate times the full-time hours per month is what the person would
// earn in a full-time month; a monthly figure is already that. Throws on
// non-positive hours: every caller resolves hours through the backend's
// resolveFullTimeHours, which always yields a positive value, so a zero here
// is a programming error, not data.
export function normalizedMonthlyBase(
  amount: number,
  basis: BasePayBasis,
  hoursPerMonth: number
): number {
  if (basis === "monthly") return amount
  if (!(hoursPerMonth > 0)) {
    throw new Error("normalizedMonthlyBase: hoursPerMonth must be positive")
  }
  return amount * hoursPerMonth
}

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
// 100 (no adjustment), so this never divides by zero.
//
// The basis is REQUIRED: an hourly row's basicMonthly is rate x full-time
// hours, already a full-time figure, so dividing it by an FTE share again
// would double-count. Hourly rows return the plain sum, components included
// (one rule per row, stated in the report's method note).
export function fteTotalMonthlyComp(
  basicMonthly: number,
  components: ReadonlyArray<{ monthlyAmount: number }>,
  ftePercent: number | undefined,
  basis: BasePayBasis
): number {
  const total = totalMonthlyComp(basicMonthly, components)
  if (basis === "hourly") return total
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

// Soft plausibility bounds for the import's review-step notices, per org
// currency: an hourly-basis amount above hourlyMax looks like a monthly
// salary, a monthly-basis amount below monthlyMin looks like an hourly rate.
// Notices only, never a skip: a part-time salary can be low and a specialist
// rate can be high. Krona currencies share one scale; the euro is about a
// tenth of it.
export const PAY_PLAUSIBILITY_BY_CURRENCY: Record<
  CurrencyKey,
  { hourlyMax: number; monthlyMin: number }
> = {
  SEK: { hourlyMax: 1500, monthlyMin: 3000 },
  NOK: { hourlyMax: 1500, monthlyMin: 3000 },
  DKK: { hourlyMax: 1500, monthlyMin: 3000 },
  EUR: { hourlyMax: 150, monthlyMin: 300 },
}

// The bounds for a currency, or undefined when the currency has none (then no
// notice is raised: an unknown currency has no scale to judge against).
export function plausibilityFor(
  currency: string
): { hourlyMax: number; monthlyMin: number } | undefined {
  return (
    PAY_PLAUSIBILITY_BY_CURRENCY as Record<
      string,
      { hourlyMax: number; monthlyMin: number } | undefined
    >
  )[currency]
}
