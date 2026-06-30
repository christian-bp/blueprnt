import type { ReactNode } from "react"
import { PageHeading } from "@/components/page-heading"

// The consistent page header used across dashboard pages: an optional breadcrumb
// trail above a left block with the brand title (plus an optional inline
// adornment, e.g. a concept HelpMorphButton or a track badge) and an optional
// description beneath it, and an optional action on the right (e.g. a
// Create/Invite button or an actions menu). One component so every page header
// looks the same; the Roles page is the canonical shape.
export function PageHeader({
  title,
  titleAdornment,
  description,
  breadcrumb,
  action,
}: {
  title: ReactNode
  titleAdornment?: ReactNode
  description?: ReactNode
  breadcrumb?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="space-y-2">
      {breadcrumb}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <PageHeading>{title}</PageHeading>
            {titleAdornment}
          </div>
          {description !== undefined ? (
            <p className="text-muted-foreground text-sm">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
    </div>
  )
}
