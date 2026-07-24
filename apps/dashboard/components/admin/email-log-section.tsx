"use client"

import { Mail01Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import {
  EMAIL_TEMPLATE_KEYS,
  type EmailTemplateKey,
} from "@workspace/constants"
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
import { Spinner } from "@workspace/ui/components/spinner"
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
import {
  DeliveryStatusBadge,
  EmailStatusBadge,
} from "@/components/admin/email-status-badge"
import { TablePagination } from "@/components/table-pagination"
import { DateRangePicker } from "@/components/date-range-picker"
import { PageHeading } from "@/components/page-heading"
import { TableSkeleton } from "@/components/table-skeleton"
import { useAuditPagination } from "@/hooks/use-audit-pagination"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { endOfDay, startOfDay } from "@/lib/date-bounds"

const STATUSES = ["queued", "sent", "failed", "cancelled"] as const
type Status = (typeof STATUSES)[number]

// blueprnt's template keys (the campaignTags it tags each send with): the typed
// "type" filter, shared with the backend via @workspace/constants. The backend
// passes these to the component as tag strings.
const TEMPLATES = EMAIL_TEMPLATE_KEYS
type Template = EmailTemplateKey

const PAGE_SIZE = 25
// Load up to 9 pages up front so the pager's page numbers are real and jumpable;
// beyond that the pager collapses to an ellipsis and Next loads more.
const INITIAL_ITEMS = PAGE_SIZE * 9
// The component's search query caps results (relevance-ranked, not paginated).
const SEARCH_CAP = 50

type EmailT = ReturnType<typeof useTranslations<"dashboard.admin.emailLog">>

// next-intl messages are typed, so dynamic keys (status/template/delivery
// variants) need a cast to the translator's key union; the values are known.
function dyn(t: EmailT, key: string): string {
  return t(key as Parameters<typeof t>[0])
}

// Friendly label for the first campaign tag, falling back to the raw tag.
function templateLabel(t: EmailT, tag: string | undefined): string | null {
  if (!tag) return null
  const key = `templates.${tag}` as Parameters<typeof t.has>[0]
  return t.has(key) ? dyn(t, key) : tag
}

export function EmailLogSection() {
  const t = useTranslations("dashboard.admin.emailLog")
  const format = useFormatter()

  // Toolbar state. The visible input is immediate; the debounced value drives
  // the search query so we don't fire on every keystroke.
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<Status | "all">("all")
  const [type, setType] = useState<Template | "all">("all")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const debouncedSearch = useDebouncedValue(search, 300)

  // Earliest message time defaults the picker to the full span. Until it
  // resolves, the query bounds stay open (startArg/endArg) so no rows hide.
  const bounds = useQuery(api.platform.emailLog.bounds, {})
  const defaultRange = useMemo<DateRange>(
    () => ({
      from: bounds?.earliest != null ? new Date(bounds.earliest) : new Date(),
      to: new Date(),
    }),
    [bounds?.earliest]
  )
  const range = dateRange ?? defaultRange

  const isSearching = debouncedSearch.trim().length > 0
  const statusArg = status === "all" ? undefined : status
  const typeArg = type === "all" ? undefined : type
  const startArg =
    bounds !== undefined && range.from ? startOfDay(range.from) : undefined
  const endArg =
    bounds !== undefined && range.to ? endOfDay(range.to) : undefined

  // Only one query is active at a time (browse XOR search).
  const browse = usePaginatedQuery(
    api.platform.emailLog.list,
    isSearching
      ? "skip"
      : { status: statusArg, tag: typeArg, start: startArg, end: endArg },
    { initialNumItems: INITIAL_ITEMS }
  )
  const searchResult = useQuery(
    api.platform.emailLog.search,
    isSearching
      ? {
          search: debouncedSearch,
          status: statusArg,
          tag: typeArg,
          start: startArg,
          end: endArg,
        }
      : "skip"
  )

  const rows = isSearching ? (searchResult?.page ?? []) : browse.results

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const pager = useAuditPagination({
    rows,
    pageSize: PAGE_SIZE,
    canLoadMore: !isSearching && browse.status === "CanLoadMore",
    isLoadingMore: !isSearching && browse.status === "LoadingMore",
    loadMore: browse.loadMore,
    resetKey: `${status}|${type}|${isSearching}|${debouncedSearch}|${startArg ?? ""}|${endArg ?? ""}`,
  })

  const loadingFirst = isSearching
    ? searchResult === undefined
    : browse.status === "LoadingFirstPage"

  const tableHeader = (
    <TableHeader>
      <TableRow>
        <TableHead className="w-44">{t("table.when")}</TableHead>
        <TableHead className="w-52">{t("table.recipient")}</TableHead>
        <TableHead>{t("table.subject")}</TableHead>
        <TableHead className="w-36">{t("table.template")}</TableHead>
        <TableHead className="w-28">{t("table.status")}</TableHead>
      </TableRow>
    </TableHeader>
  )

  return (
    <section className="space-y-4">
      <div>
        <PageHeading>{t("heading")}</PageHeading>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>

      {/* Toolbar: search, status, type, date range. */}
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
            all: t("statuses.all"),
            ...Object.fromEntries(
              STATUSES.map((s) => [s, dyn(t, `statuses.${s}`)])
            ),
          }}
          value={status}
          onValueChange={(value) => setStatus(value as Status | "all")}
        >
          <SelectTrigger className="w-40" aria-label={t("statusFilterLabel")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("statuses.all")}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {dyn(t, `statuses.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={{
            all: t("templates.all"),
            ...Object.fromEntries(
              TEMPLATES.map((tpl) => [tpl, dyn(t, `templates.${tpl}`)])
            ),
          }}
          value={type}
          onValueChange={(value) => setType(value as Template | "all")}
        >
          <SelectTrigger className="w-40" aria-label={t("typeFilterLabel")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("templates.all")}</SelectItem>
            {TEMPLATES.map((tpl) => (
              <SelectItem key={tpl} value={tpl}>
                {dyn(t, `templates.${tpl}`)}
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
          {tableHeader}
          <TableSkeleton
            rows={PAGE_SIZE}
            columns={[
              { className: "w-28" },
              { className: "w-40" },
              {},
              { className: "w-24" },
              { className: "h-5 w-16 rounded-full" },
            ]}
          />
        </Table>
      ) : rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            {!isSearching && (
              <EmptyMedia variant="icon">
                <HugeiconsIcon
                  icon={Mail01Icon}
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
          {tableHeader}
          <TableBody>
            {pager.pageRows.map((row) => (
              <TableRow
                key={row.messageId}
                role="button"
                tabIndex={0}
                aria-label={t("detail.viewDetailsFor", {
                  subject: row.subject ?? t("noSubject"),
                })}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setSelectedId(row.messageId)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    setSelectedId(row.messageId)
                  }
                }}
              >
                <TableCell className="truncate text-muted-foreground">
                  {format.dateTime(new Date(row.createdAt), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </TableCell>
                <TableCell className="truncate text-muted-foreground">
                  {row.recipients.join(", ")}
                </TableCell>
                <TableCell className="truncate font-medium">
                  {row.subject ?? t("noSubject")}
                </TableCell>
                <TableCell className="truncate text-muted-foreground">
                  {templateLabel(t, row.campaignTags[0])}
                </TableCell>
                <TableCell>
                  <EmailStatusBadge status={row.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Pagination slot: stable container so toggling browse/search does not
          reflow the table; a truncation note while searching (search is capped). */}
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
        {isSearching && rows.length === SEARCH_CAP ? (
          <p className="text-muted-foreground text-sm">
            {t("search.capped", { count: SEARCH_CAP })}
          </p>
        ) : null}
      </div>

      <Sheet
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
      >
        <SheetContent
          side="right"
          className="gap-0 data-[side=right]:sm:max-w-xl"
        >
          {selectedId ? <EmailDetailSheet messageId={selectedId} /> : null}
        </SheetContent>
      </Sheet>
    </section>
  )
}

// The detail body. Mounts only when a row is selected, so its `get` query (which
// pulls the full message incl. the rendered body) is lazy. Every branch renders
// a SheetTitle so the dialog always has an accessible name.
function EmailDetailSheet({ messageId }: { messageId: string }) {
  const t = useTranslations("dashboard.admin.emailLog")
  const format = useFormatter()
  const detail = useQuery(api.platform.emailLog.get, { messageId })

  if (detail === undefined) {
    return (
      <>
        <SheetHeader className="sr-only">
          <SheetTitle>{t("detail.loading")}</SheetTitle>
        </SheetHeader>
        <div className="flex h-full items-center justify-center">
          <Spinner aria-label={t("detail.loading")} />
        </div>
      </>
    )
  }
  if (detail === null) {
    // Single instance of the message: the SheetTitle is the dialog's accessible
    // name, so a duplicate body paragraph would be announced twice. A footer
    // Close keeps the branch consistent with the loaded state.
    return (
      <>
        <SheetHeader>
          <SheetTitle>{t("detail.notFound")}</SheetTitle>
        </SheetHeader>
        <SheetFooter>
          <SheetClose render={<Button variant="outline" />}>
            {t("detail.close")}
          </SheetClose>
        </SheetFooter>
      </>
    )
  }

  const recipients = detail.to.map((r) => r.email)
  const sentAt = format.dateTime(new Date(detail.createdAt), {
    dateStyle: "long",
    timeStyle: "short",
  })
  const subject = detail.subject ?? t("noSubject")
  const template = templateLabel(t, detail.campaignTags[0])

  // Render the email body in a sandboxed iframe (no scripts/forms/same-origin)
  // with an injected CSP: blocks active content + network beacons (default-src
  // 'none' → no script/connect), allows images/styles/fonts so the email renders
  // faithfully. referrerPolicy keeps the referrer off any image loads.
  const previewDoc = detail.html
    ? `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline' https:; font-src data: https:">${detail.html}`
    : null

  return (
    <>
      <SheetHeader className="gap-1.5">
        <SheetTitle className="text-balance pr-8">{subject}</SheetTitle>
        <SheetDescription className="text-balance">{sentAt}</SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t("detail.to")}</dt>
          <dd className="min-w-0 break-words">{recipients.join(", ")}</dd>
          {detail.from ? (
            <>
              <dt className="text-muted-foreground">{t("detail.from")}</dt>
              <dd className="min-w-0 break-words">{detail.from.email}</dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">{t("detail.status")}</dt>
          <dd className="min-w-0">
            <EmailStatusBadge status={detail.status} />
          </dd>
          {template ? (
            <>
              <dt className="text-muted-foreground">{t("detail.template")}</dt>
              <dd className="min-w-0 break-words">{template}</dd>
            </>
          ) : null}
          {detail.transactionId ? (
            <>
              <dt className="text-muted-foreground">
                {t("detail.transactionId")}
              </dt>
              <dd className="min-w-0 break-words font-mono text-xs">
                {detail.transactionId}
              </dd>
            </>
          ) : null}
          {detail.errorMessage ? (
            <>
              <dt className="text-muted-foreground">{t("detail.error")}</dt>
              <dd className="min-w-0 break-words text-destructive">
                {detail.errorMessage}
              </dd>
            </>
          ) : null}
        </dl>

        {detail.deliveries.length > 0 ? (
          <section className="space-y-2">
            <h3 className="font-medium text-sm">
              {t("detail.deliveriesHeading")}
            </h3>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border">
              {detail.deliveries.map((d) => (
                <li
                  key={d.recipientKey}
                  className="space-y-1.5 px-3 py-2.5 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">{d.recipientKey}</span>
                    <DeliveryStatusBadge status={d.status} />
                  </div>
                  {d.opened || d.clicked || d.complained || d.unsubscribed ? (
                    <div className="flex flex-wrap gap-1">
                      {d.opened ? (
                        <Badge variant="outline">{t("delivery.opened")}</Badge>
                      ) : null}
                      {d.clicked ? (
                        <Badge variant="outline">{t("delivery.clicked")}</Badge>
                      ) : null}
                      {d.complained ? (
                        <Badge variant="destructive">
                          {t("delivery.complained")}
                        </Badge>
                      ) : null}
                      {d.unsubscribed ? (
                        <Badge variant="outline">
                          {t("delivery.unsubscribed")}
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="space-y-2">
          <h3 className="font-medium text-sm">{t("detail.previewHeading")}</h3>
          {previewDoc ? (
            <iframe
              title={t("detail.previewOf", { subject })}
              sandbox=""
              referrerPolicy="no-referrer"
              srcDoc={previewDoc}
              className="h-[480px] w-full rounded-lg border bg-white"
            />
          ) : detail.text ? (
            <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm">
              {detail.text}
            </pre>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("detail.noPreview")}
            </p>
          )}
        </section>
      </div>

      <SheetFooter>
        <SheetClose render={<Button variant="outline" />}>
          {t("detail.close")}
        </SheetClose>
      </SheetFooter>
    </>
  )
}
