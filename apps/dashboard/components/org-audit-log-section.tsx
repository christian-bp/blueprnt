"use client"

import { Medallion } from "@/components/medallion"
import { ArrowDown01Icon, Audit02Icon } from "@hugeicons/core-free-icons"
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
import { AUDIT_LOG_PAGE_SIZE } from "@workspace/constants"
import { cn } from "@workspace/ui/lib/utils"
import { useQuery } from "convex/react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react"
import type { DateRange } from "react-day-picker"
import { TableSearchField } from "@/components/table-search-field"
import { auditStories } from "@/lib/audit-stories"
import { FrameTable, FrameTableFooter } from "@/components/frame-table"
import { TablePagination } from "@/components/table-pagination"
import {
  ChangeEntryRow,
  KV_GRID,
  StatList,
} from "@/components/audit/change-entry-row"
import { ChangeArrow } from "@/components/change-arrow"
import { DateRangePicker } from "@/components/date-range-picker"
import { useOrganization } from "@/components/org-context"
import { PageBreadcrumbRow } from "@/components/page-breadcrumb-row"
import { TableSkeleton } from "@/components/table-skeleton"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { endOfDay, startOfDay } from "@/lib/date-bounds"
import {
  AI_KIND_KEY,
  AUDIT_FILTER_CATEGORIES,
  resolveCodedValue,
  resolveCriteriaLibraryValue,
} from "@/lib/audit-constants"
import {
  auditPageView,
  type BrowseCache,
  nextBrowseCache,
} from "@/lib/audit-page-view"
import {
  aiAuditDetail,
  auditContextParts,
  changeEntries,
  formatAuditDetail,
  isSuggestionKind,
  orderEntries,
  payloadChanges,
  payloadItems,
  payloadMoves,
  payloadProvenance,
  payloadStats,
  payloadSuggestions,
  sectionKind,
} from "@/lib/audit-detail"

// The filterable categories (drift-guarded against the backend's
// AUDIT_CATEGORIES; see the constant's note in lib/audit-constants.ts). The
// query ignores any value outside this set (no filter), so "all" maps to
// undefined below.
const CATEGORIES = AUDIT_FILTER_CATEGORIES
type Category = (typeof CATEGORIES)[number]

// Shared with the backend page query, the pager, and the loading skeleton
// (one constant, so the three can never drift apart).
const PAGE_SIZE = AUDIT_LOG_PAGE_SIZE

// A single enriched audit row, as returned by both the browse and search
// queries. `names` is a per-row id -> display-name map for that row's payload.
type AuditRow = {
  id: string
  at: number
  actorId: string
  actorName: string
  type: string
  category?: string
  // Set only on a row written as part of a multi-mutation gesture; the log
  // folds consecutive rows sharing one into a single story (lib/audit-stories).
  batchId?: string
  payload: unknown
  names: Record<string, string>
}

