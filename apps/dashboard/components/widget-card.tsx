"use client"

import { FullScreenIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { useTranslations } from "next-intl"
import { type ReactNode, useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"

// The app-wide stat/chart widget: a compact card with a title, optional
// inline help, an optional trailing header slot (e.g. a scope chip), and an
// optional expand affordance that opens the content in a large dialog for a
// closer look. Charts pass `expandedChildren` with a taller variant; when
// omitted, the dialog reuses the card's children. Titles are static i18n
// chrome, so a loading widget still renders its real title (skeleton rule);
// the content owns its own loading bars.
export function WidgetCard({
  title,
  help,
  headerExtra,
  expandable = false,
  expandedChildren,
  className,
  children,
}: {
  title: string
  help?: { label: string; body: string }
  headerExtra?: ReactNode
  expandable?: boolean
  expandedChildren?: ReactNode
  className?: string
  children: ReactNode
}) {
  const t = useTranslations("dashboard.widgetCard")
  const [open, setOpen] = useState(false)

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center gap-2">
        <CardTitle>{title}</CardTitle>
        {help !== undefined && (
          <HelpMorphButton label={help.label}>{help.body}</HelpMorphButton>
        )}
        {(headerExtra !== undefined || expandable) && (
          <div className="ml-auto flex items-center gap-2">
            {headerExtra}
            {expandable && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("expand")}
                onClick={() => setOpen(true)}
              >
                <HugeiconsIcon icon={FullScreenIcon} strokeWidth={2} />
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {expandable && (
        <Dialog open={open} onOpenChange={setOpen}>
          {/* Deliberately wider than the sm:max-w-md default: the whole point
              of expanding is a larger canvas for the chart. */}
          <DialogContent className="sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            {expandedChildren ?? children}
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}
