"use client"

import { useTranslations } from "next-intl"
import {
  groupLabel,
  groupMembers,
  type PayMappingSnapshotRow,
  rowInGroup,
  type WomenDominatedGroupWire,
} from "./pay-mapping-gap-types"
import { PayMappingScatter } from "./pay-mapping-scatter"

// Maps a snapshot row back to whichever group (the dominated group itself,
// or one of its comparators) it belongs to, through rowInGroup: the same
// identity groupMembers uses to pick the points in the first place, so a
// point that IS drawn can never fail to be labelled.
function womenDominatedGroupLabelFor(
  group: WomenDominatedGroupWire
): (row: PayMappingSnapshotRow) => string {
  const entries = [group, ...group.comparisons]
  return (row) => {
    const match = entries.find((entry) => rowInGroup(row, entry))
    return match === undefined ? "" : groupLabel(match)
  }
}

// The scatter behind a women-dominated group's figures: every member of the
// group AND of every comparator, plotted by age or tenure against pay, each
// point labeled with the group it belongs to and hoverable for that
// person's own row.
//
// It sits open, directly under the comparator table, rather than behind a
// disclosure at the foot of the step. It used to be closed and last, after
// the form, which meant most readers never found it. This is where the
// individual reading happens: a run of high salaries at one end of the age
// axis is what makes "historical reasons" visible, and that is exactly the
// objective ground the documenter has to weigh.
//
// It also carries the reading the cross-level check used to compute: a
// woman on a HIGHER level sitting below men on lower ones is simply
// visible here, in context, alongside everyone she is being compared with.
export function WomenDominatedScatter({
  group,
  rows,
  currency,
  referenceDateMs,
  highlightComparisonKey,
}: {
  group: WomenDominatedGroupWire
  rows: PayMappingSnapshotRow[]
  currency: string
  referenceDateMs: number
  // The comparator row the reader selected in the table above, if any.
  highlightComparisonKey?: string | null
}) {
  const tScatter = useTranslations("dashboard.payMapping.scatter")
  if (group.comparisons.length === 0) return null
  const scatterRows = [
    ...(groupMembers(rows, group) ?? []),
    ...group.comparisons.flatMap(
      (comparison) => groupMembers(rows, comparison) ?? []
    ),
  ]
  const highlighted =
    highlightComparisonKey === undefined || highlightComparisonKey === null
      ? null
      : group.comparisons.find(
          (comparison) => comparison.key === highlightComparisonKey
        )
  return (
    <PayMappingScatter
      highlightGroupLabel={
        highlighted === undefined || highlighted === null
          ? null
          : groupLabel(highlighted)
      }
      rows={scatterRows}
      currency={currency}
      referenceDateMs={referenceDateMs}
      groupLabelFor={womenDominatedGroupLabelFor(group)}
      // The same order the comparator table lists: the dominated group
      // first, then its comparators as ranked there. Passing the table's
      // order rather than sorting here is what keeps a hue tied to a job
      // across both surfaces.
      roleOrder={[group, ...group.comparisons].map((entry) =>
        groupLabel(entry)
      )}
      title={tScatter("titleEquivalentWork")}
    />
  )
}
