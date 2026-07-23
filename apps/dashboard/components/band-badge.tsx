"use client"

import { Tag01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { useTranslations } from "next-intl"

// A computed band as a badge with the tag glyph (the same icon the role
// evaluation card marks a band with), so band reads identically wherever it
// appears as a chip. Band 1 = highest.
export function BandBadge({
  band,
  className,
}: {
  band: number
  className?: string
}) {
  const t = useTranslations("assessment")
  return (
    <Badge variant="outline" className={className}>
      <HugeiconsIcon icon={Tag01Icon} strokeWidth={2} aria-hidden="true" />
      {`${t("band")} ${band}`}
    </Badge>
  )
}
