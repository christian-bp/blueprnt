"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useQuery } from "convex/react"
import Link from "next/link"
import { useOrganization } from "@/components/org-context"

// The register sidebar's run links: every kartläggning as a child row under
// the Lönekartläggningar entry, so a run is one click away wherever the
// reader is in the register. Newest first (the query's own order, same as
// the table). The rows follow the run sidebar's child anatomy: a blank
// spacer in the icon slot aligns the label under the parent's text, and the
// muted ink reads one step quieter than the top-level row. Inside a run
// this whole sidebar is replaced by the run's own (RunSidebar), so these
// rows are never the current page and carry no active state.
export function PayMappingRunsNav({ onNavigate }: { onNavigate?: () => void }) {
  const { orgId } = useOrganization()
  const runs = useQuery(api.payMapping.runs.listPayMappingRuns, { orgId })
  if (runs === undefined) {
    // Content-shaped placeholder rows measured like the loaded ones (the
    // Button's h-8 box): only the label, unknown until the data arrives, is
    // a bar. Two rows, the register's typical size.
    return (
      <div className="flex flex-col gap-0.5 px-2 pt-0.5">
        {[0, 1].map((row) => (
          <div key={row} className="flex h-8 items-center gap-2.5 px-2.5">
            <span className="size-4 shrink-0" aria-hidden="true" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    )
  }
  if (runs.length === 0) return null
  return (
    <div className="flex flex-col gap-0.5 px-2 pt-0.5">
      {runs.map((run) => (
        <Button
          key={run.runId}
          variant="ghost"
          className="w-full justify-start gap-2.5 font-normal text-muted-foreground"
          nativeButton={false}
          onClick={onNavigate}
          render={<Link href={`/pay-mappings/${run.slug}`} />}
        >
          <span className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{run.label}</span>
        </Button>
      ))}
    </div>
  )
}
