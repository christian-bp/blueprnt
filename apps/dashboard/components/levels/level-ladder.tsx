"use client"

import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { HATCH_CLASS } from "@/components/levels/hatch"
import { RoleChip } from "@/components/levels/role-chip"
import { type LevelRoleRow, levelRanges } from "@/lib/levels"
import { SPRING } from "@/lib/motion"
import { groupByFamily as groupRowsByFamily } from "@/lib/role-groups"

// Vertical level ladder: one lane per level, Level 1 (highest) on top. Roles
// wrap as chips inside their lane (getResults already sorts by weighting desc
// within a level). Empty levels stay visible so the full level structure
// always reads.
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
  const ranges = levelRanges(levels)
  const placed = rows.filter((row) => row.level !== null)

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
    <ul className="space-y-2">
      {ranges.map((range) => {
        const inLevel = placed.filter((row) => row.level === range.level)
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
  )
}
