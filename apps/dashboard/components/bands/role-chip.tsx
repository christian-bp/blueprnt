"use client"

import { AnchorIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { DeviationBadge } from "@/components/deviation-badge"
import { useRoleSheetOptional } from "@/components/role-sheet"
import { TrackBadge } from "@/components/track-badge"
import type { BandRoleRow } from "@/lib/bands"

const CHIP_CLASS =
  "inline-flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-left text-sm hover:bg-accent"

// One role rendered as a chip in the band ladder or matrix. Data is neutral
// ink, never brand. Anchor roles carry the anchor marker; a computed band that
// deviates from the agreed band shows a destructive flag, the one intentional
// colored accent (an alert to act on, not a judgement of the role). When a
// RoleSheetProvider is present the chip opens the role's quick-look sheet;
// otherwise it links to the full role page.
export function RoleChip({ role }: { role: BandRoleRow }) {
  const t = useTranslations("dashboard.bands")
  const sheet = useRoleSheetOptional()
  const deviates =
    role.anchor !== null &&
    role.band !== null &&
    role.band !== role.anchor.expectedBand

  const inner = (
    <>
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
        <DeviationBadge agreedBand={role.anchor.expectedBand} />
      )}
    </>
  )

  if (sheet !== null) {
    return (
      <button
        type="button"
        className={CHIP_CLASS}
        onClick={() => sheet.openRole(role.roleId)}
      >
        {inner}
      </button>
    )
  }

  return (
    <Link href={`/roles/${role.slug}`} className={CHIP_CLASS}>
      {inner}
    </Link>
  )
}
