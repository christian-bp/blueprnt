"use client"

import { zoneContent } from "@workspace/backend/convex/evaluationModel/zoneContent"
import type { ZoneKey } from "@workspace/core"
import { AnimatePresence, motion } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import { Fragment, useState } from "react"
import { HATCH_CLASS } from "@/components/hatch"
import { RoleChip } from "@/components/levels/role-chip"
import {
  MATRIX_COL_HEADER_CLASS,
  MATRIX_WRAPPER_CLASS,
} from "@/components/levels/matrix-chrome"
import { ZoneBandHeader } from "@/components/levels/zone-band-header"
import { type LevelRoleRow, levelRanges } from "@/lib/levels"
import { SPRING } from "@/lib/motion"
import { groupByFamily as groupRowsByFamily } from "@/lib/role-groups"
import { bandRowsFor, zoneBands } from "@/lib/zone-bands"

// Level x track matrix, banded by ZONE: levels down (Level 1 on top), tracks
// across, with each zone's three levels under a band row of their own. Each
// role sits in the cell where its level meets its track. The track columns
// are passed in (derived from the UNFILTERED roles) so the grid stays stable
// as the family filter changes: hidden families just leave hatched empty
// cells rather than collapsing the grid (and an all-hidden filter still shows
// the full hatched grid). Same neutral-ink chips, inline anchor treatment,
// and group-by-family clustering as the ladder.
export function LevelMatrix({
  levels,
  rows,
  tracks,
  groupByFamily = false,
}: {
  levels: { level: number; minScore: number }[]
  rows: LevelRoleRow[]
  tracks: { key: string; name: string }[]
  groupByFamily?: boolean
}) {
  const t = useTranslations("dashboard.levels")
  const tFamily = useTranslations("dashboard.roles.family")
  const locale = useLocale()
  const content = zoneContent(locale)
  const bands = zoneBands(levelRanges(levels))
  // Closed, not open: every band starts open and a newly configured zone opens
  // with the rest (same rule as the ladder).
  const [closed, setClosed] = useState<ReadonlySet<ZoneKey>>(() => new Set())

  const renderChip = (role: LevelRoleRow) => (
    <motion.div
      key={role.roleId}
      layout="position"
      layoutId={`matrix-${role.roleId}`}
      transition={SPRING}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <RoleChip role={role} />
    </motion.div>
  )

  // No exit on the label (see LevelLadder): unmounting it instantly on
  // ungroup lets the cell's chips reflow in a single smooth FLIP instead of
  // two phases.
  const familyLabel = (key: string, name: string) => (
    <motion.div
      key={`fam-${key}`}
      layout="position"
      transition={SPRING}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="text-[10px] text-muted-foreground uppercase tracking-wide"
    >
      {name}
    </motion.div>
  )

  return (
    <div className={MATRIX_WRAPPER_CLASS}>
      <table className="w-full border-separate border-spacing-2">
        <thead>
          <tr>
            <th scope="col" className={`w-24 ${MATRIX_COL_HEADER_CLASS}`} />
            {tracks.map((track) => (
              <th
                key={track.key}
                scope="col"
                // The visible header is the short key (IC / Lead / M); give
                // screen readers the full track name as the accessible name
                // (title alone is not reliably announced).
                aria-label={track.name}
                title={track.name}
                className={`text-left font-medium text-muted-foreground text-xs uppercase tracking-wide ${MATRIX_COL_HEADER_CLASS}`}
              >
                {track.key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bands.map((band) => {
            if (band.span === null) return null
            const open = !closed.has(band.zone)
            return (
              <Fragment key={band.zone}>
                {/* The band's own row, spanning the whole grid: a matrix has
                    no left column wide enough to carry a zone's description,
                    so the band takes a row of its own above its levels. */}
                <tr>
                  {/* A td, not a th: the band heads a group of ROWS, and the
                      roles register's family band does the same. A colgroup
                      th would also enter every columnheader query on the
                      surface, which the track headers own. */}
                  <td
                    colSpan={tracks.length + 1}
                    className="rounded-lg bg-muted/50 p-3 text-left"
                  >
                    <ZoneBandHeader
                      zone={band.zone}
                      content={content.zones[band.zone]}
                      span={band.span}
                      roleCount={bandRowsFor(rows, band.zone).length}
                      open={open}
                      onToggle={() =>
                        setClosed((current) => {
                          const next = new Set(current)
                          if (!next.delete(band.zone)) next.add(band.zone)
                          return next
                        })
                      }
                    />
                  </td>
                </tr>
                {open
                  ? band.ranges.map((range) => (
                      <tr key={range.level}>
                        <th
                          scope="row"
                          className="text-left align-middle font-normal"
                        >
                          <div className="whitespace-nowrap font-semibold text-sm">
                            {t("levelRow", { level: range.level })}
                          </div>
                        </th>
                        {tracks.map((track) => {
                          // From the band's OWN rows, so a role sits in the zone the
                          // engine placed it in even if its level were ever read
                          // differently.
                          const cell = bandRowsFor(rows, band.zone).filter(
                            (row) =>
                              row.level === range.level &&
                              row.trackKey === track.key
                          )
                          return (
                            <td
                              key={track.key}
                              // relative so the empty-cell hatch can fill the cell via
                              // absolute positioning: a percentage height on a <td> child
                              // does not resolve, but `absolute inset-*` against the
                              // relative cell does, so the hatch stretches to the full row
                              // height set by the tallest sibling cell.
                              className="relative min-w-32 rounded-lg border p-2 align-top"
                            >
                              {cell.length === 0 ? (
                                // Empty cell: a diagonal-hatch placeholder that fills the
                                // whole cell (matching a tall sibling, e.g. a 3-role
                                // track). The spacer floors the row height when the entire
                                // level row is empty; the absolute hatch then stretches to
                                // whatever height the row ends up being. Decorative (the
                                // row and column headers carry the level and track).
                                <>
                                  <div aria-hidden="true" className="min-h-8" />
                                  <div
                                    aria-hidden="true"
                                    className={`absolute inset-2 rounded-md ${HATCH_CLASS}`}
                                  />
                                </>
                              ) : (
                                // popLayout: chips the family filter removes pop out of
                                // flow so the survivors reflow in a single pass instead
                                // of two (docs/ui-animation.md rule 6); relative anchors
                                // the popped chips within the cell.
                                <div className="relative flex flex-col gap-2">
                                  <AnimatePresence
                                    initial={false}
                                    mode="popLayout"
                                  >
                                    {groupByFamily
                                      ? groupRowsByFamily(cell).flatMap(
                                          (group) => [
                                            familyLabel(
                                              group.familyId ?? "none",
                                              group.familyName ??
                                                tFamily("none")
                                            ),
                                            ...group.rows.map(renderChip),
                                          ]
                                        )
                                      : cell.map(renderChip)}
                                  </AnimatePresence>
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
