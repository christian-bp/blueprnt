"use client"

import { AnimatePresence, motion } from "motion/react"
import { Fragment } from "react"
import { useTranslations } from "next-intl"
import { HATCH_CLASS } from "@/components/bands/hatch"
import { RoleChip } from "@/components/bands/role-chip"
import { type BandRoleRow, bandRanges } from "@/lib/bands"
import { SPRING } from "@/lib/motion"
import {
  MATRIX_COL_HEADER_CLASS,
  MATRIX_WRAPPER_CLASS,
} from "@/components/bands/matrix-chrome"
import { groupByFamily } from "@/lib/role-groups"

// Family x band matrix (the BandMatrix transposed onto the family axis):
// bands across (Band 1, the highest, first), one SECTION per family (name
// order, the family-less bucket last): a full-width label row with the
// family name on one line, then a row of band cells spanning the whole
// width (no left header column stealing space from the first band). Each
// role sits in the cell where its family meets its band. Family IS the row
// axis here, so the family filter removes whole sections (unlike the
// ladder/matrix, whose structural axes stay put and only lose chips); the
// band columns come from the model and never change with filtering. Same
// neutral-ink chips and popLayout reflow as the siblings.
export function FamilyBandMatrix({
  bands,
  rows,
}: {
  bands: { band: number; minScore: number }[]
  rows: BandRoleRow[]
}) {
  const t = useTranslations("dashboard.bands")
  const tFamily = useTranslations("dashboard.roles.family")
  const ranges = bandRanges(bands)
  const placed = rows.filter((row) => row.band !== null)
  const families = groupByFamily(placed)

  const renderChip = (role: BandRoleRow) => (
    <motion.div
      key={role.roleId}
      layout="position"
      layoutId={`fambands-${role.roleId}`}
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
            {ranges.map((range) => (
              <th
                key={range.band}
                scope="col"
                className={`whitespace-nowrap text-left font-medium text-muted-foreground text-xs uppercase tracking-wide ${MATRIX_COL_HEADER_CLASS}`}
              >
                {t("bandRow", { band: range.band })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {families.map((family) => (
            <Fragment key={family.familyId ?? "none"}>
              {/* The family name gets a full-width row of its own (one line,
                  never squeezed by a left header column); its band cells
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
                    (row) => row.band === range.band
                  )
                  return (
                    <td
                      key={range.band}
                      // relative so the empty-cell hatch can fill the cell via
                      // absolute positioning (see BandMatrix: a percentage
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
