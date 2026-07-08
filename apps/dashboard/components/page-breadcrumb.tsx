import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import Link from "next/link"
import { Fragment } from "react"

// One breadcrumb segment. A segment with an href links to that route; the last
// segment (and any without an href) renders as the current page.
export interface Crumb {
  label: string
  href?: string
}

// Shared page breadcrumb: ancestor crumbs (with an href) link to their route;
// the final crumb is the current page, rendered non-navigable with aria-current.
// Used in the PageHeader breadcrumb slot, above the page title, on the role and
// family pages.
export function PageBreadcrumb({ segments }: { segments: Crumb[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1
          const isLink = !isLast && segment.href !== undefined
          return (
            <Fragment key={`${segment.label}-${segment.href || ""}`}>
              <BreadcrumbItem>
                {isLink ? (
                  <BreadcrumbLink
                    render={<Link href={segment.href as string} />}
                  >
                    {segment.label}
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="font-medium">
                    {segment.label}
                  </BreadcrumbPage>
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
