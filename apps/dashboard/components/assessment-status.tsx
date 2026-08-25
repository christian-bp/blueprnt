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

// A placement a person has CONFIRMED from the calibration queue (spec 6):
// `calibratedAt` is stamped on the assessment. Success ink, because it is an
// extra step someone chose to take, and it is the only state on this chip row
// that carries one.
//
// It renders nothing when the assessment is merely completed, and that is the
// point. This was briefly a two-state chip whose other state said "Completed",
// which every surface that showed it also proved: a level chip beside it, a
// weighting figure under it, or a notice already saying the word. A chip that
// repeats what the thing next to it demonstrates is a chip the reader has to
// read before discovering it says nothing. Completion still speaks where it is
// the ONLY signal: the rated-but-not-completed state names what is left, and a
// flagged placement states its own reason.
export function CalibratedBadge({ calibrated }: { calibrated: boolean }) {
  const t = useTranslations("dashboard.roles.detail")
  if (!calibrated) return null
  return <Badge variant="success">{t("calibratedBadge")}</Badge>
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
