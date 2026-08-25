"use client"

import type { ZoneEntryContent } from "@workspace/backend/convex/evaluationModel/zoneContent"
import type { ZoneKey } from "@workspace/core"
import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"

// The zones, drawn AROUND the levels instead of between them.
//
// Section 14.5.1 asks for the zones to be clearly visible as visual and
// explanatory groupings around the levels. They were built as band rows: a
// header row per zone, stacked between the level rows, each with its own
// collapse control and its own sentences. That reads as four sections of a
// page rather than as an annotation on one ladder, and it cost the flat
// twelve-rung list the rhythm that made it legible in the first place.
//
// So the ladder is flat again, exactly its pre-zone shape, and the zone is a
// RAIL: a thin marker down the group's edge spanning its rows, with one small
// label at the top. Muted ink, never brand: this is structure, not a judgement
// about the roles inside it, and the brand ink on this page belongs to the
// level a role actually landed on.
//
// No collapse. A rail that folded its rows away would be a band row again in
// everything but shape, and the flat list is short enough to read whole.
export const ZONE_RAIL_CLASS = "border-muted-foreground/25 border-s-2 ps-4"

// The label's own scale: SCANNED, not read. Same treatment as the app's other
// group eyebrows (the level-rules panel's per-zone groups), so a zone reads
// the same wherever it annotates something.
export const ZONE_RAIL_LABEL_CLASS =
  "font-medium text-muted-foreground text-xs uppercase tracking-wide"

// Letter, short name, and the depth behind the morph.
//
// Everything standing here identifies. Section 14.5's three columns (the
// masterdokument's full name, the zone's character, the roles that typically
// land in it) are what the help carries: deviation 11 asks for them rendered
// read-only, and the morph layer is where this app renders read-only depth.
//
// No role count. The level rows underneath each carry their own, and a zone
// total beside them would be a second number for the reader to reconcile
// against the three they can already see.
export function ZoneRailLabel({
  zone,
  content,
}: {
  zone: ZoneKey
  content: ZoneEntryContent
}) {
  const t = useTranslations("dashboard.levels")
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className={ZONE_RAIL_LABEL_CLASS}>{t("zoneLabel", { zone })}</span>
      <span className={ZONE_RAIL_LABEL_CLASS}>{content.shortName}</span>
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
    </div>
  )
}
