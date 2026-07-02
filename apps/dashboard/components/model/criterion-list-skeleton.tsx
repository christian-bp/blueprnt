import { Skeleton } from "@workspace/ui/components/skeleton"

// A content-shaped loading state for the criteria list, the list-equivalent of
// TableSkeleton: render it in place of the <ul> of CriterionItem rows while the
// model query is loading, so the page shows its real shape instantly and the
// rows drop in without reflow. Each placeholder mirrors CriterionItem at rest:
// the same bordered box (rounded-md border p-3), the same min-h-9 inner row and
// 12px inter-row gap, with the trailing slot and note line matching the phase:
//   - define: only the reserved row-menu square
//   - weight: the 1-5 weight slot (w-52) plus the share note below
//   - method: the status badge + action plus the share note below
export type CriterionListSkeletonVariant = "define" | "weight" | "method"

export function CriterionListSkeleton({
  rows = 6,
  variant,
}: {
  rows?: number
  variant: CriterionListSkeletonVariant
}) {
  const withNote = variant !== "define"
  return (
    <ul aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder, order is stable
          key={index}
          className="mb-3 rounded-md border p-3"
        >
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
            {variant === "define" && (
              <Skeleton className="size-9 shrink-0 rounded-md" />
            )}
            {variant === "weight" && (
              <span className="flex h-9 w-52 shrink-0 items-center justify-end">
                <Skeleton className="h-8 w-full" />
              </span>
            )}
            {variant === "method" && (
              <span className="flex shrink-0 items-center gap-2">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-8 w-16" />
              </span>
            )}
          </div>
          {/* Share note in its text-xs line box (16px + mt-1), matching the
              real note so the row height still lines up. */}
          {withNote && (
            <div className="mt-1 flex h-4 items-center">
              <Skeleton className="h-3 w-28" />
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
