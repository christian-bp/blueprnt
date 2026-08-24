"use client"

import { Badge } from "@workspace/ui/components/badge"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { HelpMorphButton } from "@/components/help-morph-button"
import { TrackBadge } from "@/components/track-badge"
import type { LevelRoleRow } from "@/lib/levels"

// The "not yet evaluated" zone: roles whose assessment has no level (level
// null) wait here, for either of two reasons -- still being rated, or fully
// rated but not yet locked (lock-as-reveal, spec 2.4/6). A `readyToLock` row
// gets its own badge so "waiting to be rated" and "waiting to be locked"
// read as the two different states they are; how far an in-progress rating
// has gone is still deliberately not shown. Clicking opens the role, where
// either the rating flow continues or the lock action lives. Disappears
// entirely when every role has a level.
export function PendingRoles({ rows }: { rows: LevelRoleRow[] }) {
  const t = useTranslations("dashboard.levels")
  const tHelp = useTranslations("dashboard.help")
  const pending = rows.filter((row) => row.level === null)
  if (pending.length === 0) return null

  return (
    <div className="rounded-xl border border-dashed p-3">
      <div className="mb-1 flex items-center gap-1.5">
        <h3 className="font-medium text-sm">{t("pendingHeading")}</h3>
        <HelpMorphButton label={tHelp("pendingLevelLabel")}>
          {tHelp("pendingLevelBody")}
        </HelpMorphButton>
      </div>
      <p className="mb-3 text-muted-foreground text-sm">
        {t("pendingDescription")}
      </p>
      <div className="flex flex-wrap gap-2">
        {pending.map((role) => (
          <Link
            key={role.roleId}
            href={`/roles/${role.slug}`}
            className="inline-flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5 text-muted-foreground text-sm hover:bg-accent"
          >
            <span className="truncate font-medium">{role.title}</span>
            {role.readyToLock && (
              <Badge variant="outline">{t("readyToComplete")}</Badge>
            )}
            <TrackBadge trackKey={role.trackKey} name={role.trackName} />
          </Link>
        ))}
      </div>
    </div>
  )
}