// Derive the i18n key from an event type value by camelCasing across dots, so
// "organization.created" -> "organizationCreated", "ai.suggestionConfirmed" ->
// "aiSuggestionConfirmed". The keys under dashboard.auditLog.events mirror this.
function eventKey(type: string): string {
  return type
    .split(".")
    .map((part, index) =>
      index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join("")
}

export function OrgAuditLogSection() {
  const t = useTranslations("dashboard.auditLog")
  // Scoped at the `dashboard` root (not `dashboard.auditLog`) so valueLabel
  // below can reuse existing domain copy for a coded audit VALUE (a
  // pay-mapping scope, praxis finding, praxis area, or pay-gap reason) from
  // dashboard.payMapping.*, rather than inventing new audit-only wording for
  // a concept that already has a real label elsewhere.
  const tDashboard = useTranslations("dashboard")
  const format = useFormatter()
  const locale = useLocale()
  const { orgId, role } = useOrganization()

  // Toolbar state. The visible input is immediate; the debounced value drives
  // the search query so we do not fire on every keystroke.
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">(
    "all"
  )
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const debouncedSearch = useDebouncedValue(search, 300)

  // Row whose detail sheet is open, or null when the sheet is closed.
  const [selectedRow, setSelectedRow] = useState<AuditRow | null>(null)
  // Which stories are open, by their lead row's id. Kept as a set rather than
  // a single id because a page can hold several gestures and closing one to
  // read another would lose the reader's place.
  const [openStories, setOpenStories] = useState<ReadonlySet<string>>(
    () => new Set()
  )

  const isSearching = debouncedSearch.trim().length > 0
  const categoryArg = selectedCategory === "all" ? undefined : selectedCategory
  // Inclusive epoch-ms bounds. No picked range means no date filter at all
  // (the trigger shows its placeholder), and Clear returns to that state; a
  // picked "from" without a "to" stays open-ended.
  const startArg = dateRange?.from ? startOfDay(dateRange.from) : undefined
  const endArg = dateRange?.to ? endOfDay(dateRange.to) : undefined

  // The current 0-based page, reset whenever any filter changes (a page
  // number only means something within one filter combination).
  const [page, setPage] = useState(0)
  // orgId is part of the key so an org switch can never show the previous
  // org's rows, not even for the one render the next page takes to load.
  const filterKey = `${orgId}|${selectedCategory}|${isSearching}|${debouncedSearch}|${startArg ?? ""}|${endArg ?? ""}`
  // biome-ignore lint/correctness/useExhaustiveDependencies: filterKey is the reset signal, not a read dependency
  useEffect(() => {
    setPage(0)
  }, [filterKey])

  // Editors never call either query: the adminQuery would reject them. The
  // cosmetic guard keeps the page graceful (the sidebar item is hidden for them
  // anyway). Only one query is ever active at a time (browse XOR search).
  // Browsing fetches ONE page by number: the audit aggregates give the server
  // the exact total and an O(log n) jump to any page, so the pager shows a
  // real last page and jumping to it costs one query, not a load-more chain.
  const browseResult = useQuery(
    api.accounts.audit.getAuditLogPage,
    role === "admin" && !isSearching
      ? { orgId, category: categoryArg, start: startArg, end: endArg, page }
      : "skip"
  )
  // Keep the previous page's rows on screen while the next page loads (no
  // skeleton flash on a page flip); the eager invalidation rules live in the
  // pure nextBrowseCache (lib/audit-page-view.ts).
  const lastBrowse = useRef<BrowseCache<NonNullable<typeof browseResult>>>(null)
  lastBrowse.current = nextBrowseCache(lastBrowse.current, {
    filterKey,
    isSearching,
    result: browseResult,
  })
  const browse = browseResult ?? lastBrowse.current?.value

  // Self-heal a page past the end: unreachable in normal use (the trail is
  // append-only and filter changes reset the page), but any table/aggregate
  // divergence would otherwise strand the user on an empty page with the
  // pager hidden.
  useEffect(() => {
    if (
      browseResult !== undefined &&
      browseResult.rows.length === 0 &&
      browseResult.total > 0 &&
      page > 0
    ) {
      setPage(Math.max(0, Math.ceil(browseResult.total / PAGE_SIZE) - 1))
    }
  }, [browseResult, page])

  const searchResult = useQuery(
    api.accounts.audit.searchAuditLog,
    role === "admin" && isSearching
      ? {
          orgId,
          search: debouncedSearch,
          category: categoryArg,
          start: startArg,
          end: endArg,
        }
      : "skip"
  )

  // Search results are capped at 50 and arrive whole; they page client-side
  // with the same page state. Browse rows arrive one page at a time. The
  // shared derivation (totals, clamped page, page rows) is the pure
  // auditPageView (lib/audit-page-view.ts).
  const searchRows: AuditRow[] = searchResult?.rows ?? []
  const view = auditPageView({
    isSearching,
    searchRows,
    browse,
    page,
    pageSize: PAGE_SIZE,
  })

  // Grouping is a render fold over the page already fetched, never a query,
  // and it is OFF while searching: search shows the rows that MATCHED, and
  // folding a hit into a story would either hide it inside a collapsed summary
  // or imply that its unmatched siblings matched too.
  const stories = auditStories(view.pageRows, { grouped: !isSearching })

  // Translate an event type to its label, falling back to the raw type when no
  // key exists (a future event added before its string). t.has guards the
  // lookup so a missing key never logs an error or renders the raw key path.
  function actionLabel(type: string): string {
    const key = `events.${eventKey(type)}` as Parameters<typeof t.has>[0]
    return t.has(key) ? t(key) : type
  }

  // The "who" column: seeded/system-generated rows carry a "system" sentinel
  // actorId (and an "unknown" snapshotted name); show a localized System label
  // for them, the real name when we have one, and Unknown otherwise.
  function actorLabel(actorId: string, actorName: string): string {
    if (actorId === "system" || actorId.startsWith("system")) {
      return t("who.system")
    }
    return actorName && actorName !== "unknown" ? actorName : t("who.unknown")
  }

  // Resolve a payload field name to its localized label, falling back to the
  // raw field key when no string exists. Shared by the table summary and the
  // sheet's per-field list.
  function fieldLabel(field: string): string {
    const key = `fields.${field}` as Parameters<typeof t.has>[0]
    return t.has(key) ? t(key) : field
  }

  // Localizes a boolean field value to Yes/No, so a change/diff row reads
  // "Manager: No -> Yes" rather than the raw "false -> true".
  function boolLabel(value: boolean): string {
    return t(value ? "values.yes" : "values.no")
  }

  // Localizes a coded field value (a pay-mapping scope, praxis finding,
  // praxis area key, or pay-gap reason) so it never renders as its raw wire
  // code (e.g. "praxis", "found", "payPolicy", "experience"). Returns
  // undefined (NOT the raw value) when the field carries no coded domain or
  // the resolved key has no string in the active locale: formatChanges/
  // changeEntries treat undefined as "try the next resolver" (resolveName,
  // then the raw fallback), so falling back to the raw value here would wrongly
  // short-circuit that chain for every non-coded field, including id fields
  // resolveName exists to handle (e.g. familyId).
  function valueLabel(field: string, value: string): string | undefined {
    return (
      resolveCriteriaLibraryValue(field, value, locale) ??
      resolveCodedValue(field, value, (key) =>
        tDashboard.has(key as Parameters<typeof tDashboard.has>[0])
          ? tDashboard(key as Parameters<typeof tDashboard>[0])
          : undefined
      )
    )
  }

  // Formats an AUDIT_DATE_FIELDS epoch-ms payload value (archivedAt,
  // reviewedAt, expiresAt, ...) as a localized date, shared by the table
  // summary, the sheet's change list, and the context line's invitation
  // expiry, so a timestamp never renders as raw milliseconds.
  function dateLabel(epochMs: number): string {
    return format.dateTime(new Date(epochMs), { dateStyle: "medium" })
  }

  // The short one-line summary: AI suggestion events render from their own
  // payload (counts), everything else through the shared structured-change
  // formatter. names is per row (each row carries only the ids it references).
  function detailText(
    type: string,
    payload: unknown,
    names: Record<string, string>
  ): ReactNode {
    if (type === "ai.suggestionConfirmed" || type === "ai.suggestionRejected") {
      // aiAuditDetail builds key paths at runtime (ai.<kind>); widen t to a
      // plain (key, params) signature so the runtime keys are accepted.
      return aiAuditDetail(type, payload, (key, params) =>
        t(key as Parameters<typeof t>[0], params)
      )
    }
    return formatAuditDetail(
      type,
      payload,
      names,
      {
        deletedRole: t("details.deletedRole"),
        deletedFamily: t("details.deletedFamily"),
        deletedUser: t("details.deletedUser"),
        itemsChanged: (count) => t("details.itemsChanged", { count }),
        fieldsChanged: (count) => t("details.fieldsChanged", { count }),
        createdMarker: t("detail.createdMarker"),
      },
      fieldLabel,
      boolLabel,
      valueLabel,
      dateLabel
    )
  }

  function categoryLabel(category: string): string {
    const key = `categories.${category}` as Parameters<typeof t.has>[0]
    return t.has(key) ? t(key) : category
  }

  if (role !== "admin") {
    return (
      <section className="space-y-4">
        <PageBreadcrumbRow
          segments={[
            { label: tDashboard("nav.settings") },
            { label: tDashboard("nav.auditLog") },
          ]}
        />
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{tDashboard("nav.auditLog")}</EmptyTitle>
            <EmptyDescription>{t("notAuthorized")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    )
  }

  // First-data loading for whichever query is active shows a skeleton table; the
  // toolbar still mounts so it does not flash in.
  const loadingFirst = isSearching
    ? searchResult === undefined
    : browse === undefined

  // Shared header for the data and skeleton tables (same columns, no reflow).
  const auditTableHeader = (
    <TableHeader>
      <TableRow>
        <TableHead className="w-44">{t("table.when")}</TableHead>
        <TableHead className="w-40">{t("table.who")}</TableHead>
        <TableHead className="w-32">{t("table.category")}</TableHead>
        <TableHead className="w-48">{t("table.action")}</TableHead>
        <TableHead>{t("table.details")}</TableHead>
      </TableRow>
    </TableHeader>
  )

  return (
    <section className="space-y-4">
      <PageBreadcrumbRow
        segments={[
          { label: tDashboard("nav.settings") },
          { label: tDashboard("nav.auditLog") },
        ]}
      />

      <FrameTable
        title={tDashboard("nav.auditLog")}
        count={loadingFirst ? undefined : view.total}
        // The whole toolbar is filters (search, category, date range): the log
        // has no primary action, so the title row's right side stays empty.
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <TableSearchField
              type="search"
              value={search}
              placeholder={t("search.placeholder")}
              onChange={setSearch}
            />
            <Select
              items={{
                all: t("categories.all"),
                ...Object.fromEntries(
                  CATEGORIES.map((category) => [
                    category,
                    categoryLabel(category),
                  ])
                ),
              }}
              value={selectedCategory}
              onValueChange={(value) =>
                setSelectedCategory(value as Category | "all")
              }
            >
              <SelectTrigger
                className="w-44"
                aria-label={t("categoryFilterLabel")}
              >
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
              value={dateRange}
              onChange={setDateRange}
              placeholder={t("dateRange.placeholder")}
              clearLabel={t("dateRange.clear")}
              todayLabel={t("dateRange.today")}
              ariaLabel={t("dateRange.label")}
            />
          </div>
        }
        footer={
          view.total > 0 || (isSearching && searchRows.length === 50) ? (
            <div className="flex flex-col gap-1.5">
              {view.total > 0 && (
                <FrameTableFooter
                  page={view.shownPage}
                  pageSize={PAGE_SIZE}
                  total={view.total}
                  pager={
                    <TablePagination
                      page={view.shownPage}
                      pageCount={view.pageCount}
                      hasMore={false}
                      canPrev={view.shownPage > 0}
                      canNext={view.shownPage < view.pageCount - 1}
                      onPrev={() => setPage(Math.max(0, view.shownPage - 1))}
                      onNext={() =>
                        setPage(
                          Math.min(view.pageCount - 1, view.shownPage + 1)
                        )
                      }
                      onSelect={setPage}
                      previousLabel={t("previous")}
                      nextLabel={t("next")}
                    />
                  }
                />
              )}
              {/* Search is capped, not paginated; say so under the pager. */}
              {isSearching && searchRows.length === 50 && (
                <p className="text-muted-foreground text-sm">
                  {t("search.capped", { count: 50 })}
                </p>
              )}
            </div>
          ) : undefined
        }
      >
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
                {},
              ]}
            />
          </Table>
        ) : view.total === 0 ? (
          // Inside the panel, because the filters above must stay usable to
          // widen an over-narrowed search back out.
          <Empty>
            <EmptyHeader>
              {!isSearching && (
                <EmptyMedia>
                  <Medallion icon={Audit02Icon} size="lg" />
                </EmptyMedia>
              )}
              <EmptyTitle>{tDashboard("nav.auditLog")}</EmptyTitle>
              <EmptyDescription>
                {isSearching ? t("search.empty") : t("empty")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table className="table-fixed">
            {auditTableHeader}
            <TableBody>
              {stories.map((story) => {
                // A story of one is an ordinary row and renders exactly as it
                // always did. A story of several renders its summary row,
                // which opens the gesture's own rows instead of the detail
                // sheet; each of those rows still opens the sheet.
                const isStory = story.rows.length > 1
                const open = openStories.has(story.key)
                return (
                  <Fragment key={story.key}>
                    <AuditLogRow
                      row={story.lead}
                      t={t}
                      format={format}
                      actorLabel={actorLabel}
                      actionLabel={actionLabel}
                      categoryLabel={categoryLabel}
                      detailText={detailText}
                      storyCount={isStory ? story.rows.length : null}
                      expanded={isStory ? open : null}
                      onActivate={() => {
                        if (!isStory) {
                          setSelectedRow(story.lead)
                          return
                        }
                        setOpenStories((current) => {
                          const next = new Set(current)
                          if (!next.delete(story.key)) next.add(story.key)
                          return next
                        })
                      }}
                    />
                    {isStory && open
                      ? story.rows.map((row) => (
                          <AuditLogRow
                            key={row.id}
                            row={row}
                            t={t}
                            format={format}
                            actorLabel={actorLabel}
                            actionLabel={actionLabel}
                            categoryLabel={categoryLabel}
                            detailText={detailText}
                            storyCount={null}
                            expanded={null}
                            nested
                            onActivate={() => setSelectedRow(row)}
                          />
                        ))
                      : null}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        )}
      </FrameTable>

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
              actorLabel={actorLabel}
              actionLabel={actionLabel}
              categoryLabel={categoryLabel}
              fieldLabel={fieldLabel}
              boolLabel={boolLabel}
              valueLabel={valueLabel}
              dateLabel={dateLabel}
              detailText={detailText}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  )
}

// One line of the log. The same component draws an ordinary row, a story's
// summary row, and a story's opened member rows, so the three can never drift
// into different anatomies (the brief's requirement that sub-rows keep the
// existing row shape).
//
// `storyCount` non-null makes it a summary (count chip + chevron); `expanded`
// non-null makes it the toggle rather than a link into the detail sheet.
function AuditLogRow({
  row,
  t,
  format,
  actorLabel,
  actionLabel,
  categoryLabel,
  detailText,
  storyCount,
  expanded,
  nested,
  onActivate,
}: {
  row: AuditRow
  t: ReturnType<typeof useTranslations<"dashboard.auditLog">>
  format: ReturnType<typeof useFormatter>
  actorLabel: (actorId: string, actorName: string) => string
  actionLabel: (type: string) => string
  categoryLabel: (category: string) => string
  detailText: (
    type: string,
    payload: unknown,
    names: Record<string, string>
  ) => ReactNode
  storyCount: number | null
  expanded: boolean | null
  nested?: boolean
  onActivate: () => void
}) {
  const isSummary = storyCount !== null
  return (
    <TableRow
      role="button"
      tabIndex={0}
      aria-label={isSummary ? t("story.toggle") : t("detail.viewDetails")}
      {...(expanded !== null ? { "aria-expanded": expanded } : {})}
      className={cn(
        "cursor-pointer hover:bg-muted/50",
        nested === true && "bg-muted/30"
      )}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onActivate()
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
        {actorLabel(row.actorId, row.actorName)}
      </TableCell>
      <TableCell>
        {row.category ? (
          <Badge variant="secondary">{categoryLabel(row.category)}</Badge>
        ) : null}
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-1.5">
          {/* The chevron's box is on EVERY row, empty where there is no
              chevron, so an ordinary row's action text starts at the same x as
              a story's and the column does not jog as stories open and close. */}
          <span className="flex size-4 shrink-0 items-center justify-center">
            {isSummary ? (
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                strokeWidth={2}
                aria-hidden="true"
                className={cn(
                  "size-3.5 transition-transform motion-reduce:transition-none",
                  expanded === true && "rotate-180"
                )}
              />
            ) : null}
          </span>
          <span className="truncate">{actionLabel(row.type)}</span>
          {isSummary ? (
            <Badge variant="secondary" className="shrink-0">
              {t("story.count", { count: storyCount })}
            </Badge>
          ) : null}
        </span>
      </TableCell>
      <TableCell className="truncate text-muted-foreground">
        {detailText(row.type, row.payload, row.names)}
      </TableCell>
    </TableRow>
  )
}

// The full-detail sheet body. Split out so its hooks-free render only mounts
// when a row is selected; all helpers are passed in from the section.
function AuditDetailSheet({
  row,
  t,
  format,
  actorLabel,
  actionLabel,
  categoryLabel,
  fieldLabel,
  boolLabel,
  valueLabel,
  dateLabel,
  detailText,
}: {
  row: AuditRow
  t: ReturnType<typeof useTranslations<"dashboard.auditLog">>
  format: ReturnType<typeof useFormatter>
  actorLabel: (actorId: string, actorName: string) => string
  actionLabel: (type: string) => string
  categoryLabel: (category: string) => string
  fieldLabel: (field: string) => string
  boolLabel: (value: boolean) => string
  valueLabel: (field: string, value: string) => string | undefined
  dateLabel: (epochMs: number) => string
  detailText: (
    type: string,
    payload: unknown,
    names: Record<string, string>
  ) => ReactNode
}) {
  const p = (row.payload ?? {}) as Record<string, unknown>

  // The always-on entity-context line: the subject of the event, built by the
  // pure auditContextParts (lib/audit-detail.tsx, vocabulary in
  // lib/audit-constants.ts) so its precedence rules stay
  // testable.
  const subject = auditContextParts(
    row.type,
    row.payload,
    row.names,
    {
      deletedRun: t("details.deletedRun"),
      scopeFieldLabel: fieldLabel("scope"),
    },
    valueLabel
  ).join(" · ")

  // Resolve a payload id (e.g. a role's familyId value) to its display name, so
  // change rows show "Produkt", not the raw id.
  const resolveName = (id: string) => row.names[id]

  const changes = payloadChanges(row.payload)
  const rawEntries = changes
    ? changeEntries(
        changes,
        fieldLabel,
        resolveName,
        boolLabel,
        valueLabel,
        dateLabel
      )
    : []
  const kind = sectionKind(row.type, rawEntries)
  // On a creation snapshot, fields set to nothing (e.g. an unset function/team)
  // carry no information, so drop them; on an update a cleared field is a real
  // change and stays. Then order identity-first regardless of stored key order.
  const entries = orderEntries(
    kind === "create"
      ? rawEntries.filter((entry) => !(entry.isSet && entry.to.trim() === ""))
      : rawEntries
  )
  const sectionHeading =
    kind === "create"
      ? t("detail.detailsHeading")
      : kind === "remove"
        ? t("detail.removedHeading")
        : t("detail.changes")
  // Annotate the role profile fields when a rename auto-cleared them.
  const clearedByRename = p.profileClearedByRename === true
  const items = payloadItems(row.payload, fieldLabel, boolLabel, valueLabel)
  const moves = payloadMoves(row.payload)
  const suggestions = payloadSuggestions(row.payload)
  const provenance = payloadProvenance(row.payload)
  // Flat-stats events (people.imported, classification.suggested) carry no
  // `changes` map; their scalar counts render as a labeled card, not a raw dump.
  // Only when there are no field changes, so a diff event never doubles up.
  const stats = entries.length > 0 ? [] : payloadStats(row.payload, valueLabel)

  // Whether any of the structured groups produced renderable content; the
  // one-line summary / no-changes note is only a final fallback when not.
  const hasGroups =
    entries.length > 0 ||
    (items?.items.length ?? 0) > 0 ||
    (moves?.moves.length ?? 0) > 0 ||
    (suggestions?.items.length ?? 0) > 0 ||
    stats.length > 0
  const summary = hasGroups ? "" : detailText(row.type, row.payload, row.names)
  const dateLong = format.dateTime(new Date(row.at), {
    dateStyle: "long",
    timeStyle: "short",
  })

  return (
    <>
      {/* A static title frames the sheet; the event itself and its timestamp
          live as rows in the meta grid below, never duplicated up here. */}
      <SheetHeader className="gap-1.5">
        {/* pr-8 keeps the title clear of the sheet's absolute close button. */}
        <SheetTitle className="text-balance pr-8">
          {t("detail.title")}
        </SheetTitle>
        <SheetDescription className="text-balance">
          {t("detail.subtitle")}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-4">
        {/* Meta, as key/value rows: action, what (the subject), who, when,
            category. */}
        <dl className={KV_GRID}>
          <dt className="text-muted-foreground">{t("table.action")}</dt>
          <dd className="min-w-0 break-words">{actionLabel(row.type)}</dd>
          {subject ? (
            <>
              <dt className="text-muted-foreground">{t("detail.appliesTo")}</dt>
              <dd className="min-w-0 break-words">{subject}</dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">{t("detail.who")}</dt>
          <dd className="min-w-0 break-words">
            {actorLabel(row.actorId, row.actorName)}
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
        </dl>

        {hasGroups ? (
          <div className="flex flex-col gap-5">
            {/* Top-level field changes, as a bordered record. */}
            {entries.length > 0 ? (
              <section className="space-y-2">
                <h3 className="font-medium text-sm">{sectionHeading}</h3>
                <ul className="divide-y divide-border overflow-hidden rounded-lg border">
                  {entries.map((entry) => (
                    <ChangeEntryRow
                      key={entry.field}
                      entry={entry}
                      emptyLabel={t("detail.emptyValue")}
                      clearedNote={
                        clearedByRename &&
                        (entry.field === "purpose" ||
                          entry.field === "responsibilities")
                          ? t("detail.clearedOnRename")
                          : undefined
                      }
                    />
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Flat-stats group: an import/classification summary as a labeled
                record (no before/after). */}
            {stats.length > 0 ? (
              <section className="space-y-2">
                <h3 className="font-medium text-sm">
                  {t("detail.detailsHeading")}
                </h3>
                <StatList stats={stats} fieldLabel={fieldLabel} />
              </section>
            ) : null}

            {/* Bulk group: one bordered record per item. */}
            {items && items.items.length > 0 ? (
              <section className="space-y-3">
                <h3 className="font-medium text-sm">
                  {t("detail.itemsHeading", { count: items.count })}
                </h3>
                <ul className="space-y-3">
                  {items.items.map((item) => (
                    <li key={item.key} className="space-y-1.5">
                      <div className="font-medium text-sm">
                        {item.title || t("detail.unnamedItem")}
                      </div>
                      {item.entries.length > 0 ? (
                        <ul className="divide-y divide-border overflow-hidden rounded-lg border">
                          {orderEntries(item.entries).map((entry) => (
                            <ChangeEntryRow
                              key={entry.field}
                              entry={entry}
                              emptyLabel={t("detail.emptyValue")}
                            />
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* AI weight-moves group. */}
            {moves && moves.moves.length > 0 ? (
              <section className="space-y-2">
                <h3 className="font-medium text-sm">
                  {t("detail.movesHeading")}
                </h3>
                <ul className="space-y-3">
                  {moves.moves.map((move) => (
                    <li
                      key={move.key}
                      className={
                        move.applied
                          ? "text-sm"
                          : "text-muted-foreground text-sm"
                      }
                    >
                      <div
                        className={
                          move.applied
                            ? "break-words"
                            : "break-words line-through"
                        }
                      >
                        <span className="text-muted-foreground">
                          {move.fromLabel}
                        </span>
                        <ChangeArrow />
                        <span>{move.toLabel}</span>
                        {move.points ? (
                          <span className="text-muted-foreground">
                            {" "}
                            ({move.points})
                          </span>
                        ) : null}
                      </div>
                      {move.motivation ? (
                        <div className="break-words text-muted-foreground text-sm">
                          {move.motivation}
                        </div>
                      ) : null}
                      {move.applied ? null : (
                        <div className="text-muted-foreground text-xs">
                          {t("detail.moveSkipped")}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Dropped-suggestions group. */}
            {suggestions && suggestions.items.length > 0 ? (
              <section className="space-y-2">
                <h3 className="font-medium text-sm">
                  {t("detail.suggestionsHeading", { count: suggestions.count })}
                </h3>
                <ul className="space-y-2">
                  {suggestions.items.map((item) => {
                    const kindKey = isSuggestionKind(item.kind)
                      ? AI_KIND_KEY[item.kind]
                      : undefined
                    const kindLabel = kindKey
                      ? t(`ai.kind.${kindKey}` as Parameters<typeof t>[0])
                      : item.kind
                    return (
                      <li key={item.key} className="break-words text-sm">
                        <span>{kindLabel}</span>
                        {item.status ? (
                          <span className="text-muted-foreground">
                            {" "}
                            {valueLabel("status", item.status) ?? item.status}
                          </span>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}
          </div>
        ) : summary ? (
          <p className="break-words text-sm">{summary}</p>
        ) : (
          <p className="text-muted-foreground text-sm">
            {t("detail.noChanges")}
          </p>
        )}

        {/* Footer meta: provenance and the raw event key, for traceability. */}
        <div className="space-y-1 border-border border-t pt-3 text-muted-foreground text-sm leading-relaxed">
          {provenance.length > 0 ? (
            <p className="break-words">
              {provenance
                .map(({ key, value }) => {
                  const label = t(
                    `detail.provenance.${key === "batchId" ? "batch" : key}` as Parameters<
                      typeof t
                    >[0]
                  )
                  const valueKey =
                    `detail.provenance.sourceValues.${value}` as Parameters<
                      typeof t.has
                    >[0]
                  // source/via values share one wire vocabulary (how the
                  // change came to be); cause carries the triggering event
                  // key, labeled like the action column; the boolean flags
                  // read Yes, never a raw "true". batchId stays a raw trace
                  // key on purpose.
                  const displayValue =
                    (key === "source" || key === "via") && t.has(valueKey)
                      ? t(valueKey)
                      : key === "cause"
                        ? actionLabel(value)
                        : value === "true"
                          ? boolLabel(true)
                          : value
                  return `${label}: ${displayValue}`
                })
                .join(" · ")}
            </p>
          ) : null}
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
