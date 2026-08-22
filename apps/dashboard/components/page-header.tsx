import type { ReactNode } from "react"
import {
  PageHeaderAdornmentSlot,
  PageHeaderAsideSlot,
} from "@/components/page-header-slot"
import { PageHeading } from "@/components/page-heading"

// The consistent page header used across dashboard pages: an optional breadcrumb
// trail above a left block with the page title (plus an optional inline
// adornment, e.g. a concept HelpMorphButton or a track badge) and an optional
// description beneath it, and an optional action on the right (e.g. a
// Create/Invite button or an actions menu). One component so every page header
// looks the same; the Roles page is the canonical shape.
//
// The adornment and the action are also SLOTS, for the pages whose header is
// rendered by a route layout above the subtree that knows what belongs in it
// (page-header-slot.tsx). A page that fills neither renders exactly what it
// always did: both slots are empty spans that take no layout of their own.
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
            <PageHeaderAdornmentSlot />
          </div>
          {description !== undefined ? (
            <p className="text-muted-foreground text-sm">{description}</p>
          ) : null}
        </div>
        {action}
        <PageHeaderAsideSlot />
      </div>
    </div>
  )
}
