"use client"

import { Badge } from "@workspace/ui/components/badge"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useState } from "react"
import { DisclosureToggle } from "@/components/disclosure-toggle"
import { HelpMorphButton } from "@/components/help-morph-button"
import { TrackBadge } from "@/components/track-badge"
import type { LevelRoleRow } from "@/lib/levels"
import { SPRING } from "@/lib/motion"

// The "not yet evaluated" zone: roles whose assessment has no level (level
// null) wait here, for either of two reasons -- still being rated, or fully
// rated but not yet completed (completion is the reveal, spec 2.4/6). A
// `readyToComplete` row gets its own badge so "waiting to be rated" and
// "waiting to be completed" read as the two different states they are; how far
// an in-progress rating has gone is still deliberately not shown. Clicking
// opens the role, where either the rating continues or the flow's own ending
// waits. Disappears entirely when every role has a level.
//
// COLLAPSED, and last on the page. This is the least urgent thing /work has to
// say: it is a list of work not yet started, on a surface whose subject is
// where the finished work landed. Standing open at the bottom of every tab it
// was a permanent block of chips between the reader and nothing.
//
// Always collapsed rather than past a threshold, which is EvidenceDisclosure's
// rule and its reason: the count in the trigger tells the reader what opening
// it costs, so a rule they can predict beats a threshold they have to discover.
// The description that used to stand here said what the help body says, which
// is the duplicate the help laws name; the help is the one that survives.
export function PendingRoles({ rows }: { rows: LevelRoleRow[] }) {
  const t = useTranslations("dashboard.levels")
  const tHelp = useTranslations("dashboard.help")
  const [open, setOpen] = useState(false)
  const pending = rows.filter((row) => row.level === null)
  if (pending.length === 0) return null

  return (
    <div className="rounded-xl border border-dashed p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 className="font-medium text-sm">{t("pendingHeading")}</h3>
        <HelpMorphButton label={tHelp("pendingLevelLabel")}>
          {tHelp("pendingLevelBody")}
        </HelpMorphButton>
        <div className="ms-auto flex items-center">
          <DisclosureToggle
            label={t("roleCount", { count: pending.length })}
            open={open}
            onToggle={() => setOpen((current) => !current)}
          />
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          // Geometry only on the motion element, box styles on the child: a
          // border-box element with padding never reaches height 0, so the
          // collapse would stall and the unmount would jump (ui-animation.md
          // rule 2).
          <motion.div
            key="pending"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-2 pt-3">
              {pending.map((role) => (
                <Link
                  key={role.roleId}
                  href={`/roles/${role.slug}`}
                  className="inline-flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5 text-muted-foreground text-sm hover:bg-accent"
                >
                  <span className="truncate font-medium">{role.title}</span>
                  {role.readyToComplete && (
                    <Badge variant="outline">{t("readyToComplete")}</Badge>
                  )}
                  <TrackBadge trackKey={role.trackKey} name={role.trackName} />
                </Link>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
