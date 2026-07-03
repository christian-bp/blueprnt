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
