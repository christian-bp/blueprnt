"use client"
import { buttonVariants } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import type { ReactNode } from "react"

export const OVERVIEW_CARD_MIN_H = "min-h-[188px]" // re-measured in Task 7

export function OverviewWidgetCard({
  title,
  headline,
  badge,
  action,
  viz,
  minH = OVERVIEW_CARD_MIN_H,
}: {
  title: string
  headline: ReactNode
  badge?: ReactNode
  action: { label: string; href: string }
  viz: ReactNode
  minH?: string
}) {
  return (
    <Card className={cn("flex flex-col gap-4 overflow-hidden pb-0", minH)}>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription className="flex items-center gap-2 text-foreground">
          {headline}
          {badge}
        </CardDescription>
        <CardAction>
          {/* Wrap buttonVariants() in cn() so twMerge collapses the base
              border-transparent against the outline variant's border-border
              (last wins) and the border is visible. A bare buttonVariants()
              string keeps both and the transparent one wins. Kept a plain
              Link (a navigation control is an <a>, not a button). */}
          <Link
            href={action.href}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {action.label}
          </Link>
        </CardAction>
      </CardHeader>
      {/* Decorative only: the header's title + headline already carry the
          card's meaning, so the viz needs no accessible name of its own. */}
      <div aria-hidden="true" className="mt-auto w-full">
        {viz}
      </div>
    </Card>
  )
}
