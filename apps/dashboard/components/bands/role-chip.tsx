"use client"

import { AnchorIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { TrackBadge } from "@/components/track-badge"
import type { BandRoleRow } from "@/lib/bands"

// One role rendered as a chip in the band ladder or matrix. Data is neutral
// ink, never brand. Anchor roles carry the anchor marker; a computed band
// that deviates from the agreed band shows a destructive flag, the one
// intentional colored accent (an alert to act on, not a judgement of the
// role). Clicking the chip opens the role.
export function RoleChip({ role }: { role: BandRoleRow }) {
  const t = useTranslations("dashboard.bands")
  const deviates =
    role.anchor !== null &&
    role.band !== null &&
    role.band !== role.anchor.expectedBand

  return (
    <Link
      href={`/roles/${role.roleId}`}
      className="inline-flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-sm hover:bg-accent"
    >
      {role.anchor !== null && (
        <HugeiconsIcon
          icon={AnchorIcon}
          size={14}
          strokeWidth={2}
          className="shrink-0 text-muted-foreground"
          aria-label={t("anchorLabel")}
        />
      )}
      <span className="truncate font-medium">{role.title}</span>
      <TrackBadge trackKey={role.trackKey} name={role.trackName} short />
      {deviates && role.anchor !== null && (
        <Badge
          variant="destructive"
          // Screen readers get the full meaning, not just the "≠ Band n" glyph.
          aria-label={t("deviationLabel", { band: role.anchor.expectedBand })}
          title={t("deviationLabel", { band: role.anchor.expectedBand })}
        >
          {t("deviation", { band: role.anchor.expectedBand })}
        </Badge>
      )}
    </Link>
  )
}
