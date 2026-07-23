"use client"

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { ReviewStepActions } from "./review-step-actions"

// The two group chapters' own intro step (ADR-0012): a static card that
// sets up the chapter before its groups start, so the plain-language
// framing (what a group is, why the flags exist,
// what 60% means) is read once per chapter instead of repeated on every
// group step. No documentation obligation of its own (review-queue.ts's
// isStepDone treats "chapterIntro" as trivially done), so its only gate is
// none: "Continue" is always enabled, exactly like the start step's own
// unconditional primary action.
//
// `groupCount` is the chapter's own requiring-documentation count (queue
// members only, not the non-queue ✅/zero-comparison groups the jump menu
// also lists): when it's zero, this chapter has nothing to review, and the
// reassurance line says so explicitly rather than leaving the user to infer
// it from an unusually short chapter.
export function ReviewChapterIntro({
  chapter,
  groupCount,
  locked,
  onNext,
  onPrevious,
}: {
  chapter: "equalWork" | "equivalentWork"
  groupCount: number
  locked: boolean
  onNext: () => void
  onPrevious?: () => void
}) {
  const t = useTranslations("dashboard.payMapping.review")
  const tIntro = useTranslations(
    `dashboard.payMapping.review.chapters.intro.${chapter}`
  )
  const tForm = useTranslations("dashboard.payMapping.analysisForm")
  const tHelp = useTranslations("dashboard.help")

  // Only the CHAPTER concept's own help sits on the heading row (never two
  // help popovers on one heading, per CLAUDE.md): the second concept
  // (the severity flags for equalWork, the women-domination detail for
  // equivalentWork) is mentioned IN the body copy, so its help sits beside
  // the body paragraph instead. Both intro bodies are a single translated
  // string (never split, to avoid touching locale VALUES), so "beside the
  // sentence that mentions it" is approximated as "right after the
  // paragraph" rather than inline mid-sentence.
  const secondHelpLabelKey =
    chapter === "equalWork" ? "payGapFlagsLabel" : "womenDominatedLabel"
  const secondHelpBodyKey =
    chapter === "equalWork" ? "payGapFlagsBody" : "womenDominatedBody"

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-1.5">
          <CardTitle>{tIntro("title")}</CardTitle>
          {chapter === "equalWork" ? (
            <HelpMorphButton label={tHelp("payGapEqualWorkLabel")}>
              {tHelp("payGapEqualWorkBody")}
            </HelpMorphButton>
          ) : (
            <HelpMorphButton label={tHelp("payGapEquivalentWorkLabel")}>
              {tHelp("payGapEquivalentWorkBody")}
            </HelpMorphButton>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {locked && (
          <p className="text-muted-foreground text-sm">{tForm("lockedHint")}</p>
        )}
        <div className="flex items-center gap-2">
          <p className="text-sm">{tIntro("body")}</p>
          <HelpMorphButton label={tHelp(secondHelpLabelKey)}>
            {tHelp(secondHelpBodyKey)}
          </HelpMorphButton>
        </div>
        {groupCount === 0 && (
          <p className="text-muted-foreground text-sm">{tIntro("empty")}</p>
        )}
      </CardContent>
      <CardFooter>
        <ReviewStepActions
          onPrevious={onPrevious}
          primaryLabel={t("continue")}
          onPrimary={onNext}
        />
      </CardFooter>
    </Card>
  )
}
