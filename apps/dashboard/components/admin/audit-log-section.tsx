"use client"

import { Audit02Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { usePaginatedQuery, useQuery } from "convex/react"
import { useFormatter, useTranslations } from "next-intl"
import { type ReactNode, useMemo, useState } from "react"
import type { DateRange } from "react-day-picker"
import { TablePagination } from "@/components/table-pagination"
import {
  ChangeEntryRow,
  KV_GRID,
  StatList,
} from "@/components/audit/change-entry-row"
import { DateRangePicker } from "@/components/date-range-picker"
import { PageHeading } from "@/components/page-heading"
import { TableSkeleton } from "@/components/table-skeleton"
import { useAuditPagination } from "@/hooks/use-audit-pagination"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { endOfDay, startOfDay } from "@/lib/date-bounds"
import {
  changeEntries,
  formatChanges,
  formatStats,
  orderEntries,
  payloadChanges,
  payloadStats,
  sectionKind,
} from "@/lib/audit-detail"

// The four filterable platform categories. Kept as local literals rather than
// importing the backend constant so we do not pull backend internals into the
// bundle; the query ignores any value outside this set (no filter), so "all"
// maps to undefined below.
const CATEGORIES = ["user", "organization", "membership", "admin"] as const
type Category = (typeof CATEGORIES)[number]

// Shared by the pager and the loading skeleton so the skeleton always shows a
// full page of rows.
const PAGE_SIZE = 25

// A single enriched platform-audit row, as returned by both the browse and
// search queries. targetUser/targetOrg are resolved display labels (or null);
// payloads carry ids and codes only, never PII.
type AuditRow = {
  id: string
  at: number
  actorId: string
  actorName: string
  type: string
  category?: string
  targetUser: string | null
  targetUserMissing: boolean
  targetOrg: string | null
  targetOrgMissing: boolean
  payload: unknown
}

// Compose the human-readable target from the resolved user/org labels: user,
// org, "user @ org" when both, or "" when neither. A target that was deleted
// (resolved to null but its id was present) shows the localized "deleted" label,
// never a raw id.
function composeTarget(
  row: Pick<
    AuditRow,
    "targetUser" | "targetUserMissing" | "targetOrg" | "targetOrgMissing"
  >,
  deletedUser: string,
  deletedOrg: string
): string {
  const user = row.targetUser ?? (row.targetUserMissing ? deletedUser : null)
  const org = row.targetOrg ?? (row.targetOrgMissing ? deletedOrg : null)
  if (user !== null && org !== null) return `${user} @ ${org}`
  return user ?? org ?? ""
}

export function AuditLogSection() {
  const t = useTranslations("dashboard.admin.auditLog")
  // Change-field labels reuse the org namespace: the same domain fields appear
  // in platform payload diffs (e.g. platform.orgUpdated changes).
  const tFields = useTranslations("dashboard.auditLog")
  const format = useFormatter()

  // Toolbar state. The visible input is immediate; the debounced value drives
  // the search query so we do not fire on every keystroke.
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">(
    "all"
  )
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const debouncedSearch = useDebouncedValue(search, 300)

  // The earliest admin audit row's time (the page is already platform-admin
  // gated), used to default the picker to the full span. The full default range
  // is memoized on the earliest value; `new Date()` is "today" at memo time,
  // which is what we want for the open-ended upper bound (no effect, no flash).
  const bounds = useQuery(api.platform.admin.auditLogBounds, {})
  // Until bounds resolve we fall back to today so the trigger always shows a
  // date (never a loader); the query bounds stay open until then (startArg/
  // endArg) so no rows hide.
  const defaultRange = useMemo<DateRange>(
    () => ({
      from: bounds?.earliest != null ? new Date(bounds.earliest) : new Date(),
      to: new Date(),
    }),
    [bounds?.earliest]
  )

  // Row whose detail sheet is open, or null when the sheet is closed.
  const [selectedRow, setSelectedRow] = useState<AuditRow | null>(null)

  // The effective range: the user's pick when set, otherwise the full default
  // span. The picker's Clear calls onChange(undefined), which falls back here
  // to the default span again.
  const range = dateRange ?? defaultRange

  const isSearching = debouncedSearch.trim().length > 0
  const categoryArg = selectedCategory === "all" ? undefined : selectedCategory
  // Inclusive epoch-ms bounds, held open until the earliest is known so the
  // brief today-only default does not filter the data; a picked "from" without
  // a "to" stays open-ended.
  const startArg =
    bounds !== undefined && range.from ? startOfDay(range.from) : undefined
  const endArg =
    bounds !== undefined && range.to ? endOfDay(range.to) : undefined

  // Only one query is ever active at a time (browse XOR search). The page is
  // already platform-admin gated, so there is no extra role gate here.
  const browse = usePaginatedQuery(
    api.platform.admin.listAuditLog,
    !isSearching
      ? { category: categoryArg, start: startArg, end: endArg }
      : "skip",
    // Load up to 9 pages (25 each) up front so their numbers are real and
    // jumpable in the pager; beyond that the pager collapses to an ellipsis and
    // Next loads more.
    { initialNumItems: 225 }
  )
  const searchResult = useQuery(
    api.platform.admin.searchAuditLog,
    isSearching
      ? {
          search: debouncedSearch,
          category: categoryArg,
          start: startArg,
          end: endArg,
        }
      : "skip"
  )

  const rows: AuditRow[] = isSearching
    ? (searchResult?.rows ?? [])
    : browse.results

  const pager = useAuditPagination({
    rows,
    pageSize: PAGE_SIZE,
    canLoadMore: !isSearching && browse.status === "CanLoadMore",
    isLoadingMore: !isSearching && browse.status === "LoadingMore",
    loadMore: browse.loadMore,
    resetKey: `${selectedCategory}|${isSearching}|${debouncedSearch}|${startArg ?? ""}|${endArg ?? ""}`,
  })

  // Translate an event type to its label, falling back to the raw type when no
  // key exists (a future event added before its string). t.has guards the
  // lookup so a missing key never logs an error or renders the raw key path.
  function actionLabel(type: string): string {
    const key = `events.${type.replace("platform.", "")}` as Parameters<
      typeof t.has
    >[0]
    return t.has(key) ? t(key) : type
  }

  // Out-of-band rows (e.g. the CLI bootstrap path) carry a "system:cli"
  // sentinel actorId rather than a real operator; show a localized System label.
  function operatorLabel(actorId: string, actorName: string): string {
    return actorId.startsWith("system") ? t("systemActor") : actorName
  }

  function categoryLabel(category: string): string {
    const key = `categories.${category}` as Parameters<typeof t.has>[0]
    return t.has(key) ? t(key) : category
  }

  // Resolve a change field name to its localized label, falling back to the raw
  // field name when no key exists.
  function fieldLabel(field: string): string {
    const key = `fields.${field}` as Parameters<typeof tFields.has>[0]
    return tFields.has(key) ? tFields(key) : field
  }

  // Localizes a boolean field value to Yes/No (shared auditLog namespace), so a
  // diff row reads "... : No -> Yes" rather than the raw "false -> true".
  function boolLabel(value: boolean): string {
    return tFields(value ? "values.yes" : "values.no")
  }

  // The short one-line summary for the table cell: structured before->after
  // diffs (e.g. platform.orgUpdated, membershipRoleChanged) render via
  // formatChanges; a flat payload (platform.userDeleted, membershipGranted)
  // renders as labeled stats, never a raw payload key.
  function detail(payload: unknown): ReactNode {
    const changes = payloadChanges(payload)
    return changes
      ? formatChanges(changes, fieldLabel, undefined, boolLabel)
      : formatStats(payload, fieldLabel)
  }

  // First-data loading for whichever query is active shows a skeleton table; the
  // toolbar still mounts so it does not flash in.
  const loadingFirst = isSearching
    ? searchResult === undefined
    : browse.status === "LoadingFirstPage"

  // Shared header for the data and skeleton tables (same columns, no reflow).
  const auditTableHeader = (
    <TableHeader>
      <TableRow>
        <TableHead className="w-44">{t("table.when")}</TableHead>
        <TableHead className="w-40">{t("table.operator")}</TableHead>
        <TableHead className="w-32">{t("table.category")}</TableHead>
        <TableHead className="w-44">{t("table.action")}</TableHead>
        <TableHead className="w-40">{t("table.target")}</TableHead>
        <TableHead>{t("table.details")}</TableHead>
      </TableRow>
    </TableHeader>
  )

  return (
    <section className="space-y-4">
      <div>
        <PageHeading>{t("heading")}</PageHeading>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>

      {/* Toolbar: search on the left, category filter dropdown to its right. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            size={16}
            strokeWidth={2}
            aria-hidden="true"
            className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={search}
            placeholder={t("search.placeholder")}
            aria-label={t("search.placeholder")}
            onChange={(event) => setSearch(event.target.value)}
            className="w-64 pl-8"
          />
        </div>
        <Select
          items={{
            all: t("categories.all"),
            ...Object.fromEntries(
              CATEGORIES.map((category) => [category, categoryLabel(category)])
            ),
          }}
          value={selectedCategory}
          onValueChange={(value) =>
            setSelectedCategory(value as Category | "all")
          }
        >
          <SelectTrigger className="w-44" aria-label={t("categoryFilterLabel")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("categories.all")}</SelectItem>
            {CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {categoryLabel(category)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DateRangePicker
          value={range}
          onChange={setDateRange}
          placeholder={t("dateRange.placeholder")}
          clearLabel={t("dateRange.clear")}
          todayLabel={t("dateRange.today")}
          ariaLabel={t("dateRange.label")}
        />
      </div>

      {loadingFirst ? (
        <Table className="table-fixed">
          {auditTableHeader}
          <TableSkeleton
            rows={PAGE_SIZE}
            columns={[
              { className: "w-28" },
              { className: "w-24" },
              { className: "h-5 w-16 rounded-full" },
              { className: "w-28" },
              { className: "w-28" },
              {},
            ]}
          />
        </Table>
      ) : rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            {!isSearching && (
              <EmptyMedia variant="icon">
                <HugeiconsIcon
                  icon={Audit02Icon}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </EmptyMedia>
            )}
            <EmptyTitle>{t("heading")}</EmptyTitle>
            <EmptyDescription>
              {isSearching ? t("search.empty") : t("empty")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table className="table-fixed">
          {auditTableHeader}
          <TableBody>
            {pager.pageRows.map((row) => (
              <TableRow
                key={row.id}
                role="button"
                tabIndex={0}
                aria-label={t("detail.viewDetails")}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setSelectedRow(row)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    setSelectedRow(row)
                  }
                }}
              >
                <TableCell className="truncate text-muted-foreground">
                  {format.dateTime(new Date(row.at), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </TableCell>
                <TableCell className="truncate font-medium">
                  {operatorLabel(row.actorId, row.actorName)}
                </TableCell>
                <TableCell>
                  {row.category ? (
                    <Badge variant="secondary">
                      {categoryLabel(row.category)}
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="truncate">
                  {actionLabel(row.type)}
                </TableCell>
                <TableCell className="truncate text-muted-foreground">
                  {composeTarget(row, t("deletedUser"), t("deletedOrg"))}
                </TableCell>
                <TableCell className="truncate text-muted-foreground">
                  {detail(row.payload)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Pagination slot: stable container so toggling browse/search does not
          reflow the table. Previous/Next page control plus a truncation note
          while searching (search is capped, not paginated). */}
      <div className="flex flex-col items-center gap-1.5">
        {rows.length > 0 ? (
          <TablePagination
            page={pager.page}
            pageCount={pager.pageCount}
            hasMore={pager.hasMore}
            canPrev={pager.canPrev}
            canNext={pager.canNext}
            onPrev={pager.goPrev}
            onNext={pager.goNext}
            onSelect={pager.goTo}
            previousLabel={t("previous")}
            nextLabel={t("next")}
          />
        ) : null}
        {isSearching && rows.length === 50 ? (
          <p className="text-muted-foreground text-sm">
            {t("search.capped", { count: 50 })}
          </p>
        ) : null}
      </div>

      <Sheet
        open={selectedRow !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedRow(null)
        }}
      >
        <SheetContent side="right" className="gap-0">
          {selectedRow ? (
            <AuditDetailSheet
              row={selectedRow}
              t={t}
              format={format}
              operatorLabel={operatorLabel}
              actionLabel={actionLabel}
              categoryLabel={categoryLabel}
              fieldLabel={fieldLabel}
              boolLabel={boolLabel}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  )
}

// The full-detail sheet body. Split out so its hooks-free render only mounts
// when a row is selected; all helpers are passed in from the section. Platform
// payloads carry no items/moves/suggestions/provenance, so this is simpler than
// the org sheet: a KV meta block, the framed change record (or a flat payload
// scalar list), and the raw event type in the footer.
function AuditDetailSheet({
  row,
  t,
  format,
  operatorLabel,
  actionLabel,
  categoryLabel,
  fieldLabel,
  boolLabel,
}: {
  row: AuditRow
  t: ReturnType<typeof useTranslations<"dashboard.admin.auditLog">>
  format: ReturnType<typeof useFormatter>
  operatorLabel: (actorId: string, actorName: string) => string
  actionLabel: (type: string) => string
  categoryLabel: (category: string) => string
  fieldLabel: (field: string) => string
  boolLabel: (value: boolean) => string
}) {
  const target = composeTarget(row, t("deletedUser"), t("deletedOrg"))
  const dateLong = format.dateTime(new Date(row.at), {
    dateStyle: "long",
    timeStyle: "short",
  })

  // Structured before->after field changes, identity-ordered. When the payload
  // carries no `changes` map, we fall back to its remaining scalars below.
  const changes = payloadChanges(row.payload)
  const entries = changes
    ? orderEntries(changeEntries(changes, fieldLabel, undefined, boolLabel))
    : []
  const kind = sectionKind(row.type, entries)
  const sectionHeading =
    kind === "create"
      ? t("detail.detailsHeading")
      : kind === "remove"
        ? t("detail.removedHeading")
        : t("detail.changes")

  // No `changes`: surface the payload's own scalar fields as a labeled flat
  // record (a count/code per row). `changes`, ids, and `source` are excluded by
  // payloadStats; ordering is stable via FIELD_DISPLAY_ORDER.
  const stats = entries.length > 0 ? [] : payloadStats(row.payload)

  return (
    <>
      <SheetHeader className="gap-1.5">
        {/* pr-8 keeps a long title clear of the sheet's absolute close button. */}
        <SheetTitle className="text-balance pr-8">
          {actionLabel(row.type)}
        </SheetTitle>
        <SheetDescription className="text-balance">
          {target || dateLong}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-4">
        {/* Meta, as key/value rows: operator, when, category, target. */}
        <dl className={KV_GRID}>
          <dt className="text-muted-foreground">{t("detail.operator")}</dt>
          <dd className="min-w-0 break-words">
            {operatorLabel(row.actorId, row.actorName)}
          </dd>
          <dt className="text-muted-foreground">{t("detail.when")}</dt>
          <dd className="min-w-0 break-words">{dateLong}</dd>
          {row.category ? (
            <>
              <dt className="text-muted-foreground">{t("detail.category")}</dt>
              <dd className="min-w-0">
                <Badge variant="secondary">{categoryLabel(row.category)}</Badge>
              </dd>
            </>
          ) : null}
          {target ? (
            <>
              <dt className="text-muted-foreground">{t("detail.target")}</dt>
              <dd className="min-w-0 break-words">{target}</dd>
            </>
          ) : null}
        </dl>

        {entries.length > 0 ? (
          <section className="space-y-2">
            <h3 className="font-medium text-sm">{sectionHeading}</h3>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border">
              {entries.map((entry) => (
                <ChangeEntryRow
                  key={entry.field}
                  entry={entry}
                  emptyLabel={t("detail.emptyValue")}
                />
              ))}
            </ul>
          </section>
        ) : stats.length > 0 ? (
          <section className="space-y-2">
            <h3 className="font-medium text-sm">
              {t("detail.detailsHeading")}
            </h3>
            <StatList stats={stats} fieldLabel={fieldLabel} />
          </section>
        ) : (
          <p className="text-muted-foreground text-sm">
            {t("detail.noChanges")}
          </p>
        )}

        {/* Footer meta: the raw event key, for traceability. */}
        <div className="border-border border-t pt-3 text-muted-foreground text-xs">
          <p className="font-mono">{row.type}</p>
        </div>
      </div>

      <SheetFooter>
        <SheetClose render={<Button variant="outline" />}>
          {t("detail.close")}
        </SheetClose>
      </SheetFooter>
    </>
  )
}
