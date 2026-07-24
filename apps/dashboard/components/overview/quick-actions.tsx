"use client"

import {
  Briefcase01Icon,
  ChartColumnIcon,
  Tag01Icon,
  UserGroup03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { useTranslations } from "next-intl"
import Link from "next/link"

// Plain links into the four surfaces a fresh org most often jumps to,
// reusing the same domain icon the sidebar uses for each. Static chrome
// (labels and hrefs never depend on data), so it always renders for real,
// loading or not.
const ACTIONS: {
  key: "importEmployees" | "classify" | "roles" | "startPayMapping"
  href: string
  icon: IconSvgElement
}[] = [
  { key: "importEmployees", href: "/people/import", icon: UserGroup03Icon },
  { key: "classify", href: "/people/classify", icon: Tag01Icon },
  { key: "roles", href: "/roles", icon: Briefcase01Icon },
  { key: "startPayMapping", href: "/pay-mappings", icon: ChartColumnIcon },
]

export function QuickActions() {
  const t = useTranslations("dashboard.overview.quickActions")
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {ACTIONS.map(({ key, href, icon }) => (
        <Link
          key={key}
          href={href}
          className="group flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs transition-colors hover:bg-muted"
        >
          <HugeiconsIcon
            icon={icon}
            strokeWidth={2}
            aria-hidden="true"
            className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground"
          />
          <span>{t(key)}</span>
        </Link>
      ))}
    </div>
  )
}
