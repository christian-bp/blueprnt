"use client"

import type { ZoneEntryContent } from "@workspace/backend/convex/evaluationModel/zoneContent"
import type { ZoneKey } from "@workspace/core"
import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"

// The zones, marked around the levels by their LABEL alone.
//
// Section 14.5.1 asks for the zones to be clearly visible as visual and
// explanatory groupings around the levels. They were built as band rows first:
// a header row per zone, stacked between the level rows, each with its own
// collapse control and its own sentences. That reads as four sections of a
// page rather than as an annotation on one ladder, and it cost the flat
// twelve-rung list the rhythm that made it legible.
//
// A rail down each group's edge came next, and it went the same way: the
// document asks for the zones to be visible, and the label is what makes them
// visible. The rail was ours, not the document's, and a marker that adds an
// inset and a border to every group is the surface doing more than the reader
// asked for. The title is enough.
//
// So a zone is one small label at the top of its levels, and nothing else. No
// rail, no inset, no collapse: the flat list is short enough to read whole,
// and the levels underneath keep the exact rhythm they had before zones
// existed.

// The label's own scale: SCANNED, not read. Same treatment as the app's other
// group eyebrows (the level-rules panel's per-zone groups), so a zone reads
// the same wherever it annotates something.
export const ZONE_GROUP_LABEL_CLASS =
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
//
// This is now the WHOLE grouping, on every surface that shows it: the ladder
// puts it above its three rows, and the two matrices head their zone's
// columns or rows with it.
export function ZoneGroupLabel({
  zone,
  content,
}: {
  zone: ZoneKey
  content: ZoneEntryContent
}) {
  const t = useTranslations("dashboard.levels")
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className={ZONE_GROUP_LABEL_CLASS}>{t("zoneLabel", { zone })}</span>
      <span className={ZONE_GROUP_LABEL_CLASS}>{content.shortName}</span>
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
