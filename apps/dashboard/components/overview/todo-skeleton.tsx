"use client"

import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useTranslations } from "next-intl"

// Content-shaped loading state for the to-do widget: the real heading (its
// label and chevron are static chrome; only the count is data) plus a few
// group-header rows, so the section keeps its shape while the queries load
// and nothing reflows when data arrives.
export function TodoSkeleton() {
  const t = useTranslations("dashboard.overview.todo")
  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 font-semibold text-lg">
        {t("heading")}
        <Skeleton className="h-5 w-6" />
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          strokeWidth={2}
          aria-hidden="true"
          className="size-5 text-brand"
        />
      </h2>
      <div className="flex flex-col">
        {(["a", "b", "c"] as const).map((k) => (
          <div
            key={k}
            className="flex items-center justify-between border-b py-4"
          >
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-6" />
          </div>
        ))}
      </div>
    </div>
  )
}
