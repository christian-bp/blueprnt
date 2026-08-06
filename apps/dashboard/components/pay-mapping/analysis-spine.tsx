"use client"

import NumberFlow from "@number-flow/react"
import { Button } from "@workspace/ui/components/button"
import { Progress } from "@workspace/ui/components/progress"
import { useTranslations } from "next-intl"
import type { ReactNode, RefObject } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"

// Rung 0 of the analysis ladder: where the whole mapping stands, in one
// line, above everything else on the page. Deliberately NOT built on
// WizardProgress: that component renders an unconditional Spinner (this is a
// steady state, not a running job) and clamps its bar monotonically, so it
// could never move backwards when a user undoes a klarmarkering.
export function AnalysisSpine({
  done,
  total,
  collaboration,
  onOpenCollaboration,
  headingRef,
  right,
}: {
  done: number
  total: number
  // The run's samverkan record, or null when it has not been filled in yet.
  collaboration: { participants: string; description: string } | null
  // Opens the start step, where the record is edited.
  onOpenCollaboration: () => void
  // The page's programmatic focus target (the small-screen back control
  // returns focus here).
  headingRef: RefObject<HTMLHeadingElement | null>
  // Optional trailing slot on the heading row.
  right?: ReactNode
}) {
  const t = useTranslations("dashboard.payMapping.analysis")
  const tHelp = useTranslations("dashboard.help")
  const pct = total <= 0 ? 0 : Math.round((done / total) * 100)
  const participants = collaboration?.participants.trim() ?? ""

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* The heading IS the standing: the page above already says
              "Analysis", so a second title would only repeat it. outline-none
              because this is a programmatic focus target only, never
              reachable by Tab. Purely numeric layout inside, so the message
              carries the numbers as tags and both roll through NumberFlow as
              steps are marked done (the live-numbers rule). */}
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="font-semibold text-base outline-none"
          >
            {t("progressLabel")}{" "}
            <span className="tabular-nums">
              {t.rich("progressCount", {
                done: () => <NumberFlow value={done} />,
                total: () => <NumberFlow value={total} />,
              })}
            </span>
          </h3>
          <HelpMorphButton label={tHelp("analysisProgressLabel")}>
            {tHelp("analysisProgressBody")}
          </HelpMorphButton>
        </div>
        {right}
      </div>
      <Progress value={pct} aria-label={t("progressLabel")} />
      <p className="text-muted-foreground text-sm">{t("lead")}</p>
      {/* The samverkan strip: DL 3 kap. 11-12 §§ frame every step below, but
          the record is entered once at the start and never mentioned again.
          Read-only here; the help text says plainly that showing it does not
          by itself discharge the duty at this step. */}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-sm">
        <span>{t("collaborationLabel")}</span>
        <span className={participants === "" ? undefined : "text-foreground"}>
          {participants === "" ? t("collaborationEmpty") : participants}
        </span>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto px-0"
          onClick={onOpenCollaboration}
        >
          {participants === ""
            ? t("collaborationAdd")
            : t("collaborationChange")}
        </Button>
        <HelpMorphButton label={tHelp("collaborationStripLabel")}>
          {tHelp("collaborationStripBody")}
        </HelpMorphButton>
      </p>
    </section>
  )
}
