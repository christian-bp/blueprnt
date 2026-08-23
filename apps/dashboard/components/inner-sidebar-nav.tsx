"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { InnerNavCount } from "@/components/inner-nav-count"
import { deepestMatch, type InnerNavGroup } from "@/lib/navigation"

// The registry-driven rows of an area's inner sidebar: optional uppercase
// group headings, ghost-button rows, active row on the accent. Purely
// presentational; which groups exist and who sees them is the registry's
// business (innerNavFor).
export function InnerSidebarNav({
  groups,
  onNavigate,
}: {
  groups: InnerNavGroup[]
  // The mobile nav sheet closes itself when a row is chosen.
  onNavigate?: () => void
}) {
  const t = useTranslations("dashboard")
  const pathname = usePathname()
  const hrefs = groups.flatMap((group) =>
    group.entries.map((entry) => entry.href)
  )
  const current = deepestMatch(hrefs, pathname)
  return (
    <nav className="flex flex-col py-1">
      {groups.map((group, index) => (
        <div key={group.labelKey ?? group.entries[0]?.href}>
          {index > 0 && <Separator className="my-2" />}
          {group.labelKey !== undefined && (
            <p className="px-3 pt-2 pb-1 font-medium text-[11px] text-foreground/70 uppercase">
              {t(group.labelKey)}
            </p>
          )}
          <div className="flex flex-col gap-0.5 px-2">
            {group.entries.map((entry) => {
              const active = entry.href === current
              return (
                <Button
                  key={entry.href}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-2.5",
                    active
                      ? "bg-accent font-medium text-accent-foreground"
                      : "font-normal text-foreground"
                  )}
                  aria-current={active ? "page" : undefined}
                  nativeButton={false}
                  onClick={onNavigate}
                  render={<Link href={entry.href} />}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-3.5">
                    <HugeiconsIcon
                      icon={entry.icon}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="truncate">{t(entry.labelKey)}</span>
                  {entry.count !== undefined && (
                    <InnerNavCount id={entry.count} />
                  )}
                </Button>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}
