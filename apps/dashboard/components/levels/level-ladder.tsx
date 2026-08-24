"use client"

import {
  levelFunction,
  zoneContent,
} from "@workspace/backend/convex/evaluationModel/zoneContent"
import type { ZoneKey } from "@workspace/core"
import { AnimatePresence, motion } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { DisclosureToggle } from "@/components/disclosure-toggle"
import { HATCH_CLASS } from "@/components/hatch"
import { RoleChip } from "@/components/levels/role-chip"
import { ZoneBandHeader } from "@/components/levels/zone-band-header"
import { type LevelRoleRow, levelRanges } from "@/lib/levels"
import { SPRING } from "@/lib/motion"
import { groupByFamily as groupRowsByFamily } from "@/lib/role-groups"
import { bandRowsFor, zoneBands } from "@/lib/zone-bands"

// Vertical level ladder, grouped into the four ZONES: one band per zone (A on
// top, the highest), one lane per level inside it, Level 1 (highest) on top.
// Roles wrap as chips inside their lane (getResults already sorts by weighting
// desc within a level). Empty levels stay visible so the full level structure
// always reads.
//
// The zone is what makes twelve levels legible: read flat, a twelve-rung
// ladder is a list of numbers, and the reader has no way to know that levels
// 1-3 are one KIND of role rather than three neighbouring rungs. Each band
// states what its zone is (masterdokument 14.5) and each level can reveal what
// its position inside its zone means (14.6).
//
// A role is placed in the band its OWN zone names, never in the band its level
// implies: placement is the engine's (ADR-0022's placeRole, which may cap a
// role into a lower zone), and the UI reports it. See lib/zone-bands.ts.
//
// With groupByFamily on, the chips inside each level lane cluster by family: a
// full-width family label (family A-Z, family-less last) precedes that
// family's chips. The chips live in ONE container per lane and keep their
// keys across the toggle, so flipping the grouping re-flows them to their new
// positions with a layout animation while the labels fade in/out. Chips use
// layout="position" so the move never scales/warps their text
// (ui-animation.md rule 1); the shared layoutId also animates a role between
// lanes when its level changes.
export function LevelLadder({
  levels,
  rows,
  groupByFamily = false,
}: {
  levels: { level: number; minScore: number }[]
  rows: LevelRoleRow[]
  groupByFamily?: boolean
}) {
  const t = useTranslations("dashboard.levels")
  const tFamily = useTranslations("dashboard.roles.family")
  const locale = useLocale()
  const content = zoneContent(locale)
  const bands = zoneBands(levelRanges(levels))
  // Which bands are CLOSED, not which are open: every band starts open, so a
  // filter change that reveals a band cannot leave it collapsed, and a zone the
  // model gains later opens by default like every other.
  const [closed, setClosed] = useState<ReadonlySet<ZoneKey>>(() => new Set())
  // Which level's function text is showing, PER BAND. One at a time within a
  // zone: the three texts are three sentences about the same three positions,
  // and a whole ladder of them open at once is a wall rather than an answer.
  //
  // Per band rather than per ladder, because one shared slot made opening a
  // level collapse whichever level was open somewhere else, and when that
  // other level sat ABOVE the click the row under the pointer jumped up by the
  // height of a paragraph the reader was not looking at. A collapse the reader
  // did not ask for and cannot see is the layout shift the surface laws
  // forbid; scoping it means the only thing that ever moves is below the
  // gesture that moved it.
  const [openFunction, setOpenFunction] = useState<
    ReadonlyMap<ZoneKey, number>
  >(() => new Map())

  const renderChip = (role: LevelRoleRow) => (
    <motion.div
      key={role.roleId}
      layout="position"
      layoutId={`ladder-${role.roleId}`}
      transition={SPRING}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <RoleChip role={role} />
    </motion.div>
  )

  // No exit on the label: a full-width label that lingered (fading) while it
  // still occupied its row would make the chips below it reflow in two phases
  // on ungroup (move, pause, finish). Unmounting it instantly lets the chips
  // do a single smooth FLIP to their flat positions. It still fades in on
  // group, where a freshly mounted row reserves its space immediately.
  const familyLabel = (key: string, name: string) => (
    <motion.div
      key={`fam-${key}`}
      layout="position"
      transition={SPRING}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full pt-1 text-muted-foreground text-xs"
    >
      {name}
    </motion.div>
  )

  return (
    <div className="space-y-4">
      {bands.map((band) => {
        if (band.span === null) return null
        const bandRows = bandRowsFor(rows, band.zone)
        const open = !closed.has(band.zone)
        return (
          <section key={band.zone} className="rounded-xl border">
            <div className="rounded-t-xl bg-muted/50 p-3">
              <ZoneBandHeader
                zone={band.zone}
                content={content.zones[band.zone]}
                span={band.span}
                roleCount={bandRows.length}
                open={open}
                onToggle={() =>
                  setClosed((current) => {
                    const next = new Set(current)
                    if (!next.delete(band.zone)) next.add(band.zone)
                    return next
                  })
                }
              />
            </div>
            {open ? (
              <ul className="space-y-2 p-3">
                {band.ranges.map((range) => {
                  const inLevel = bandRows.filter(
                    (row) => row.level === range.level
                  )
                  const fn = levelFunction(content, range.level)
                  const functionOpen =
                    openFunction.get(band.zone) === range.level
                  return (
                    <li key={range.level} className="rounded-xl border p-3">
                      <div className="flex gap-4">
                        <div className="w-28 shrink-0">
                          <div className="font-semibold text-sm">
                            {t("levelRow", { level: range.level })}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {t("roleCount", { count: inLevel.length })}
                          </div>
                          {/* What this level IS inside its zone (masterdokument 14.6):
                    the entry, the established middle, or the top. Behind a
                    press, because the ladder's job is showing where roles sit
                    and twelve standing paragraphs would bury that. */}
                          <DisclosureToggle
                            label={fn.label}
                            open={functionOpen}
                            onToggle={() =>
                              setOpenFunction((current) => {
                                const next = new Map(current)
                                if (next.get(band.zone) === range.level) {
                                  next.delete(band.zone)
                                } else {
                                  next.set(band.zone, range.level)
                                }
                                return next
                              })
                            }
                            className="mt-1"
                          />
                        </div>
                        {/* self-center (not stretch) so a short content block (an empty
                  hatch or a single chip row) sits vertically centered against
                  the taller two-line rail, giving equal padding above and
                  below. items-start still top-aligns chips within a multi-row
                  level, where the column is the taller side and self-center
                  is a no-op. */}
                        <div className="relative flex flex-1 flex-wrap items-start gap-2 self-center">
                          {inLevel.length === 0 ? (
                            // Empty level: a subtle diagonal-hatch placeholder (the
                            // level's "0 roles" count in the rail carries the wording).
                            <div
                              role="img"
                              aria-label={t("levelEmpty")}
                              className={`h-8 w-full rounded-md ${HATCH_CLASS}`}
                            />
                          ) : (
                            <AnimatePresence initial={false} mode="popLayout">
                              {groupByFamily
                                ? groupRowsByFamily(inLevel).flatMap(
                                    (group) => [
                                      familyLabel(
                                        group.familyId ?? "none",
                                        group.familyName ?? tFamily("none")
                                      ),
                                      ...group.rows.map(renderChip),
                                    ]
                                  )
                                : inLevel.map(renderChip)}
                            </AnimatePresence>
                          )}
                        </div>
                      </div>
                      <AnimatePresence initial={false}>
                        {functionOpen ? (
                          <motion.div
                            key="function"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={SPRING}
                            className="overflow-hidden"
                          >
                            <p className="max-w-2xl pt-2 text-muted-foreground text-sm leading-relaxed">
                              {fn.meaning}
                            </p>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
