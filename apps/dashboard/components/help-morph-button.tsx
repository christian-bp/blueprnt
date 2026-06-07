"use client"

import { InformationCircleIcon } from "@hugeicons/core-free-icons"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { MorphPopover } from "@/components/morph-popover"

// A discreet round information icon that morphs into an explainer popover,
// the same staged morph as the AI surfaces (MorphPopover). Sits next to a
// heading or a field label; `label` doubles as the trigger's accessible name
// and the popover title. The panel anchors LEFT so it grows rightward from
// the icon instead of overflowing past a left-aligned heading.
export function HelpMorphButton({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  const t = useTranslations("dashboard.help")
  return (
    <MorphPopover
      iconOnly
      anchor="left"
      triggerIcon={InformationCircleIcon}
      triggerLabel={label}
      title={label}
      closeLabel={t("close")}
      className={className}
    >
      <p className="text-muted-foreground text-sm">{children}</p>
    </MorphPopover>
  )
}
