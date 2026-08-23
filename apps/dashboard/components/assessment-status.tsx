"use client"

import { Badge } from "@workspace/ui/components/badge"
import { useTranslations } from "next-intl"

// The assessment's status vocabulary, in one place so every surface that
// shows a role's assessment state (the role page's evaluation card, the role
// sheet, the rating reveal) says the same words with the same ink.
//
// Statuses here are WORD-ONLY: no status icon rides along at chip scale. A
// lock glyph beside the word "Locked" says nothing the word does not, and a
// row of little icons reads as a toolbar rather than as state.

// A locked, revealed result (lock-as-reveal, spec 2.4/6): the assessment is
// closed to further rating and its weighting and level are readable. Neutral
// ink, because being locked is the ordinary end state of every assessment,
// not an achievement or a warning.
export function LockedBadge() {
  const t = useTranslations("dashboard.roles.detail")
  return <Badge variant="outline">{t("lockedBadge")}</Badge>
}

// The derived method-drift chip: a role locked before the model's latest
// approval was rated under a since-superseded method (ADR-0023's
// "bedomd enligt tidigare metod" marking). Purely derived (methodDrift on the
// results wire), never stored; re-locking under the current method clears it.
export function MethodDriftBadge() {
  const t = useTranslations("dashboard.roles.detail")
  return <Badge variant="secondary">{t("methodDriftBadge")}</Badge>
}

// A placement a human has confirmed from the calibration queue (spec 6):
// `calibratedAt` is stamped on the assessment. Success ink, because unlike
// locked it IS an affirmative step someone took, and it is the only state on
// this chip row that carries one.
export function CalibratedBadge() {
  const t = useTranslations("dashboard.roles.detail")
  return <Badge variant="success">{t("calibratedBadge")}</Badge>
}

// Locked, yet incomplete: locking does not freeze the model, so a criterion
// activated after the lock leaves a locked role with an unrated criterion.
// The wire reads complete=false, score=null, level=null while locked stays
// true (results.ts). Every surface used to paper over this with a "computing"
// line or an endless spinner, which claims work is in flight when nothing is
// running. It says what happened and what clears it instead.
export function LockedIncompleteNotice() {
  const t = useTranslations("dashboard.roles.detail")
  return (
    <p className="text-muted-foreground text-sm leading-relaxed">
      {t("lockedIncomplete")}
    </p>
  )
}
