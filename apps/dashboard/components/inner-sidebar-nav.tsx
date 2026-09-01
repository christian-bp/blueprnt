"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { InnerNavCount } from "@/components/inner-nav-count"
import { InnerNavDone } from "@/components/inner-nav-done"
import { deepestMatch, type InnerNavGroup } from "@/lib/navigation"

// The uppercase category title every sidebar group renders above its rows.
// One component so the registry nav and the page-owned sidebars (the run
// sidebar) can never drift in pitch.
export function InnerNavHeading({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pt-2 pb-1 font-medium text-[11px] text-foreground/70 uppercase">
      {children}
    </p>
  )
}

// The registry-driven rows of an area's inner sidebar: an uppercase category
// heading per group, ghost-button rows, active row on the accent. Purely
// presentational; which groups exist and who sees them is the registry's
// business (innerNavFor).
export function InnerSidebarNav({
  groups,
  onNavigate,
  children,
}: {
  groups: InnerNavGroup[]
  // The mobile nav sheet closes itself when a row is chosen.
  onNavigate?: () => void
  // Data-driven rows an area appends AFTER its registry rows (the
  // pay-mappings register lists its runs here). The registry itself stays
  // static and framework-free; anything queried lives in the caller.
  children?: ReactNode
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
        <div key={group.labelKey}>
          {index > 0 && <Separator className="my-2" />}
          <InnerNavHeading>{t(group.labelKey)}</InnerNavHeading>
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
                  {entry.done !== undefined && <InnerNavDone id={entry.done} />}
                </Button>
              )
            })}
          </div>
        </div>
      ))}
      {children}
    </nav>
  )
}
