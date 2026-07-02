// apps/dashboard/components/overview/todo-skeleton.tsx
import { Skeleton } from "@workspace/ui/components/skeleton"

// Content-shaped loading state for the to-do widget: the heading row plus a few
// group-header rows, so the section keeps its shape while the queries load and
// nothing reflows when data arrives.
export function TodoSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-28" />
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
