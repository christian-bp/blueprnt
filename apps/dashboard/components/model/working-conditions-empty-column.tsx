"use client"

import { Skeleton } from "@workspace/ui/components/skeleton"
import Link from "next/link"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { HATCH_CLASS } from "@/components/hatch"
import type { MaterialityStatus } from "@/components/model/working-conditions-decision"
import { chapterHref } from "@/lib/model-chapters"

// The fourth dimension's column body on the chapters that only DISPLAY the
// model (Viktning and Metod), when the dimension holds no criterion.
//
// The column renders at all, where an empty competence, effort or
// responsibility column does not, because the two emptinesses are different
// states. Those three are incomplete on their way to being filled. Working
// conditions may be empty as a FINISHED answer: the materiality test can find
// the dimension not material, and then no criterion is coming (ADR-0022
// section 6.1). A column that vanished said neither, and left the reader of a
// four-dimension method looking at three.
//
// The line LEADS and the hatch follows, the same order the Kriterier column
// puts them in: the sentence is the context for the emptiness under it, and a
// dashed box the reader meets before its explanation reads backwards. The
// hatch stays here, unlike on the Kriterier chapter where an explained column
// drops it, because there the box is a slot the reader can fill on the spot
// and here it is not: what it says on these two chapters is "this dimension's
// place in the method", which is true whichever way the test went.
// The fourth column's loading shape: one text-line bar, and nothing else.
//
// It stands in for the whole column while a chapter's model is loading, where
// the other three dimensions get card placeholders. Those three are all but
// certainly staffed, so a card is the honest guess; this one is as likely to
// resolve to a sentence over a hatch, because many organizations test the
// dimension and find it not material. A bar resolves into EITHER by filling
// in, while a bordered card resolving into a paragraph is a shape swap the
// reader watches happen.
export function WorkingConditionsColumnSkeleton() {
  return (
    <div className="flex h-5 items-center">
      <Skeleton className="h-3 w-4/5" />
    </div>
  )
}

export function WorkingConditionsEmptyColumn({
  decision,
}: {
  // The recorded materiality decision, as both chapters' OWN queries already
  // carry it (getModel on Viktning, getMethodChecks on Metod), so neither pays
  // for a second subscription to explain its column. Only the status is read.
  // undefined is a third state, not a second null: the query carrying the
  // answer has not landed yet.
  decision: { status: MaterialityStatus } | null | undefined
}) {
  const t = useTranslations("dashboard.model.criteria.workingConditions")
  const tCriteria = useTranslations("dashboard.model.criteria")

  // The way to the chapter that owns the decision. Both chapters here can only
  // report it: the test is taken, and the criterion chosen, in Kriterier.
  const link = (chunks: ReactNode) => (
    <Link
      href={chapterHref("criteria")}
      className="text-brand underline underline-offset-4"
    >
      {chunks}
    </Link>
  )

  return (
    <div className="space-y-2">
      {decision === undefined ? (
        // The line's BOX while the answer is still loading, never a guessed
        // sentence: which of the three is true is exactly what is missing, and
        // two of them would be wrong.
        <WorkingConditionsColumnSkeleton />
      ) : (
        <p className="text-muted-foreground text-sm">
          {decision === null
            ? t.rich("columnUndecided", { link })
            : decision.status === "testedNotMaterial"
              ? t("columnNotMaterial")
              : t.rich("columnMaterial", { link })}
        </p>
      )}
      {/* The app's one empty-slot language, with the label the Kriterier
          column's own hatch carries: a decorative fill with no accessible name
          is a box a screen reader cannot report at all. */}
      <div
        role="img"
        aria-label={tCriteria("columnEmpty")}
        className={`h-16 w-full rounded-md ${HATCH_CLASS}`}
      />
    </div>
  )
}
