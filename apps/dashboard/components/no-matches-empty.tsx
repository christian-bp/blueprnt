"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"

// The state a filtered table lands in when nothing matches: the surface's own
// title, the reason, and one way back out. Every register (people, roles, a
// role family) renders this same shape, so the copy and the escape hatch are
// declared once. The description and the button label come from the calling
// surface's own toolbar namespace, since each one counts a different thing.
export function NoMatchesEmpty({
  title,
  description,
  clearLabel,
  onClear,
}: {
  title: string
  description: string
  clearLabel: string
  onClear: () => void
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <Button type="button" variant="outline" onClick={onClear}>
        {clearLabel}
      </Button>
    </Empty>
  )
}
