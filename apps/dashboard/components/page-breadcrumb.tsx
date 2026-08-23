import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { Skeleton } from "@workspace/ui/components/skeleton"
import Link from "next/link"
import { Fragment } from "react"

// One breadcrumb segment. A segment with an href links to that route; the last
// segment (and any without an href) renders as the current page. A skeleton
// segment stands in for an entity name that is still loading (same width every
// time, so the row never shifts when the name arrives).
export type Crumb = { label: string; href?: string } | { skeleton: true }

// Shared page breadcrumb: ancestor crumbs (with an href) link to their route;
// the final crumb is the current page, rendered non-navigable with
// aria-current in the plain foreground ink (the ancestors are the muted ones).
export function PageBreadcrumb({ segments }: { segments: Crumb[] }) {
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1
          const key =
            "skeleton" in segment
              ? `skeleton-${index}`
              : `${segment.label}-${segment.href || ""}`
          return (
            <Fragment key={key}>
              <BreadcrumbItem className="min-w-0">
                {"skeleton" in segment ? (
                  <Skeleton className="h-4 w-24" />
                ) : isLast ? (
                  <BreadcrumbPage className="truncate font-normal text-foreground">
                    {segment.label}
                  </BreadcrumbPage>
                ) : segment.href !== undefined ? (
                  <BreadcrumbLink render={<Link href={segment.href} />}>
                    {segment.label}
                  </BreadcrumbLink>
                ) : (
                  // An ancestor with no page of its own (the section name over
                  // its landing page): plain muted text, neither a link nor
                  // the current page.
                  <span className="truncate">{segment.label}</span>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
