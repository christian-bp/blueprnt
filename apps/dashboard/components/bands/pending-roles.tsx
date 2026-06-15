"use client"

import { useTranslations } from "next-intl"
import Link from "next/link"
import { HelpMorphButton } from "@/components/help-morph-button"
import { TrackBadge } from "@/components/track-badge"
import type { BandRoleRow } from "@/lib/bands"

// The "not yet evaluated" zone: roles whose assessment is incomplete have no
// band (band null) and wait here. Clicking opens the role, where the
// assessment can be continued. How far the rating has progressed is
// deliberately not shown. Disappears entirely when every role has a band.
export function PendingRoles({ rows }: { rows: BandRoleRow[] }) {
  const t = useTranslations("dashboard.bands")
  const tHelp = useTranslations("dashboard.help")
  const pending = rows.filter((row) => row.band === null)
  if (pending.length === 0) return null

  return (
    <div className="rounded-xl border border-dashed p-3">
      <div className="mb-1 flex items-center gap-1.5">
        <h3 className="font-medium text-sm">{t("pendingHeading")}</h3>
        <HelpMorphButton label={tHelp("pendingBandLabel")}>
          {tHelp("pendingBandBody")}
        </HelpMorphButton>
      </div>
      <p className="mb-3 text-muted-foreground text-sm">
        {t("pendingDescription")}
      </p>
      <div className="flex flex-wrap gap-2">
        {pending.map((role) => (
          <Link
            key={role.roleId}
            href={`/roles/${role.roleId}`}
            className="inline-flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5 text-muted-foreground text-sm hover:bg-accent"
          >
            <span className="truncate font-medium">{role.title}</span>
            <TrackBadge trackKey={role.trackKey} name={role.trackName} />
          </Link>
        ))}
      </div>
    </div>
  )
}
