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

// A completed, revealed result (spec 2.4/6, decision 14): the assessment is
// settled, closed to further rating, and its weighting and level are readable.
// Neutral ink, because completing is the ordinary end state of every
// assessment, not an achievement or a warning.
export function CompletedBadge() {
  const t = useTranslations("dashboard.roles.detail")
  return <Badge variant="outline">{t("completedBadge")}</Badge>
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

// A placement a human has confirmed from the calibration queue (spec 6):
// `calibratedAt` is stamped on the assessment. Success ink, because unlike
// completion it IS an extra step someone chose to take, and it is the only
// state on this chip row that carries one.
export function CalibratedBadge() {
  const t = useTranslations("dashboard.roles.detail")
  return <Badge variant="success">{t("calibratedBadge")}</Badge>
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
