"use client"

import { AnimatePresence, motion } from "motion/react"
import { Fragment } from "react"
import { zoneContent } from "@workspace/backend/convex/evaluationModel/zoneContent"
import { useLocale, useTranslations } from "next-intl"
import { HATCH_CLASS } from "@/components/hatch"
import { RoleChip } from "@/components/levels/role-chip"
import { type LevelRange, type LevelRoleRow, levelRanges } from "@/lib/levels"
import { SPRING } from "@/lib/motion"
import { ZoneGroupLabel } from "@/components/levels/zone-label"
import { zoneBands, zoneBoundaryIndexes } from "@/lib/zone-bands"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
  MATRIX_COL_HEADER_CLASS,
  MATRIX_COL_RULE_CLASS,
  MATRIX_HEAD_INSET_CLASS,
  MATRIX_ZONE_GAP_CLASS,
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

  // ONE COLUMN LIST, and every row type renders from it.
  //
  // A zone boundary is a COLUMN here, not a class on the column after it: the
  // zones have to read as separated groups, and the air that separates them
  // has to sit outside the cells' own boxes (see MATRIX_ZONE_GAP_CLASS). One
  // list is also what keeps the four row types aligned by construction; they
  // used to agree only because three separate index calculations happened to
  // produce the same answer.
  const columns: (
    | { kind: "gap"; key: string }
    | { kind: "level"; key: string; range: LevelRange; index: number }
  )[] = ranges.flatMap((range, index) => {
    const column = {
      kind: "level" as const,
      key: `level-${range.level}`,
      range,
      index,
    }
    return zoneBoundaries.has(index)
      ? [{ kind: "gap" as const, key: `gap-${range.level}` }, column]
      : [column]
  })

  // The level rule, in the gutter to a column's left. The first column has no
  // neighbour to be divided from, and a column that opens a zone has the gap
  // column beside it instead: two rules in one boundary is not a stronger
  // division, it is a smudge.
  const ruleFor = (index: number): string =>
    index === 0 || zoneBoundaries.has(index) ? "" : MATRIX_COL_RULE_CLASS

  // The boundary column, in whichever row is asking. Its only job is to hold
  // the air and draw the rule down the middle of it.
  const gapCell = (key: string) => (
    <td
      key={key}
      aria-hidden="true"
      // A named slot, not a class match: "w-3" is a substring of "min-w-32",
      // so a test keying on the width would count every cell in the grid as
      // a boundary and pass on a matrix that had none.
      data-slot="zone-gap"
      className={`${MATRIX_ZONE_GAP_CLASS} ${MATRIX_ZONE_RULE_CLASS}`}
    >
      {/* THE WIDTH HAS TO BE CONTENT, not a class on the cell. Auto table
          layout treats a width on an empty cell as a suggestion and collapsed
          this column to 0px; a child with a real width gives the column a
          min-content of 12px, which the algorithm has to honour. */}
      <div className="h-px w-3" />
    </td>
  )
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
            {columns.map((column) => {
              if (column.kind === "gap") return gapCell(column.key)
              // The band's header sits on the first level column of the band
              // and spans the rest of it. Built from the SAME list as every
              // other row: interleaving the gaps separately made each band's
              // colSpan swallow the boundary column beside it, which put this
              // row's rules in different columns from the rest of the grid.
              const band = bands.find(
                (candidate) =>
                  candidate.span !== null &&
                  candidate.ranges[0]?.level === column.range.level
              )
              if (band === undefined) return null
              return (
                // This view already groups the zones AROUND the levels, on
                // the other axis: the levels are its columns, so a zone is a
                // colgroup header spanning its three of them. That is the
                // form 14.5.1 asks for, so only the label changed: the short
                // name and the morph, the same label the ladder puts above
                // its groups, instead of the masterdokument's full clause.
                <th
                  key={column.key}
                  scope="colgroup"
                  colSpan={band.ranges.length}
                  className={`whitespace-nowrap text-left ${MATRIX_HEAD_PAD_CLASS} ${MATRIX_HEAD_INSET_CLASS} ${MATRIX_COL_HEADER_CLASS}`}
                >
                  <ZoneGroupLabel
                    zone={band.zone}
                    content={content.zones[band.zone]}
                  />
                </th>
              )
            })}
          </tr>
          <tr>
            {/* ONE LEFT EDGE for the zone label and the level label. The
                level header carried no horizontal padding while the zone
                header carried px-2, so "Zon B" started 8px right of the
                "Nivå 4" under it and the two rows read as unrelated. Both
                take the shared inset now, which is also where the chips in
                the cells below begin. */}
            {columns.map((column) =>
              column.kind === "gap" ? (
                gapCell(column.key)
              ) : (
                <th
                  key={column.key}
                  scope="col"
                  className={`whitespace-nowrap text-left font-medium text-muted-foreground text-xs uppercase tracking-wide ${MATRIX_HEAD_PAD_CLASS} ${MATRIX_HEAD_INSET_CLASS} ${MATRIX_COL_HEADER_CLASS} ${ruleFor(column.index)}`}
                >
                  {t("levelRow", { level: column.range.level })}
                </th>
              )
            )}
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
                {columns.map((column) =>
                  column.kind === "gap" ? (
                    gapCell(column.key)
                  ) : column.index === 0 ? (
                    <th
                      key={column.key}
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
                      key={column.key}
                      className={`relative h-7 ${MATRIX_HEAD_INSET_CLASS}`}
                    />
                  )
                )}
              </tr>
              <tr>
                {columns.map((column) => {
                  if (column.kind === "gap") return gapCell(column.key)
                  const cell = family.rows.filter(
                    (row) => row.level === column.range.level
                  )
                  return (
                    <td
                      key={column.key}
                      // relative so the empty-cell hatch can fill the cell via
                      // absolute positioning (see LevelMatrix: a percentage
                      // height on a <td> child does not resolve, absolute
                      // inset-* against the relative cell does).
                      // No rule of its own: the level rule hangs from the
                      // header, and the zone rule lives in the boundary
                      // column beside this one.
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
    </ScrollArea>
  )
}
