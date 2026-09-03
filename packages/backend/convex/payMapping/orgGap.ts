import { type BasePayBasis, fteTotalMonthlyComp } from "@workspace/constants"
import { computeGenderGap, type PayGapFlag } from "@workspace/core"

// The org-level gender pay gap of one pay mapping, and the two rules it
// depends on: which rows take part, and what each row's pay is worth.
//
// It lives in its own module because it now has two callers that must never
// disagree: the freeze (which stores the figure on the run row) and
// getPayMappingGap (which recomputes the full aggregate from the same frozen
// rows). Both take these helpers rather than their own copies, so a change to
// what "priced" means, or to the comp formula, reaches both at once. When the
// filter was a literal in each caller they were identical, and the
// cross-check test passed, which is exactly the state a drift bug starts in.

// The structural subset of a snapshot row this math needs. Deliberately not
// Doc<"payMappingSnapshotRows">: the freeze computes the figure from the rows
// it is about to insert, which are not documents yet.
export interface PricedRow {
  gender: "Man" | "Kvinna"
  basicMonthly: number | null
  components: { kind: string; monthlyAmount: number }[]
  ftePercent?: number
  // Absent only on a row without pay (basicMonthly null), which contributes
  // nothing; a priced row always carries its basis from the freeze.
  basis?: BasePayBasis
}

// Only a row with a frozen salary takes part in the gap. A person the
// snapshot covers but whose pay was unknown at the freeze is in the
// population and out of the comparison.
export function isPriced(row: PricedRow): boolean {
  return row.basicMonthly !== null
}

// FTE-adjusted total monthly comp (TCC): the org aggregate's measure.
export function tccComp(row: PricedRow): number {
  return fteTotalMonthlyComp(
    row.basicMonthly ?? 0,
    row.components,
    row.ftePercent,
    row.basis ?? "monthly"
  )
}

export interface OrgGap {
  womenCount: number
  menCount: number
  womenMeanComp: number | null
  menMeanComp: number | null
  gapPct: number | null
  flag: PayGapFlag
}

// The org-level aggregate over a run's rows. Unlike the equal-work/
// equivalent-work groups it is never masked: a population mean is not an
// individual salary. computeGenderGap still flags "insufficient" when a
// gender is missing, in which case gapPct is null.
//
// Takes ALL rows and filters internally, so a caller cannot bring its own
// idea of which rows count.
export function orgGap(rows: PricedRow[]): OrgGap {
  const women: number[] = []
  const men: number[] = []
  for (const row of rows) {
    if (!isPriced(row)) continue
    if (row.gender === "Kvinna") women.push(tccComp(row))
    else men.push(tccComp(row))
  }
  const stats = computeGenderGap(women, men)
  return {
    womenCount: stats.womenCount,
    menCount: stats.menCount,
    womenMeanComp: stats.womenMeanComp,
    menMeanComp: stats.menMeanComp,
    gapPct: stats.gapPct,
    flag: stats.flag as PayGapFlag,
  }
}
