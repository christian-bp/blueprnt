"use client"

import { AnimatePresence, motion } from "motion/react"
import { Fragment } from "react"
import { zoneContent } from "@workspace/backend/convex/evaluationModel/zoneContent"
import { useLocale, useTranslations } from "next-intl"
import { HATCH_CLASS } from "@/components/hatch"
import { RoleChip } from "@/components/levels/role-chip"
import { type LevelRoleRow, levelRanges } from "@/lib/levels"
import { SPRING } from "@/lib/motion"
import { ZoneGroupLabel } from "@/components/levels/zone-label"
import { zoneBands, zoneBoundaryIndexes } from "@/lib/zone-bands"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
  MATRIX_COL_HEADER_CLASS,
  MATRIX_COL_RULE_CLASS,
  MATRIX_HEAD_INSET_CLASS,
  MATRIX_ZONE_RULE_CLASS,
  MATRIX_HEAD_PAD_CLASS,
  MATRIX_WRAPPER_CLASS,
} from "@/components/levels/matrix-chrome"
import { groupByFamily } from "@/lib/role-groups"

// Family x level matrix (the LevelMatrix transposed onto the family axis):
// levels across (Level 1, the highest, first), one SECTION per family (name
// order, the family-less bucket last): a full-width label row with the
// family name on one line, then a row of level cells spanning the whole
// width (no left header column stealing space from the first level). Each
// role sits in the cell where its family meets its level. Family IS the row
// axis here, so the family filter removes whole sections (unlike the
// ladder/matrix, whose structural axes stay put and only lose chips); the
// level columns come from the model and never change with filtering. Same
// neutral-ink chips and popLayout reflow as the siblings.
export function FamilyLevelMatrix({
  levels,
  rows,
}: {
  levels: { level: number; minScore: number }[]
  rows: LevelRoleRow[]
}) {
  const t = useTranslations("dashboard.levels")
  const tFamily = useTranslations("dashboard.roles.family")
  const locale = useLocale()
  const content = zoneContent(locale)
  const ranges = levelRanges(levels)
  // Levels are the COLUMN axis here, so the zones become a header row above
  // them rather than collapsible bands: a column group cannot fold away without
  // taking its data with it on every row at once, and this view's job is the
  // whole register side by side. Names only, no descriptions: a header cell
  // three levels wide has no room for a sentence, and the ladder is where the
  // zone is explained.
  const bands = zoneBands(ranges)
  // The column indexes where the architecture changes zone. A boundary column
  // takes the zone rule INSTEAD of the level rule, never both: two rules in
  // one gutter is not a stronger division, it is a smudge.
  const zoneBoundaries = zoneBoundaryIndexes(ranges)

  // ONE RULE PER GUTTER, and only one. The first column has no neighbour on
  // its left to be divided from; a zone boundary takes the zone rule INSTEAD
  // of the level rule, because two rules in one gutter is not a stronger
  // division, it is a smudge.
  const ruleFor = (index: number): string => {
    if (index === 0) return ""
    return zoneBoundaries.has(index)
      ? MATRIX_ZONE_RULE_CLASS
      : MATRIX_COL_RULE_CLASS
  }
  // Sections come from ALL the rows' families, not only evaluated ones: a
  // family whose roles are still unevaluated shows as a fully hatched band
  // (the ladder's empty look) instead of vanishing from the view. The cells
  // below filter on level themselves, so unevaluated roles never render a
  // chip.
  const families = groupByFamily(rows)

  const renderChip = (role: LevelRoleRow) => (
    <motion.div
      key={role.roleId}
      layout="position"
      layoutId={`famlevels-${role.roleId}`}
      transition={SPRING}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <RoleChip role={role} />
    </motion.div>
  )

  return (
    <ScrollArea orientation="both" className={MATRIX_WRAPPER_CLASS}>
      <table className="w-full border-separate border-spacing-2">
        <thead>
          <tr>
            {bands.map((band, bandIndex) =>
              band.span === null ? null : (
                // This view already groups the zones AROUND the levels, on
                // the other axis: the levels are its columns, so a zone is a
                // colgroup header spanning its three of them. That is the
                // form 14.5.1 asks for, so only the label changed: the short
                // name and the morph, the same label the ladder puts above
                // its groups, instead of the masterdokument's full clause.
                <th
                  key={band.zone}
                  scope="colgroup"
                  colSpan={band.ranges.length}
                  className={`whitespace-nowrap text-left ${MATRIX_HEAD_PAD_CLASS} ${MATRIX_HEAD_INSET_CLASS} ${MATRIX_COL_HEADER_CLASS} ${bandIndex === 0 ? "" : MATRIX_ZONE_RULE_CLASS}`}
                >
                  <ZoneGroupLabel
                    zone={band.zone}
                    content={content.zones[band.zone]}
                  />
                </th>
              )
            )}
          </tr>
          <tr>
            {/* ONE LEFT EDGE for the zone label and the level label. The
                level header carried no horizontal padding while the zone
                header carried px-2, so "Zon B" started 8px right of the
                "Nivå 4" under it and the two rows read as unrelated. Both
                take the shared inset now, which is also where the chips in
                the cells below begin. */}
            {ranges.map((range, index) => (
              <th
                key={range.level}
                scope="col"
                className={`whitespace-nowrap text-left font-medium text-muted-foreground text-xs uppercase tracking-wide ${MATRIX_HEAD_PAD_CLASS} ${MATRIX_HEAD_INSET_CLASS} ${MATRIX_COL_HEADER_CLASS} ${ruleFor(index)}`}
              >
                {t("levelRow", { level: range.level })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {families.map((family) => (
            <Fragment key={family.familyId ?? "none"}>
              {/* The family name gets a row of its own (one line, never
                  squeezed by a left header column); its level cells follow
                  beneath.

                  A CELL PER COLUMN, not one cell spanning them all. The
                  zone rule has to cross this row, and a colSpan cell offers
                  no left edge at a boundary to hang it on, so the line broke
                  at every family: eight gaps down a grid whose whole job is
                  showing one continuous division.

                  The name itself is positioned OUT OF FLOW. In flow it would
                  be the widest thing in the first column and would set that
                  column's width for the entire grid, which is the regression
                  the old colSpan was avoiding; absolute, it contributes no
                  width and no height, so the row is sized by the explicit
                  h-7 (the 28px the colSpan row measured) and the columns are
                  sized by the cells, exactly as before. It stays the row's
                  columnheader: an absolutely positioned span is still the
                  cell's text content. */}
              <tr>
                {ranges.map((range, index) =>
                  index === 0 ? (
                    <th
                      key={range.level}
                      scope="colgroup"
                      className={`relative h-7 text-left ${MATRIX_HEAD_INSET_CLASS}`}
                    >
                      {/* left-2 against the padding box, which the
                          transparent border has already moved 1px in: the
                          name lands on the same 9px inset as every label and
                          chip in the grid. */}
                      <span className="absolute bottom-0 left-2 whitespace-nowrap font-semibold text-sm leading-5">
                        {family.familyName ?? tFamily("none")}
                      </span>
                    </th>
                  ) : (
                    // A td, not a th: these carry the rule and nothing else,
                    // and a th would put an empty columnheader in every
                    // accessibility query the grid answers.
                    <td
                      key={range.level}
                      className={`relative h-7 ${MATRIX_HEAD_INSET_CLASS} ${ruleFor(index)}`}
                    />
                  )
                )}
              </tr>
              <tr>
                {ranges.map((range, index) => {
                  const cell = family.rows.filter(
                    (row) => row.level === range.level
                  )
                  return (
                    <td
                      key={range.level}
                      // relative so the empty-cell hatch can fill the cell via
                      // absolute positioning (see LevelMatrix: a percentage
                      // height on a <td> child does not resolve, absolute
                      // inset-* against the relative cell does).
                      className={`relative min-w-32 rounded-lg border p-2 align-top ${
                        zoneBoundaries.has(index) ? MATRIX_ZONE_RULE_CLASS : ""
                      }`}
                    >
                      {cell.length === 0 ? (
                        <>
                          <div aria-hidden="true" className="min-h-8" />
                          <div
                            aria-hidden="true"
                            className={`absolute inset-2 rounded-md ${HATCH_CLASS}`}
                          />
                        </>
                      ) : (
                        // popLayout: chips the family filter removes pop out of
                        // flow so the survivors reflow in a single pass
                        // (docs/ui-animation.md rule 6).
                        <div className="relative flex flex-col gap-2">
                          <AnimatePresence initial={false} mode="popLayout">
                            {cell.map(renderChip)}
                          </AnimatePresence>
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  )
}
