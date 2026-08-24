"use client"

import { Badge } from "@workspace/ui/components/badge"
import { useTranslations } from "next-intl"

// The assessment's status vocabulary, in one place so every surface that
// shows a role's assessment state (the role page's evaluation card, the role
// sheet, the rating reveal) says the same words with the same ink.
//
// Statuses here are WORD-ONLY: no status icon rides along at chip scale. A
// glyph beside the word "Completed" says nothing the word does not, and a row
// of little icons reads as a toolbar rather than as state.

// The assessment's own status, as ONE chip with two states.
//
// It used to be two chips standing side by side, and the second could never
// appear without the first: calibrateAssessment refuses an assessment that is
// not completed, so "Calibrated" strictly implies "Completed" and the pair
// said one fact twice. A reader counting chips read two pieces of state and
// had to work out that one contained the other.
//
// Neutral ink at rest, because completing is the ordinary end state of every
// assessment rather than an achievement. Success ink once a person has
// confirmed the placement, which IS an extra step someone chose to take and
// is the only state on this chip row that carries one.
export function AssessmentStatusBadge({ calibrated }: { calibrated: boolean }) {
  const t = useTranslations("dashboard.roles.detail")
  return calibrated ? (
    <Badge variant="success">{t("calibratedBadge")}</Badge>
  ) : (
    <Badge variant="outline">{t("completedBadge")}</Badge>
  )
}

// The derived method-drift chip: a role completed before the model's latest
// approval was rated under a since-superseded method (ADR-0023's
// "bedomd enligt tidigare metod" marking). Purely derived (methodDrift on the
// results wire), never stored; completing again under the current method
// clears it.
export function MethodDriftBadge() {
  const t = useTranslations("dashboard.roles.detail")
  return <Badge variant="secondary">{t("methodDriftBadge")}</Badge>
}

// Completed, yet incomplete: completing an assessment does not freeze the
// model, so a criterion activated afterwards leaves a completed role with an
// unrated criterion. The wire reads complete=false, score=null, level=null
// while completed stays true (results.ts). Every surface used to paper over
// this with a "computing" line or an endless spinner, which claims work is in
// flight when nothing is running. It says what happened and what clears it
// instead.
export function CompletedIncompleteNotice() {
  const t = useTranslations("dashboard.roles.detail")
  return (
    <p className="text-muted-foreground text-sm leading-relaxed">
      {t("completedIncomplete")}
    </p>
  )
}
