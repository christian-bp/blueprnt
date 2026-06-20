"use client"

import { Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
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
import { useMemo, useState } from "react"
import type { DateRange } from "react-day-picker"
import { AuditPagination } from "@/components/audit/audit-pagination"
import { ChangeEntryRow, KV_GRID } from "@/components/audit/change-entry-row"
import { DateRangePicker } from "@/components/date-range-picker"
import { useOrganization } from "@/components/org-context"
import { TableSkeleton } from "@/components/table-skeleton"
import { useAuditPagination } from "@/hooks/use-audit-pagination"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { endOfDay, startOfDay } from "@/lib/date-bounds"
import {
  aiAuditDetail,
  AI_KIND_KEY,
  changeEntries,
  formatAuditDetail,
  orderEntries,
  payloadChanges,
  payloadItems,
  payloadMoves,
  payloadProvenance,
  payloadSuggestions,
  sectionKind,
} from "@/lib/audit-detail"

// The five filterable categories. Kept as local literals rather than importing
// the backend constant so we do not pull backend internals into the bundle; the
// query ignores any value outside this set (no filter), so "all" maps to
// undefined below.
const CATEGORIES = ["model", "role", "organization", "member", "ai"] as const
type Category = (typeof CATEGORIES)[number]

// A single enriched audit row, as returned by both the browse and search
// queries. `names` is a per-row id -> display-name map for that row's payload.
type AuditRow = {
  id: string
  at: number
  actorId: string
  actorName: string
  type: string
  category?: string
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
  const format = useFormatter()
  const { orgId, role } = useOrganization()

  // Toolbar state. The visible input is immediate; the debounced value drives
  // the search query so we do not fire on every keystroke.
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">(
    "all"
  )
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const debouncedSearch = useDebouncedValue(search, 300)

  // The earliest audit row's time (admin-gated like the other queries), used to
  // default the picker to the full span. The full default range is memoized on
  // the earliest value; `new Date()` is "today" at memo time, which is what we
  // want for the open-ended upper bound (no effect, no flash).
  const bounds = useQuery(
    api.accounts.audit.auditLogBounds,
    role === "admin" ? { orgId } : "skip"
  )
  // Default span: earliest entry (org creation) -> today. Until bounds resolve
  // we fall back to today so the trigger always shows a date (never a loader);
  // the query bounds stay open until then (startArg/endArg) so no rows hide.
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

  // Editors never call either query: the adminQuery would reject them. The
  // cosmetic guard keeps the page graceful (the sidebar item is hidden for them
  // anyway). Only one query is ever active at a time (browse XOR search).
  const browse = usePaginatedQuery(
    api.accounts.audit.listAuditLog,
    role === "admin" && !isSearching
      ? { orgId, category: categoryArg, start: startArg, end: endArg }
      : "skip",
    // Load up to 9 pages (25 each) up front so their numbers are real and
    // jumpable in the pager; beyond that the pager collapses to an ellipsis and
    // Next loads more.
    { initialNumItems: 225 }
  )
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

  const rows: AuditRow[] = isSearching
    ? (searchResult?.rows ?? [])
    : browse.results

  const pager = useAuditPagination({
    rows,
    pageSize: 25,
    canLoadMore: !isSearching && browse.status === "CanLoadMore",
    isLoadingMore: !isSearching && browse.status === "LoadingMore",
    loadMore: browse.loadMore,
    resetKey: `${selectedCategory}|${isSearching}|${debouncedSearch}|${startArg ?? ""}|${endArg ?? ""}`,
  })

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

  // The short one-line summary: AI suggestion events render from their own
  // payload (counts), everything else through the shared structured-change
  // formatter. names is per row (each row carries only the ids it references).
  function detailText(
    type: string,
    payload: unknown,
    names: Record<string, string>
  ): string {
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
      fieldLabel
    )
  }

  function categoryLabel(category: string): string {
    const key = `categories.${category}` as Parameters<typeof t.has>[0]
    return t.has(key) ? t(key) : category
  }

  if (role !== "admin") {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="font-medium text-lg">{t("heading")}</h2>
        </div>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("heading")}</EmptyTitle>
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
    : browse.status === "LoadingFirstPage"

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
      <div>
        <h2 className="font-medium text-lg">{t("heading")}</h2>
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
            rows={8}
            columns={[
              { className: "w-28" },
              { className: "w-24" },
              { className: "h-5 w-16 rounded-full" },
              { className: "w-28" },
              {},
            ]}
          />
        </Table>
      ) : rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
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
                  {actorLabel(row.actorId, row.actorName)}
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
                  {detailText(row.type, row.payload, row.names)}
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
          <AuditPagination
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
              actorLabel={actorLabel}
              actionLabel={actionLabel}
              categoryLabel={categoryLabel}
              fieldLabel={fieldLabel}
              detailText={detailText}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
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
  detailText,
}: {
  row: AuditRow
  t: ReturnType<typeof useTranslations<"dashboard.auditLog">>
  format: ReturnType<typeof useFormatter>
  actorLabel: (actorId: string, actorName: string) => string
  actionLabel: (type: string) => string
  categoryLabel: (category: string) => string
  fieldLabel: (field: string) => string
  detailText: (
    type: string,
    payload: unknown,
    names: Record<string, string>
  ) => string
}) {
  const p = (row.payload ?? {}) as Record<string, unknown>

  // The always-on entity-context line: the subject of the event. We pick
  // whichever ids the row resolved (role, then criterion/family/model, then
  // member), falling back to the captured `name` for renamed/removed families.
  // Invitation rows have no resolvable subject id (email is PII), so their
  // subject is role + status + expiry instead.
  function contextLine(): string {
    const parts: string[] = []
    const named = (id: unknown) =>
      typeof id === "string" ? row.names[id] : undefined
    const roleName = named(p.roleId)
    if (roleName) parts.push(roleName)
    const criterionName = named(p.criterionId)
    if (criterionName) parts.push(criterionName)
    const familyName = named(p.familyId)
    if (familyName) parts.push(familyName)
    else if (typeof p.name === "string" && row.type.startsWith("roleFamily.")) {
      // A renamed/removed family resolves no id; use the captured name.
      parts.push(p.name)
    }
    const modelName = named(p.modelId)
    if (modelName) parts.push(modelName)
    const memberName = named(p.memberUserId)
    if (memberName) parts.push(memberName)
    if (row.type.startsWith("invitation.")) {
      if (typeof p.role === "string") parts.push(String(p.role))
      if (typeof p.status === "string") parts.push(String(p.status))
      if (typeof p.expiresAt === "number") {
        parts.push(
          format.dateTime(new Date(p.expiresAt), { dateStyle: "medium" })
        )
      }
    }
    return parts.join(" · ")
  }

  const subject = contextLine()

  // Resolve a payload id (e.g. a role's familyId value) to its display name, so
  // change rows show "Produkt", not the raw id.
  const resolveName = (id: string) => row.names[id]

  const changes = payloadChanges(row.payload)
  const rawEntries = changes
    ? changeEntries(changes, fieldLabel, resolveName)
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
  const items = payloadItems(row.payload, fieldLabel)
  const moves = payloadMoves(row.payload)
  const suggestions = payloadSuggestions(row.payload)
  const provenance = payloadProvenance(row.payload)

  // Whether any of the structured groups produced renderable content; the
  // one-line summary / no-changes note is only a final fallback when not.
  const hasGroups =
    entries.length > 0 ||
    (items?.items.length ?? 0) > 0 ||
    (moves?.moves.length ?? 0) > 0 ||
    (suggestions?.items.length ?? 0) > 0
  const summary = hasGroups ? "" : detailText(row.type, row.payload, row.names)
  const dateLong = format.dateTime(new Date(row.at), {
    dateStyle: "long",
    timeStyle: "short",
  })

  return (
    <>
      <SheetHeader className="gap-1.5">
        {/* pr-8 keeps a long title clear of the sheet's absolute close button. */}
        <SheetTitle className="pr-8 text-balance">
          {actionLabel(row.type)}
        </SheetTitle>
        <SheetDescription className="text-balance">
          {subject || dateLong}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-4">
        {/* Meta, as key/value rows: who, when, and the category. */}
        <dl className={KV_GRID}>
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
                        <span className="px-2 text-muted-foreground">→</span>
                        <span>{move.toLabel}</span>
                        {move.points ? (
                          <span className="text-muted-foreground">
                            {" "}
                            ({move.points})
                          </span>
                        ) : null}
                      </div>
                      {move.motivation ? (
                        <div className="break-words text-muted-foreground text-xs">
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
                    const kindKey = AI_KIND_KEY[item.kind]
                    const kindLabel = kindKey
                      ? t(`ai.kind.${kindKey}` as Parameters<typeof t>[0])
                      : item.kind
                    return (
                      <li key={item.key} className="break-words text-sm">
                        <span>{kindLabel}</span>
                        {item.status ? (
                          <span className="text-muted-foreground">
                            {" "}
                            {item.status}
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
        <div className="space-y-1 border-border border-t pt-3 text-muted-foreground text-xs">
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
                  const displayValue =
                    key === "source" && t.has(valueKey) ? t(valueKey) : value
                  return `${label}: ${displayValue}`
                })
                .join(" · ")}
            </p>
          ) : null}
          <p className="font-mono">{row.type}</p>
        </div>
      </div>

      <SheetFooter>
        <SheetClose asChild>
          <Button variant="outline">{t("detail.close")}</Button>
        </SheetClose>
      </SheetFooter>
    </>
  )
}
