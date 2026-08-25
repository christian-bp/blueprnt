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
import { zoneBands } from "@/lib/zone-bands"
import {
  MATRIX_COL_HEADER_CLASS,
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
    <div className={MATRIX_WRAPPER_CLASS}>
      <table className="w-full border-separate border-spacing-2">
        <thead>
          <tr>
            {bands.map((band) =>
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
                  className={`whitespace-nowrap px-2 py-1 text-left ${MATRIX_COL_HEADER_CLASS}`}
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
            {ranges.map((range) => (
              <th
                key={range.level}
                scope="col"
                className={`whitespace-nowrap text-left font-medium text-muted-foreground text-xs uppercase tracking-wide ${MATRIX_COL_HEADER_CLASS}`}
              >
                {t("levelRow", { level: range.level })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {families.map((family) => (
            <Fragment key={family.familyId ?? "none"}>
              {/* The family name gets a full-width row of its own (one line,
                  never squeezed by a left header column); its level cells
                  follow beneath. */}
              <tr>
                <th
                  scope="colgroup"
                  colSpan={ranges.length}
                  className="pt-2 text-left font-semibold text-sm"
                >
                  {family.familyName ?? tFamily("none")}
                </th>
              </tr>
              <tr>
                {ranges.map((range) => {
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
                      className="relative min-w-32 rounded-lg border p-2 align-top"
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
    </div>
  )
}
