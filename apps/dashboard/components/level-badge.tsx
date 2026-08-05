"use client"

import { Stairs01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { useTranslations } from "next-intl"

// A computed level as a badge with the stairs glyph (the same icon the role
// evaluation card marks a level with), so level reads identically wherever it
// appears as a chip. Stairs, not a tag: a level is a position on an ordered
// ladder, while the tag glyph means classification elsewhere in the app.
// Level 1 = highest.
export function LevelBadge({
  level,
  className,
}: {
  level: number
  className?: string
}) {
  const t = useTranslations("assessment")
  return (
    <Badge variant="outline" className={className}>
      <HugeiconsIcon icon={Stairs01Icon} strokeWidth={2} aria-hidden="true" />
      {t("levelNumbered", { level })}
    </Badge>
  )
}
