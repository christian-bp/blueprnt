// apps/dashboard/components/overview/todo-group.tsx
import { MethodStatusBadge } from "@/components/model/method-status-badge"
import type { TodoGroup } from "@/lib/todo"
import { useTranslations } from "next-intl"
import Link from "next/link"

// Renders the items of one to-do group inside its accordion panel: up to
// MAX_ITEMS rows, then a "View all N" link to the owning section when the group
// holds more. Each row is a full-width link to where the work happens. The row
// content switches on the group kind (role progress, family, or criterion
// status badge) so no impossible field combinations exist.
export function TodoGroupItems({ group }: { group: TodoGroup }) {
  const t = useTranslations("dashboard.overview.todo")
  const tStatus = useTranslations("dashboard.model.method.status")
  const tClassify = useTranslations("dashboard.classify")

  const rowClass =
    "flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-muted"

  return (
    <div className="flex flex-col gap-1">
      {group.key === "classifyPeople" &&
        group.items.map((item) => (
          <Link key={item.id} href={item.href} className={rowClass}>
            <span className="min-w-0 truncate">
              {item.title ?? tClassify("noTitle")}
            </span>
            <span className="shrink-0 text-muted-foreground text-sm tabular-nums">
              {t("classifyPeopleCount", { count: item.peopleCount })}
            </span>
          </Link>
        ))}

      {group.key === "describeRoles" &&
        group.items.map((item) => (
          <Link key={item.id} href={item.href} className={rowClass}>
            <span className="min-w-0 truncate">{item.title}</span>
            {item.family && (
              <span className="shrink-0 text-muted-foreground text-sm">
                {item.family}
              </span>
            )}
          </Link>
        ))}

      {group.key === "evaluateRoles" &&
        group.items.map((item) => (
          <Link key={item.id} href={item.href} className={rowClass}>
            <span className="min-w-0 truncate">{item.title}</span>
            <span className="shrink-0 text-muted-foreground text-sm tabular-nums">
              {t("evaluateProgress", {
                rated: item.ratedCount,
                total: item.totalCriteria,
              })}
            </span>
          </Link>
        ))}

      {(group.key === "documentCriteria" || group.key === "approveCriteria") &&
        group.items.map((item) => (
          <Link key={item.id} href={item.href} className={rowClass}>
            <span className="min-w-0 truncate">{item.title}</span>
            <MethodStatusBadge
              status={item.status}
              label={tStatus(item.status)}
            />
          </Link>
        ))}

      {group.count > group.items.length && (
        <Link
          href={
            group.key === "classifyPeople"
              ? "/people/classify"
              : group.key === "describeRoles" || group.key === "evaluateRoles"
                ? "/roles"
                : "/model/method"
          }
          className="px-2 py-2 text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          {t("viewAll", { count: group.count })}
        </Link>
      )}
    </div>
  )
}
