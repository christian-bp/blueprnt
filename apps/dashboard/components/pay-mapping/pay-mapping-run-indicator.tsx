"use client"

import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useOrganization } from "@/components/org-context"

// The open kartläggning's identity at the header's right (the competitor's
// period-indicator corner), doubling as the run switcher: clicking the
// label opens a menu of the org's kartläggningar (the annual runs), each
// linking to the SAME sub-page in the chosen run, plus the way back to the
// list. That makes the corner the workspace's navigation, so the run pages
// carry no breadcrumb. The run query is the same subscription the run shell
// holds, so this costs no extra fetch; the list is small (one run per year)
// and subscribes on mount so the menu is complete by the time it opens.
// Hidden on small screens where the header has no room; the sidebar's
// Lönekartläggningar item remains the way back there.
export function PayMappingRunIndicator() {
  const t = useTranslations("dashboard.payMapping")
  const pathname = usePathname()
  const { orgId } = useOrganization()
  const [, slug, ...rest] = pathname.split("/").filter(Boolean)
  const run = useQuery(
    api.payMapping.runs.getPayMappingRunBySlug,
    slug === undefined ? "skip" : { orgId, slug }
  )
  const runs = useQuery(
    api.payMapping.runs.listPayMappingRuns,
    slug === undefined ? "skip" : { orgId }
  )

  if (slug === undefined || run === null) return null
  // The /review takeover is a fixed, full-viewport overlay with its own
  // chrome; it only visually covers the header, so an unguarded switcher
  // would stay keyboard/screen-reader-reachable underneath it. Same guard
  // as PayMappingTabs.
  if (rest[0] === "review") return null

  // Swapping the run keeps the visitor on the same sub-page (comparing the
  // same view across years is the point of switching).
  const subPath = rest.length > 0 ? `/${rest.join("/")}` : ""

  return (
    <div className="ml-auto hidden items-center sm:flex">
      {run === undefined ? (
        // Both the label and the status are data, so one bar stands in.
        <Skeleton className="h-4 w-28" />
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
            <span className="max-w-48 truncate font-medium text-sm">
              {run.label}
            </span>
            <Badge variant="outline">{t(`status.${run.status}`)}</Badge>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={2}
              className="size-4 text-muted-foreground"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Base UI group labels must sit inside a Group. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                {t("switcher.label")}
              </DropdownMenuLabel>
              {(runs ?? []).map((item) => {
                const isActive = item.slug === slug
                return (
                  <DropdownMenuItem
                    key={item.runId}
                    aria-current={isActive ? "true" : undefined}
                    render={
                      <Link href={`/pay-mappings/${item.slug}${subPath}`} />
                    }
                  >
                    <span className="truncate">{item.label}</span>
                    {isActive ? (
                      <HugeiconsIcon
                        icon={Tick02Icon}
                        strokeWidth={2}
                        className="ml-auto size-4"
                      />
                    ) : null}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/pay-mappings" />}>
              {t("switcher.all")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
