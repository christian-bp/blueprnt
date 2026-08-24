"use client"

import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ZoneEntryContent } from "@workspace/backend/convex/evaluationModel/zoneContent"
import type { ZoneKey } from "@workspace/core"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import { FAMILY_COUNT_CLASS, FAMILY_NAME_CLASS } from "@/lib/role-family-row"

// One zone band's heading, shared by the ladder and the level matrix so the
// four bands read identically wherever the levels are shown.
//
// The letter and the name are separate on purpose: ZONE_KEYS owns the letter
// and the content module's `name` deliberately omits it (task 1), so a surface
// that wants both composes them here rather than every locale shipping "A. "
// in front of its own prose.
//
// Chrome borrowed from the roles register's family band (one grouping idiom in
// the app): the same neutral ground, the same name weight, the same rotating
// chevron. What is added is the zone's own DESCRIPTION, which the register's
// families have no equivalent of: a zone is a claim about what kind of work
// belongs there, and a band that stated only "Zone A, levels 1-3" would leave
// the reader to guess it.
export function ZoneBandHeader({
  zone,
  content,
  span,
  roleCount,
  open,
  onToggle,
}: {
  zone: ZoneKey
  content: ZoneEntryContent
  span: { from: number; to: number }
  roleCount: number
  open: boolean
  onToggle: () => void
}) {
  const t = useTranslations("dashboard.levels")
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-expanded={open}
        aria-label={t(open ? "hideZone" : "showZone", { zone })}
        onClick={onToggle}
        className="mt-px shrink-0 text-muted-foreground hover:text-foreground"
      >
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          strokeWidth={2}
          aria-hidden="true"
          className={cn(
            "transition-transform duration-150",
            open && "rotate-90"
          )}
        />
      </Button>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className={cn(FAMILY_NAME_CLASS, "shrink-0")}>
            {t("zoneLabel", { zone })}
          </span>
          <span className={cn(FAMILY_NAME_CLASS, "min-w-0")}>
            {content.name}
          </span>
          <span className={cn(FAMILY_COUNT_CLASS, "shrink-0")}>
            {span.from === span.to
              ? t("zoneSpanOne", { from: span.from })
              : t("zoneSpan", { from: span.from, to: span.to })}
          </span>
          <span className={cn(FAMILY_COUNT_CLASS, "ms-auto shrink-0")}>
            {t("roleCount", { count: roleCount })}
          </span>
        </div>
        {/* The zone's character at reading measure: it is a sentence about what
            kind of work lands here, so it obeys the reading floor rather than
            joining the band's scanned chrome. */}
        <p className="max-w-2xl text-muted-foreground text-sm leading-relaxed">
          {content.character}
        </p>
        {/* Section 14.5's second column, the kinds of role that normally land
            in this zone. It carries a label because the column is an
            OBSERVATION and the sentence above it is a definition: run bare
            under the character line, a list of job kinds reads as the rule for
            who belongs here, which is the one thing it must not say. */}
        <p className="max-w-2xl text-muted-foreground text-sm leading-relaxed">
          <span className="font-medium text-foreground">
            {t("zoneTypicalLabel")}
          </span>{" "}
          {content.typicalProfile}
        </p>
      </div>
    </div>
  )
}
