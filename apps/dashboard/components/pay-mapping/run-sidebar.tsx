"use client"

import {
  Analytics01Icon,
  CheckListIcon,
  File01Icon,
  GridViewIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
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
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useOrganization } from "@/components/org-context"
import { UpDownChevrons } from "@/components/updown-chevrons"
import { chapterSegment } from "./analysis-chapters"

// Sub-pages of one kartläggning (pay-mapping run). `sub` is what the URL's
// first sub-segment must equal for the row to read as current; `landing` is
// where the row actually goes when it differs. Analysis needs the split: the
// section has no page of its own (every route under it is a chapter), so
// linking at the bare segment would spend a round trip on the redirect that
// lives there.
const TABS = [
  { labelKey: "overview", sub: "", icon: GridViewIcon },
  {
    labelKey: "analysis",
    sub: "analysis",
    landing: `analysis/${chapterSegment("start")}`,
    icon: Analytics01Icon,
  },
  { labelKey: "actions", sub: "actions", icon: CheckListIcon },
  { labelKey: "report", sub: "report", icon: File01Icon },
] as const

// Resolves a run path's first sub-segment to its tab label key, the single
// source of truth for what the sub-pages are called (the run shell reuses it
// for the page title). Any deeper segments still belong to their tab; unknown
// segments fall back to the Overview index.
export function payMappingSubPageKey(sub: string | undefined) {
  return TABS.find((tab) => tab.sub === (sub ?? ""))?.labelKey ?? "overview"
}

// One run's inner sidebar: the run switcher (label
// + status, opening the org's other runs, each linking to the SAME sub-page
// in the chosen run), and the run's destinations. This is the run workspace's
// whole navigation, so the run pages carry only their breadcrumb above.
export function RunSidebar() {
  const t = useTranslations("dashboard.payMapping")
  const pathname = usePathname()
  const { orgId } = useOrganization()
  // /pay-mappings/<slug>[/<sub>...] -> ["pay-mappings", slug, sub?]
  const [, slug, sub] = pathname.split("/").filter(Boolean)
  const run = useQuery(
    api.payMapping.runs.getPayMappingRunBySlug,
    slug === undefined ? "skip" : { orgId, slug }
  )
  const runs = useQuery(
    api.payMapping.runs.listPayMappingRuns,
    slug === undefined ? "skip" : { orgId }
  )
  if (slug === undefined) return null
  // Swapping the run keeps the visitor on the same sub-page (comparing the
  // same view across years is the point of switching).
  const rest = pathname.split("/").filter(Boolean).slice(2)
  const subPath = rest.length > 0 ? `/${rest.join("/")}` : ""
  const currentSub = sub ?? ""

  return (
    <div className="flex flex-col py-1">
      {/* No back-to-list row: the rail's pay-mapping icon and the pages'
          own breadcrumbs already carry that way out, and a nav that repeats
          an exit is one row of noise above the run's real destinations. */}
      <div className="flex flex-col gap-0.5 px-2">
        {run === undefined ? (
          <div className="flex h-7 items-center px-2">
            <Skeleton className="h-4 w-32" />
          </div>
        ) : run === null ? null : (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  aria-label={t("switcher.label")}
                  className="w-full justify-start gap-1.5 font-medium"
                />
              }
            >
              <span className="min-w-0 truncate">{run.label}</span>
              <Badge variant="outline">{t(`status.${run.status}`)}</Badge>
              <UpDownChevrons className="ms-auto" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={4}>
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
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <Separator className="my-2" />
      <div className="flex flex-col gap-0.5 px-2">
        {TABS.map((tab) => {
          const target = "landing" in tab ? tab.landing : tab.sub
          const href =
            target === ""
              ? `/pay-mappings/${slug}`
              : `/pay-mappings/${slug}/${target}`
          const active = currentSub === tab.sub
          return (
            <Button
              key={tab.labelKey}
              variant="ghost"
              className={cn(
                "w-full justify-start gap-2.5",
                active
                  ? "bg-accent font-medium text-accent-foreground"
                  : "font-normal text-foreground"
              )}
              aria-current={active ? "page" : undefined}
              nativeButton={false}
              render={<Link href={href} />}
            >
              <span className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-3.5">
                <HugeiconsIcon
                  icon={tab.icon}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </span>
              <span className="truncate">{t(`tabs.${tab.labelKey}`)}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
