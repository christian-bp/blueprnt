"use client"

import {
  Briefcase01Icon,
  ChartColumnIcon,
  CheckmarkCircle02Icon,
  Layers01Icon,
  Tag01Icon,
  Tick02Icon,
  UserGroup03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { MethodStatusBadge } from "@/components/model/method-status-badge"
import type { Todo, TodoGroup, TodoGroupKey } from "@/lib/todo"

// One icon per group, echoing the same domain icon used elsewhere for the
// same concept (QuickActions/the sidebar): people import and classification
// share the people/tag icons, describe and evaluate share the role icon (the
// same role, two states of readiness), and the method's two review states
// each get their own icon.
const GROUP_ICONS: Record<TodoGroupKey, IconSvgElement> = {
  importPeople: UserGroup03Icon,
  classifyPeople: Tag01Icon,
  describeRoles: Briefcase01Icon,
  evaluateRoles: Briefcase01Icon,
  documentCriteria: Layers01Icon,
  approveCriteria: Tick02Icon,
  startPayMapping: ChartColumnIcon,
}

// A group's item rows are always capped at 3 here; the "view all" link is
// the escape hatch to the surface that holds the rest. importPeople and
// startPayMapping are always a single row (buildTodo never grows them), so
// they never need one.
const ROW_CAP = 3
const VIEW_ALL_HREF: Partial<Record<TodoGroupKey, string>> = {
  classifyPeople: "/people/classify",
  describeRoles: "/roles",
  evaluateRoles: "/roles",
  documentCriteria: "/model/method",
  approveCriteria: "/model/method",
}

// How many cards the loading skeleton shows. Sized to the typical "a couple
// of pending groups" case (two full cards, each with three item rows and a
// view-all row) so the section measures the same as the common loaded state
// and the widgets below do not shift. A group count that resolves to fewer or
// more groups still reflows by that difference, inherent to a variable-length
// list (CLAUDE.md: size an unpaginated skeleton to typical content).
const SKELETON_CARD_COUNT = 2

// The medallion's fixed brand square. The skeleton reuses only the square
// (no icon), because which icon belongs there is data-dependent (it is the
// loaded group's own domain icon), not static chrome.
const MEDALLION_CLASS =
  "flex size-8 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand dark:bg-brand/20 [&_svg]:size-4"

function GroupMedallion({ groupKey }: { groupKey: TodoGroupKey }) {
  return (
    <span aria-hidden="true" className={MEDALLION_CLASS}>
      <HugeiconsIcon icon={GROUP_ICONS[groupKey]} strokeWidth={2} />
    </span>
  )
}

const ROW_CLASS =
  "flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
const META_CLASS = "shrink-0 text-muted-foreground text-xs"

function ItemRows({ group }: { group: TodoGroup }) {
  const t = useTranslations("dashboard.overview")
  const tStatus = useTranslations("dashboard.model.method.status")
  const tClassify = useTranslations("dashboard.classify")

  switch (group.key) {
    case "classifyPeople":
      return (
        <>
          {group.items.slice(0, ROW_CAP).map((item) => (
            <Link key={item.id} href={item.href} className={ROW_CLASS}>
              <span className="min-w-0 truncate">
                {item.title ?? tClassify("noTitle")}
              </span>
              <span className={META_CLASS}>
                {t("todo.classifyPeopleCount", { count: item.peopleCount })}
              </span>
            </Link>
          ))}
        </>
      )
    case "describeRoles":
      return (
        <>
          {group.items.slice(0, ROW_CAP).map((item) => (
            <Link key={item.id} href={item.href} className={ROW_CLASS}>
              <span className="min-w-0 truncate">{item.title}</span>
              {item.family !== undefined && (
                <span className={META_CLASS}>{item.family}</span>
              )}
            </Link>
          ))}
        </>
      )
    case "evaluateRoles":
      return (
        <>
          {group.items.slice(0, ROW_CAP).map((item) => (
            <Link key={item.id} href={item.href} className={ROW_CLASS}>
              <span className="min-w-0 truncate">{item.title}</span>
              <span className={META_CLASS}>
                {t("todo.evaluateProgress", {
                  rated: item.ratedCount,
                  total: item.totalCriteria,
                })}
              </span>
            </Link>
          ))}
        </>
      )
    case "documentCriteria":
    case "approveCriteria":
      return (
        <>
          {group.items.slice(0, ROW_CAP).map((item) => (
            <Link key={item.id} href={item.href} className={ROW_CLASS}>
              <span className="min-w-0 truncate">{item.title}</span>
              <MethodStatusBadge
                status={item.status}
                label={tStatus(item.status)}
              />
            </Link>
          ))}
        </>
      )
    case "importPeople":
      return (
        <>
          {group.items.map((item) => (
            <Link key={item.id} href={item.href} className={ROW_CLASS}>
              <span className="min-w-0 truncate">
                {t("todo.importPeopleItem")}
              </span>
            </Link>
          ))}
        </>
      )
    case "startPayMapping":
      return (
        <>
          {group.items.map((item) => (
            <Link key={item.id} href={item.href} className={ROW_CLASS}>
              <span className="min-w-0 truncate">
                {t("todo.startPayMappingItem")}
              </span>
            </Link>
          ))}
        </>
      )
    default:
      return null
  }
}

function ViewAllLink({ group }: { group: TodoGroup }) {
  const t = useTranslations("dashboard.overview")
  const href = VIEW_ALL_HREF[group.key]
  if (href === undefined || group.count <= ROW_CAP) return null
  return (
    <Link
      href={href}
      className="px-2 py-1.5 text-muted-foreground text-xs underline-offset-4 hover:underline"
    >
      {t("viewAll", { count: group.count })}
    </Link>
  )
}

function GroupCard({ group }: { group: TodoGroup }) {
  const t = useTranslations("dashboard.overview")
  return (
    // Plain card chrome: the brand accent lives on the medallion (below)
    // rather than the card border/background, so it reads once per card
    // instead of compounding into a heavy wash down the whole list.
    <div className="rounded-xl border p-3">
      <div className="flex items-center gap-3">
        <GroupMedallion groupKey={group.key} />
        <span className="min-w-0 flex-1 truncate font-medium text-sm">
          {t(`todo.groups.${group.key}`)}
        </span>
        <span className="shrink-0 text-brand text-sm tabular-nums">
          {t("todo.groupCount", { count: group.count })}
        </span>
      </div>
      <div className="mt-1 flex flex-col">
        <ItemRows group={group} />
        <ViewAllLink group={group} />
      </div>
    </div>
  )
}

function TodoListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: SKELETON_CARD_COUNT }, (_, card) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder, order is stable
        <div key={card} className="rounded-xl border p-3">
          <div className="flex items-center gap-3">
            {/* Only the fixed brand square; the icon is data-dependent, so
                the skeleton leaves it empty until the real group loads. Same
                size-8 as the loaded medallion, so the header height matches. */}
            <span aria-hidden="true" className={MEDALLION_CLASS} />
            {/* Line boxes matching the loaded header's text-sm title (h-5,
                flex-1) and count (h-5, shrink-0), so swapping in the real
                content later does not change the row's height. */}
            <span className="flex h-5 min-w-0 flex-1 items-center">
              <Skeleton className="h-4 w-40" />
            </span>
            <span className="flex h-5 shrink-0 items-center">
              <Skeleton className="h-4 w-6" />
            </span>
          </div>
          {/* Mirrors GroupCard's item-rows wrapper exactly (mt-1 flex
              flex-col, no inter-row gap: the row's own py-1.5 padding is the
              only spacing) so the skeleton measures identical to the loaded
              rows. Each row reuses ROW_CLASS (only overriding the hover
              highlight, since these rows are not links) with the leaf
              content swapped for bars, each centered in an h-5 line box to
              match the loaded row's text-sm title / text-xs-or-Badge meta. */}
          <div className="mt-1 flex flex-col">
            {[0, 1, 2].map((row) => (
              <div key={row} className={cn(ROW_CLASS, "hover:bg-transparent")}>
                <span className="flex h-5 min-w-0 flex-1 items-center">
                  <Skeleton className="h-4 w-32" />
                </span>
                <span className="flex h-5 shrink-0 items-center">
                  <Skeleton className="h-4 w-10" />
                </span>
              </div>
            ))}
            {/* Matches the loaded ViewAllLink row (px-2 py-1.5 text-xs, a 16px
                line in 12px padding = 28px), which most groups with more than
                ROW_CAP items render, so a card that has a view-all link does
                not grow past the skeleton. */}
            <div className="flex px-2 py-1.5">
              <span className="flex h-4 items-center">
                <Skeleton className="h-3 w-20" />
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// The front page's "always-open" to-do: one card per non-empty buildTodo
// group (no accordion; the whole thing is always visible), each holding up
// to 3 item rows plus a "view all N" link to the owning surface when the
// group holds more. total===0 renders the all-caught-up line instead;
// undefined (still loading) renders a content-shaped skeleton.
export function TodoList({ todo }: { todo: Todo | undefined }) {
  const t = useTranslations("dashboard.overview")

  if (todo === undefined) return <TodoListSkeleton />

  if (todo.total === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border px-4 py-4">
        <HugeiconsIcon
          icon={CheckmarkCircle02Icon}
          strokeWidth={2}
          aria-hidden="true"
          className="size-5 shrink-0 text-brand"
        />
        <div>
          <p className="font-medium text-sm">{t("todo.empty.title")}</p>
          <p className="text-muted-foreground text-sm">
            {t("todo.empty.body")}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {todo.groups.map((group) => (
        <GroupCard key={group.key} group={group} />
      ))}
    </div>
  )
}
