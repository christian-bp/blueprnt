"use client"

import {
  CRITERIA_LIBRARY_KEYS,
  criteriaLibraryContent,
  LIBRARY_DIMENSION,
} from "@workspace/backend/convex/evaluationModel/criteriaLibrary"
import {
  DIMENSION_KEYS,
  DIMENSION_MAX_ACTIVE,
  type DimensionKey,
} from "@workspace/core"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useLocale, useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { HATCH_CLASS } from "@/components/hatch"
import { HelpMorphButton } from "@/components/help-morph-button"

// A content-shaped loading state for the criteria list, the list-equivalent of
// TableSkeleton: render it in place of the <ul> of CriterionItem rows while the
// model query is loading, so the page shows its real shape instantly and the
// rows drop in without reflow. Each placeholder mirrors CriterionItem at rest:
// the same bordered box (rounded-md border p-3), the same min-h-9 inner row and
// 12px inter-row gap, with the trailing slot and note line matching.
// Static per-row chrome (the Open action) is never a bar: it renders as its
// real element, muted and non-interactive; bars stand in only for the data
// (name, description, status, share).

// One placeholder row: the name + description line boxes, the real per-row
// chrome, and the share/status note line.
function CriterionRowSkeleton({ trailing }: { trailing: ReactNode }) {
  return (
    <li className="mb-3 rounded-md border p-3">
      <div className="flex min-h-9 items-center gap-3">
        {/* Name + description in line boxes matching the real row: the name
            inherits the base 24px line (h-6, same as the size-6 help icon),
            the description is text-sm (20px, h-5), stacked with no gap. This
            keeps the row height identical to a loaded CriterionItem so
            nothing shifts when the data arrives. */}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex h-6 items-center">
            <Skeleton className="h-4 w-40" />
          </span>
          <span className="flex h-5 items-center">
            <Skeleton className="h-3 w-56 max-w-full" />
          </span>
        </span>
        {trailing}
      </div>
      {/* Share note in its text-xs line box (16px + mt-1), matching the real
          note so the row height still lines up. */}
      <div className="mt-1 flex h-4 items-center">
        <Skeleton className="h-3 w-28" />
      </div>
    </li>
  )
}

// The method page's criteria list while its data loads.
export function CriterionListSkeleton({ rows = 6 }: { rows?: number }) {
  const tMethod = useTranslations("dashboard.model.method")
  return (
    <ul aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <CriterionRowSkeleton
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder, order is stable
          key={index}
          trailing={
            <span className="flex shrink-0 items-center gap-2">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                tabIndex={-1}
                className="pointer-events-none text-muted-foreground/50"
              >
                {tMethod("openCta")}
              </Button>
            </span>
          }
        />
      ))}
    </ul>
  )
}

// The build grid's geometry, declared here and imported by the view, so the
// loading state and the loaded one can never drift into two different grids.
export const BUILD_GRID_CLASS =
  "grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-4"

// How many library cards a dimension's column shows once the model is built:
// its whole library minus the criteria the caps let it hold. That is the state
// a returning reader opens the page in, and sizing the placeholder to it keeps
// the columns from growing or collapsing when the data lands. Derived from the
// library itself, never a copied count.
function librarySize(dimensionKey: DimensionKey): number {
  return CRITERIA_LIBRARY_KEYS.filter(
    (key) => LIBRARY_DIMENSION[key] === dimensionKey
  ).length
}

// One column of the build grid while the model loads: the dimension's zone on
// top with its library list underneath, exactly as the loaded view lays it
// out.
function BuildColumnSkeleton({
  title,
  helpBody,
  rows,
}: {
  title: string
  helpBody: string
  rows: number
}) {
  const t = useTranslations("dashboard.model.build")
  const tHelp = useTranslations("dashboard.help")
  return (
    <div className="space-y-3">
      {/* The zone's own box, mirrored rather than mounted: DimensionDropZone
          renders the count chip itself, and how many criteria this dimension
          holds is precisely the data being waited for. Everything that is NOT
          data (the dashed frame, the dimension's name, its help) is real. */}
      <div className="rounded-xl border border-dashed p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex min-w-0 items-center gap-1 font-medium text-sm">
            <span className="truncate">{title}</span>
            <HelpMorphButton label={tHelp("dimensionLabel")}>
              {helpBody}
            </HelpMorphButton>
          </h3>
          {/* The count chip's box: a Badge is h-5 and pill-shaped. */}
          <Skeleton className="h-5 w-20 shrink-0 rounded-4xl" />
        </div>
        <div className="mt-3">
          <div
            aria-hidden="true"
            className={`h-16 w-full rounded-md ${HATCH_CLASS}`}
          />
        </div>
      </div>
      <ul aria-hidden="true" className="space-y-2">
        {Array.from({ length: rows }, (_, index) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder, order is stable
            key={index}
            className="rounded-md border bg-card p-3"
          >
            <div className="flex items-start gap-2">
              {/* The card's two text lines in their own line boxes: the name
                  at text-sm (20px) and the one-liner at text-xs (16px), so a
                  placeholder card measures exactly like a real one. */}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex h-5 items-center">
                  <Skeleton className="h-4 w-28 max-w-full" />
                </span>
                <span className="flex h-4 items-center">
                  <Skeleton className="h-3 w-full" />
                </span>
              </span>
              {/* The Add button is static chrome with a static label, so it
                  renders as itself, muted and inert: which criterion it would
                  add is the unknown, so it cannot be live. */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                tabIndex={-1}
                className="pointer-events-none shrink-0 text-muted-foreground/50"
              >
                {t("addCta")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// The build view's loading state: the same four-column grid, with the four
// dimension zones real (they are fixed method law, ADR-0021, and their names
// and guiding questions are locale-keyed library constants, not org data) and
// only the unknowns as bars: how many criteria each dimension holds, and which
// cards its library still offers.
export function BuildGridSkeleton() {
  const locale = useLocale()
  const content = criteriaLibraryContent(locale)
  return (
    <div className={BUILD_GRID_CLASS}>
      {DIMENSION_KEYS.map((key) => (
        <BuildColumnSkeleton
          key={key}
          title={content.dimensions[key].name}
          helpBody={content.dimensions[key].question}
          rows={librarySize(key) - DIMENSION_MAX_ACTIVE[key]}
        />
      ))}
    </div>
  )
}
