"use client"

import { zoneContent } from "@workspace/backend/convex/evaluationModel/zoneContent"
import { AnimatePresence, motion } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import { HATCH_CLASS } from "@/components/hatch"
import { RoleChip } from "@/components/levels/role-chip"
import { ZoneGroupLabel } from "@/components/levels/zone-label"
import { type LevelRoleRow, levelRanges } from "@/lib/levels"
import { SPRING } from "@/lib/motion"
import { groupByFamily as groupRowsByFamily } from "@/lib/role-groups"
import { bandRowsFor, zoneBands } from "@/lib/zone-bands"

// Vertical level ladder: a FLAT list of twelve lanes, Level 1 (highest) on
// top, with the four zones drawn around them. Roles wrap as chips inside their
// lane (getResults already sorts by weighting desc within a level). Empty
// levels stay visible so the full level structure always reads.
//
// The zone is what makes twelve levels legible: read flat, a twelve-rung
// ladder is a list of numbers, and the reader has no way to know that levels
// 1-3 are one KIND of role rather than three neighbouring rungs. But the
// grouping is an ANNOTATION on the ladder, not a set of sections it is cut
// into: section 14.5.1 asks for the zones as visual groupings AROUND the
// levels, and building them as band rows between the levels cost the flat
// list the rhythm that made it readable. See components/levels/zone-label.tsx.
//
// A role is placed in the zone its OWN row names, never in the one its level
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
  // No per-level function control any more. Each of twelve rows carried its
  // own toggle for section 14.6's entry/established/upper text, and a control
  // that repeats twelve times has to earn it: the ladder's job is showing
  // where roles sit, and what a level IS inside its zone is a question about
  // the ZONE, asked once, not twelve times. The row stands its number and its
  // count; the zone's own help carries its words.

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
    <div className="space-y-5">
      {bands.map((band) => {
        if (band.span === null) return null
        const bandRows = bandRowsFor(rows, band.zone)
        return (
          // The zone as an ANNOTATION around its rows: one small label at the
          // top, and the level rows under it exactly as the flat ladder drew
          // them. No band row, no rail, no inset, no collapse. Section 14.5.1
          // asks for the zones to be clearly visible; the label is what makes
          // them visible, and the rail that briefly sat down this edge was
          // ours rather than the document's.
          <section key={band.zone}>
            <div className="mb-2">
              <ZoneGroupLabel
                zone={band.zone}
                content={content.zones[band.zone]}
              />
            </div>
            <ul className="space-y-2">
              {band.ranges.map((range) => {
                const inLevel = bandRows.filter(
                  (row) => row.level === range.level
                )
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
                      </div>
                      {/* self-center (not stretch) so a short content block (an
                          empty hatch or a single chip row) sits vertically
                          centered against the taller two-line rail, giving
                          equal padding above and below. items-start still
                          top-aligns chips within a multi-row level, where the
                          column is the taller side and self-center is a
                          no-op. */}
                      <div className="relative flex flex-1 flex-wrap items-start gap-2 self-center">
                        {inLevel.length === 0 ? (
                          // Empty level: a subtle diagonal-hatch placeholder
                          // (the level's "0 roles" count carries the wording).
                          <div
                            role="img"
                            aria-label={t("levelEmpty")}
                            className={`h-8 w-full rounded-md ${HATCH_CLASS}`}
                          />
                        ) : (
                          <AnimatePresence initial={false} mode="popLayout">
                            {groupByFamily
                              ? groupRowsByFamily(inLevel).flatMap((group) => [
                                  familyLabel(
                                    group.familyId ?? "none",
                                    group.familyName ?? tFamily("none")
                                  ),
                                  ...group.rows.map(renderChip),
                                ])
                              : inLevel.map(renderChip)}
                          </AnimatePresence>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
