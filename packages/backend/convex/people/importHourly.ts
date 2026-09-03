import {
  type BasePayBasis,
  type EmploymentType,
  type HourlyNoticeCode,
  type PayBasis,
  toMonthly,
} from "@workspace/constants"

// Soft review-step notices about a row's pay basis. Never a skip code: each
// is listed with its rows so HR can look, and the row still imports.
export type { HourlyNoticeCode }

export interface RowBasis {
  basis: BasePayBasis
  basicAmount: number
  // True when the base-pay column was read as an hourly rate BECAUSE the
  // row's employment type is hourly (rule 2): the review step lists these.
  interpreted: boolean
  notice: "bothBasesPresent" | null
}

// Which basis a row's base pay is in, and the figure, from the two cells and
// the pay form. Pure so the preview and the import share it (one rule):
//   1. an hourly-rate cell wins, unless the row also has a base-pay cell and
//      is NOT hourly-typed (then the base pay wins); both cells present is
//      always worth a look, so it carries the bothBasesPresent notice;
//   2. a base-pay cell on an hourly-typed row is an hourly rate when the
//      caller interprets (the review step's default-on checkbox);
//   3. otherwise the base-pay cell is a monthly figure via its column basis;
//   4. no base pay at all: null (no salary row, as before).
export function resolveRowBasis(input: {
  parsedBase: number | null
  parsedHourly: number | null
  employmentType: EmploymentType | undefined
  interpretHourly: boolean
  baseColumnBasis: PayBasis
}): RowBasis | null {
  const hourlyTyped = input.employmentType === "hourly"
  if (input.parsedHourly !== null) {
    if (input.parsedBase !== null && !hourlyTyped) {
      return {
        basis: "monthly",
        basicAmount: toMonthly(input.parsedBase, input.baseColumnBasis),
        interpreted: false,
        notice: "bothBasesPresent",
      }
    }
    return {
      basis: "hourly",
      basicAmount: input.parsedHourly,
      interpreted: false,
      notice: input.parsedBase !== null ? "bothBasesPresent" : null,
    }
  }
  if (input.parsedBase === null) return null
  if (hourlyTyped && input.interpretHourly) {
    return {
      basis: "hourly",
      basicAmount: input.parsedBase,
      interpreted: true,
      notice: null,
    }
  }
  return {
    basis: "monthly",
    basicAmount: toMonthly(input.parsedBase, input.baseColumnBasis),
    interpreted: false,
    notice: null,
  }
}

// The size-based notice for a resolved row, given the org currency's bounds
// (undefined bounds: no notice). A low MONTHLY figure is only suspicious on
// an hourly-typed or untyped row: a monthly-typed low figure is a part-time
// salary.
export function plausibilityNotice(
  row: { basis: BasePayBasis; basicAmount: number },
  employmentType: EmploymentType | undefined,
  bounds: { hourlyMax: number; monthlyMin: number } | undefined
): "hourlyLooksMonthly" | "monthlyLooksHourly" | null {
  if (bounds === undefined) return null
  if (row.basis === "hourly") {
    return row.basicAmount > bounds.hourlyMax ? "hourlyLooksMonthly" : null
  }
  const suspicious = employmentType === undefined || employmentType === "hourly"
  return suspicious && row.basicAmount < bounds.monthlyMin
    ? "monthlyLooksHourly"
    : null
}
