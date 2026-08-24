"use client"

import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ZoneEntryContent } from "@workspace/backend/convex/evaluationModel/zoneContent"
import type { ZoneKey } from "@workspace/core"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { SPRING } from "@/lib/motion"
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
          {/* The one-level wording is NOT dead defensive code, and it is not
              the same class as the ceiling branch this round deleted from the
              level-rules schema. That one could never fire by Zod's own
              evaluation order, inside a single file. This one renders a shape
              zoneBands is written and documented to produce: it spans only the
              levels the MODEL configures, not ZONE_LEVEL_RANGES' three, so a
              zone holding one configured level arrives here with from === to.
              That a stored model always has all twelve rules today is an
              invariant enforced in the backend, three layers away; the
              alternative is a header reading "Level 3 to 3". */}
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
        {/* Section 14.5's second column moved BEHIND the band's own
            disclosure. It is an observation about who usually lands in a zone,
            printed on a surface that is already showing exactly who did, and
            four bands standing open made eight sentences above a ladder whose
            job is showing where roles sit. The level-function text three rows
            below has always been behind a press; this is the same depth and
            now opens the same way. The label stays: the column is an
            OBSERVATION, and run bare a list of job kinds reads as the rule for
            who belongs here, which is the one thing it must not say. */}
        {/* Animated, not toggled. The band's BODY animates open from the
            ladder below, and this paragraph lives in the header ABOVE that
            wrapper, so a bare conditional made one gesture jump the header and
            spring the body, shoving the bands underneath instantly. Two halves
            of one press must not move at two speeds. */}
        <AnimatePresence initial={false}>
          {open ? (
            <motion.p
              key="typical"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={SPRING}
              className="max-w-2xl overflow-hidden text-muted-foreground text-sm leading-relaxed"
            >
              {/* The colon is composed HERE, not carried in the message. Every
                other "Label: value" line in the app does it this way (the
                stepper's measures/not-measures, the role card's motivation,
                the picker's three suitability lines); no message key carries
                an inline one. Punctuation in the message reads like the
                better rule until you count the siblings. */}
              <span className="font-medium text-foreground">
                {`${t("zoneTypicalLabel")}: `}
              </span>
              {content.typicalProfile}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}
