"use client"

import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ZoneEntryContent } from "@workspace/backend/convex/evaluationModel/zoneContent"
import type { ZoneKey } from "@workspace/core"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
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
      {/* A Verve STAT ROW, not a paragraph block: the zone's letter as a
          chip, its short name as the line, its span as a second chip, and the
          count right-aligned. Everything here identifies or quantifies. The
          masterdokument's own full name, the zone's character and its typical
          profile are section 14.5's three columns and were standing here as
          prose; they open from the help beside the name, which is what
          deviation 11's "rendered read-only" asks for and where the reader
          who wants them will look.

          The collapse chevron to the left is not a second affordance of the
          same kind: it shows and hides the band's ROWS. This carries the
          band's words. One control per job. */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Badge variant="outline" className="shrink-0 tabular-nums">
          {zone}
        </Badge>
        <span className={cn(FAMILY_NAME_CLASS, "min-w-0 truncate")}>
          {content.shortName}
        </span>
        <HelpMorphButton label={content.shortName}>
          <span className="space-y-2">
            <span className="block font-medium text-foreground">
              {content.name}
            </span>
            <span className="block">{content.character}</span>
            <span className="block">
              <span className="font-medium text-foreground">
                {`${t("zoneTypicalLabel")}: `}
              </span>
              {content.typicalProfile}
            </span>
          </span>
        </HelpMorphButton>
        {/* The one-level wording is not dead defensive code: zoneBands spans
            only the levels the MODEL configures, not ZONE_LEVEL_RANGES'
            three, so a zone holding one configured level arrives with
            from === to. The alternative is a chip reading "Level 3 to 3". */}
        <Badge variant="secondary" className="shrink-0 tabular-nums">
          {span.from === span.to
            ? t("zoneSpanOne", { from: span.from })
            : t("zoneSpan", { from: span.from, to: span.to })}
        </Badge>
        <span className={cn(FAMILY_COUNT_CLASS, "ms-auto shrink-0")}>
          {t("roleCount", { count: roleCount })}
        </span>
      </div>
    </div>
  )
}
