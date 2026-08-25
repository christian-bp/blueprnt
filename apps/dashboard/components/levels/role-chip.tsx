"use client"

import { AnchorIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import Link from "next/link"
import {
  CALIBRATION_CHIP_CLASS,
  CalibrationMarker,
} from "@/components/levels/calibration-marker"
import { useRoleSheetOptional } from "@/components/role-sheet"
import { TrackBadge } from "@/components/track-badge"
import { calibrationReason } from "@/lib/calibration-queue"
import type { LevelRoleRow } from "@/lib/levels"

const CHIP_CLASS =
  "inline-flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-left text-sm hover:bg-accent"

// One role rendered as a chip in the level ladder or matrix. Data is neutral
// ink, never brand.
//
// A role whose placement needs a human look is MARKED HERE, on the role
// itself: a warning-toned border and the marker for its own class. That is
// masterdokument 14.8's flag, and it used to live in a list on the same page
// instead, which meant the reader had to find the role twice. Clicking the
// chip opens the sheet, where the reason is stated and the act lives.
//
// When a RoleSheetProvider is present the chip opens the role's quick-look
// sheet; otherwise it links to the full role page.
export function RoleChip({ role }: { role: LevelRoleRow }) {
  const t = useTranslations("dashboard.levels")
  const sheet = useRoleSheetOptional()
  const reason = calibrationReason(role)

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
      {reason !== null && (
        <CalibrationMarker
          reason={reason}
          agreedLevel={role.anchor?.expectedLevel}
        />
      )}
    </>
  )

  const className = cn(CHIP_CLASS, reason !== null && CALIBRATION_CHIP_CLASS)

  if (sheet !== null) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => sheet.openRole(role.roleId)}
      >
        {inner}
      </button>
    )
  }

  return (
    <Link href={`/roles/${role.slug}`} className={className}>
      {inner}
    </Link>
  )
}
