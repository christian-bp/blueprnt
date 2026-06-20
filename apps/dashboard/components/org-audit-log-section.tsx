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
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { usePaginatedQuery, useQuery } from "convex/react"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { useOrganization } from "@/components/org-context"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import {
  aiAuditDetail,
  AI_KIND_KEY,
  changeEntries,
  formatAuditDetail,
  payloadChanges,
  payloadItems,
  payloadMoves,
  payloadProvenance,
  payloadSuggestions,
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
  const debouncedSearch = useDebouncedValue(search, 300)

  // Row whose detail sheet is open, or null when the sheet is closed.
  const [selectedRow, setSelectedRow] = useState<AuditRow | null>(null)

  const isSearching = debouncedSearch.trim().length > 0
  const categoryArg = selectedCategory === "all" ? undefined : selectedCategory

  // Editors never call either query: the adminQuery would reject them. The
  // cosmetic guard keeps the page graceful (the sidebar item is hidden for them
  // anyway). Only one query is ever active at a time (browse XOR search).
  const browse = usePaginatedQuery(
    api.accounts.audit.listAuditLog,
    role === "admin" && !isSearching
      ? { orgId, category: categoryArg }
      : "skip",
    { initialNumItems: 50 }
  )
  const searchResult = useQuery(
    api.accounts.audit.searchAuditLog,
    role === "admin" && isSearching
      ? { orgId, search: debouncedSearch, category: categoryArg }
      : "skip"
  )

  const rows: AuditRow[] = isSearching
    ? (searchResult?.rows ?? [])
    : browse.results

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

  // First-data loading for whichever query is active renders nothing (matches
  // the prior behavior); the toolbar still mounts so it does not flash in.
  const loadingFirst = isSearching
    ? searchResult === undefined
    : browse.status === "LoadingFirstPage"

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-medium text-lg">{t("heading")}</h2>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>

      {/* Toolbar: category filter + search on one row. Empty toggle selection
          coerces back to "all" so there is always exactly one active filter. */}
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          variant="outline"
          value={selectedCategory}
          onValueChange={(value) =>
            setSelectedCategory((value as Category | "") || "all")
          }
          aria-label={t("categoryFilterLabel")}
        >
          <ToggleGroupItem value="all">{t("categories.all")}</ToggleGroupItem>
          {CATEGORIES.map((category) => (
            <ToggleGroupItem key={category} value={category}>
              {categoryLabel(category)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
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
      </div>

      {loadingFirst ? null : rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("heading")}</EmptyTitle>
            <EmptyDescription>
              {isSearching ? t("search.empty") : t("empty")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.when")}</TableHead>
              <TableHead>{t("table.who")}</TableHead>
              <TableHead>{t("table.action")}</TableHead>
              <TableHead>{t("table.details")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
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
                <TableCell className="text-muted-foreground">
                  {format.dateTime(new Date(row.at), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </TableCell>
                <TableCell className="font-medium">
                  {actorLabel(row.actorId, row.actorName)}
                </TableCell>
                <TableCell>{actionLabel(row.type)}</TableCell>
                <TableCell className="text-muted-foreground">
                  <span className="line-clamp-1">
                    {detailText(row.type, row.payload, row.names)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Pagination slot: fixed-height so toggling browse/search does not
          reflow the table. Load more while browsing; a truncation note while
          searching (search is capped, not paginated). */}
      <div className="flex h-9 items-center justify-center">
        {!isSearching && browse.status === "CanLoadMore" ? (
          <Button variant="outline" onClick={() => browse.loadMore(50)}>
            {t("loadMore")}
          </Button>
        ) : !isSearching && browse.status === "LoadingMore" ? (
          <Button variant="outline" disabled>
            {t("loadingMore")}
          </Button>
        ) : isSearching && rows.length === 50 ? (
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

  const changes = payloadChanges(row.payload)
  const entries = changes ? changeEntries(changes, fieldLabel) : []
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

  return (
    <>
      <SheetHeader>
        <SheetTitle>{actionLabel(row.type)}</SheetTitle>
        <SheetDescription>
          {format.dateTime(new Date(row.at), {
            dateStyle: "long",
            timeStyle: "medium",
          })}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-4 overflow-y-auto px-4">
        {/* Meta: who, category, raw event key. */}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t("detail.who")}</dt>
          <dd className="font-medium">
            {actorLabel(row.actorId, row.actorName)}
          </dd>
          {row.category ? (
            <>
              <dt className="text-muted-foreground">{t("detail.category")}</dt>
              <dd>
                <Badge variant="secondary">{categoryLabel(row.category)}</Badge>
              </dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">{t("detail.event")}</dt>
          <dd className="font-mono text-muted-foreground text-xs">
            {row.type}
          </dd>
        </dl>

        {/* Always-on entity-context line: the subject of the event. */}
        {subject ? (
          <p className="break-words text-muted-foreground text-sm">
            <span className="text-muted-foreground text-xs">
              {t("detail.entity")}:
            </span>{" "}
            <span className="text-foreground">{subject}</span>
          </p>
        ) : null}

        <div className="space-y-4">
          <h3 className="font-medium text-sm">{t("detail.changes")}</h3>

          {/* Top-level field changes. */}
          {entries.length > 0 ? (
            <ul className="space-y-3">
              {entries.map((entry) => (
                <ChangeEntryRow
                  key={entry.field}
                  entry={entry}
                  t={t}
                  annotateCleared={
                    clearedByRename &&
                    (entry.field === "purpose" ||
                      entry.field === "responsibilities")
                  }
                />
              ))}
            </ul>
          ) : null}

          {/* Bulk group: nested per-item before/after. */}
          {items && items.items.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-medium text-muted-foreground text-xs">
                {t("detail.itemsHeading", { count: items.count })}
              </h4>
              <ul className="space-y-4">
                {items.items.map((item) => (
                  <li key={item.key} className="space-y-2">
                    <div className="font-medium text-sm">
                      {item.title || t("detail.unnamedItem")}
                    </div>
                    {item.entries.length > 0 ? (
                      <ul className="space-y-3">
                        {item.entries.map((entry) => (
                          <ChangeEntryRow
                            key={entry.field}
                            entry={entry}
                            t={t}
                          />
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* AI weight-moves group. */}
          {moves && moves.moves.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-medium text-muted-foreground text-xs">
                {t("detail.movesHeading")}
              </h4>
              <ul className="space-y-3">
                {moves.moves.map((move) => (
                  <li
                    key={move.key}
                    className={
                      move.applied ? "text-sm" : "text-muted-foreground text-sm"
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
            </div>
          ) : null}

          {/* Dropped-suggestions group. */}
          {suggestions && suggestions.items.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-medium text-muted-foreground text-xs">
                {t("detail.suggestionsHeading", { count: suggestions.count })}
              </h4>
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
            </div>
          ) : null}

          {/* Final fallback: the one-line summary or a muted no-changes note. */}
          {!hasGroups ? (
            summary ? (
              <p className="break-words text-sm">{summary}</p>
            ) : (
              <p className="text-muted-foreground text-sm">
                {t("detail.noChanges")}
              </p>
            )
          ) : null}
        </div>

        {/* Provenance footer: where the change came from. */}
        {provenance.length > 0 ? (
          <p className="break-words text-muted-foreground text-xs">
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
      </div>

      <SheetFooter>
        <SheetClose asChild>
          <Button variant="outline">{t("detail.close")}</Button>
        </SheetClose>
      </SheetFooter>
    </>
  )
}

// One before/after row, shared by the top-level changes list and each bulk
// item's nested list. A complex (object/array) value renders its compact JSON
// in a horizontally scrollable mono block so the sheet body never scrolls
// sideways; a scalar shows "from -> to" (struck old) or just the new value.
function ChangeEntryRow({
  entry,
  t,
  annotateCleared = false,
}: {
  entry: ReturnType<typeof changeEntries>[number]
  t: ReturnType<typeof useTranslations<"dashboard.auditLog">>
  annotateCleared?: boolean
}) {
  return (
    <li className="text-sm">
      <div className="text-muted-foreground text-xs">{entry.label}</div>
      {entry.isComplex ? (
        <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
          {entry.isSet ? entry.to : `${entry.from}\n→ ${entry.to}`}
        </pre>
      ) : entry.isSet ? (
        <div className="break-words">{entry.to}</div>
      ) : (
        <div className="break-words">
          <span className="text-muted-foreground line-through">
            {entry.from}
          </span>
          <span className="px-2 text-muted-foreground">→</span>
          <span>{entry.to}</span>
        </div>
      )}
      {annotateCleared ? (
        <div className="text-muted-foreground text-xs">
          {t("detail.clearedOnRename")}
        </div>
      ) : null}
    </li>
  )
}
