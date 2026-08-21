"use client"

import { criteriaLibraryContent } from "@workspace/backend/convex/evaluationModel/criteriaLibrary"
import {
  type DimensionKey,
  type MethodCheckKey,
  PEOPLE_LEADERSHIP_LIBRARY_KEY,
} from "@workspace/core"
import Link from "next/link"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { formatNames } from "@/lib/list-format"
import { CHECK_CHAPTER, chapterHref } from "@/lib/model-chapters"
import { DIMENSION_SHARE_FORMAT } from "@/lib/weighting"

// The line under a FAILING checklist row that says what to do about it.
//
// The checklist states twelve verdicts, and a verdict on its own is a dead end:
// "no dimension dominates the weighting unexplained" tells a reader they are
// wrong without telling them which dimension, by how much, or where the control
// that fixes it lives. Every failing row therefore carries a remedy in words:
// the action, the CHAPTER it happens in as a real link, and the SPECIFICS
// wherever the check already computed them (the dominant dimension and its
// share, the overlapping pairs by name, the number of undocumented criteria).
//
// Passing rows carry nothing. A remedy under a green row would be noise, and
// twelve of them would bury the two that matter.

// The check slice a remedy reads. Structural rather than the wire type, so the
// component can be exercised with a handful of fields instead of a whole model.
export interface RemedyCheck {
  key: MethodCheckKey
  ok: boolean
  criterionIds?: readonly string[]
  dimensions?: readonly DimensionKey[]
  // Wire shape: two-string arrays, not tuples (a Convex array validator cannot
  // express a fixed length).
  pairs?: readonly (readonly string[])[]
  count?: number
}

export interface DimensionShare {
  key: DimensionKey
  // A fraction of 1, as the engine computes it. Rounding to whole points is
  // this component's, at display time.
  share: number
}

export function CheckRemedy({
  check,
  dimensionShares,
}: {
  check: RemedyCheck
  dimensionShares: readonly DimensionShare[]
}) {
  const t = useTranslations("dashboard.model.method")
  const tChapters = useTranslations("dashboard.model.chapters")
  const format = useFormatter()
  const locale = useLocale()

  if (check.ok) return null

  // Library content, not the model query: a dimension's name and a criterion's
  // name are locale-keyed constants (ADR-0021), so naming them here costs the
  // card no second subscription and no wait.
  const content = criteriaLibraryContent(locale)
  const dimensionName = (key: DimensionKey) => content.dimensions[key].name
  const criterionName = (libraryKey: string) =>
    // A key the library no longer knows would be a data problem, not a reason
    // to crash a checklist: fall back to the key rather than throwing in render.
    content.criteria[libraryKey as keyof typeof content.criteria]?.name ??
    libraryKey
  const shareOf = (key: DimensionKey) =>
    format.number(
      dimensionShares.find((entry) => entry.key === key)?.share ?? 0,
      DIMENSION_SHARE_FORMAT
    )

  // The dimensions a check names, each with its own share in parentheses, so
  // the dominance row answers "which one, and by how much" in the same breath.
  const namedDimensions = (withShare: boolean) =>
    formatNames(
      locale,
      (check.dimensions ?? []).map((key) =>
        withShare
          ? `${dimensionName(key)} (${shareOf(key)})`
          : dimensionName(key)
      )
    )

  const chapter = CHECK_CHAPTER[check.key]
  // The chapter's own tab label, so the link text always reads as the tab the
  // reader is about to land on. A remedy with no in-app chapter (the level and
  // zone-profile rules, which nothing in the app edits) passes no link at all;
  // its message carries no <link> tag either.
  const values = {
    chapter: chapter === null ? "" : tChapters(chapter),
    link: (chunks: ReactNode) =>
      chapter === null ? (
        chunks
      ) : (
        <Link
          href={chapterHref(chapter)}
          className="text-brand underline underline-offset-4"
        >
          {chunks}
        </Link>
      ),
  }

  const message = (): ReactNode => {
    switch (check.key) {
      case "dimensionCoverage":
      case "dimensionCaps":
        return t.rich(`remedies.${check.key}`, {
          ...values,
          dimensions: namedDimensions(false),
        })
      case "dimensionWeightBalance":
        return t.rich("remedies.dimensionWeightBalance", {
          ...values,
          dimensions: namedDimensions(true),
        })
      case "peopleLeadershipWeight":
        return t.rich("remedies.peopleLeadershipWeight", {
          ...values,
          criterion: criterionName(PEOPLE_LEADERSHIP_LIBRARY_KEY),
        })
      case "overlapPairs":
        return t.rich("remedies.overlapPairs", {
          ...values,
          // A pair is bound by its own separator, not by "and": half the
          // library's criteria are named "X and Y" themselves, so "Knowledge
          // depth and specialist level and Knowledge breadth and
          // cross-disciplinary understanding" cannot be read back as two
          // things. The pairs are then joined without a connective for the same
          // reason.
          pairs: formatNames(
            locale,
            (check.pairs ?? []).map((pair) =>
              t("overlapPairFormat", {
                first: criterionName(pair[0] ?? ""),
                second: criterionName(pair[1] ?? ""),
              })
            ),
            "unit"
          ),
        })
      case "criterionCount":
        return t.rich("remedies.criterionCount", {
          ...values,
          count: check.count ?? 0,
        })
      case "documentationComplete":
        return t.rich("remedies.documentationComplete", {
          ...values,
          count: check.criterionIds?.length ?? 0,
        })
      default:
        return t.rich(`remedies.${check.key}`, values)
    }
  }

  return (
    // In flow under its own row rather than in a popover or a tooltip: this is
    // the sentence the reader needs in order to act, and hiding the only
    // actionable half of a checklist behind a hover is how the checklist came
    // to be unactionable in the first place. text-sm because it is reading
    // text, muted because the row above it is the finding and this is the
    // instruction.
    <p className="mt-1 pl-6 text-muted-foreground text-sm">{message()}</p>
  )
}
