"use client"

import NumberFlow from "@number-flow/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
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
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { CheckListIcon, MoreVerticalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation } from "convex/react"
import { useFormatter, useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useState } from "react"
import { useOrganization } from "@/components/org-context"
import { TablePagination } from "@/components/table-pagination"
import {
  TableSkeleton,
  type TableSkeletonColumn,
} from "@/components/table-skeleton"
import { useMoney } from "@/hooks/use-money"
import { onSelectValue } from "@/lib/select"
import { toast } from "@/lib/toast"
import { DocumentationMenu, documentationFor } from "./documentation-controls"
import {
  type ActionStatus,
  type ActionTargetWire,
  groupLabel,
  type PayMappingActionWire,
  type PayMappingNoteWire,
} from "./pay-mapping-gap-types"
import { usePayMappingRun } from "./pay-mapping-run-context"

const STATUSES: ActionStatus[] = ["notStarted", "inProgress", "done"]
const PRIORITIES = ["high", "medium", "low"] as const
const DUE_WINDOW_DAYS = 30
// One shared constant sizes the pager AND the loading skeleton, so the
// table never grows when the first page arrives.
const PAGE_SIZE = 25

// The group a record is anchored to, as display text. A person- or
// pair-targeted record still reads by its GROUP (the group key is the only
// display value the target carries; the person's own name lives in the
// detail view, never denormalized here).
function targetGroupLabel(target: ActionTargetWire): string {
  if (target.kind === "pair") return ""
  const [roleTitle, , seniority] = target.groupKey.split("|")
  return groupLabel({
    roleTitle: roleTitle ?? null,
    seniority: seniority ?? null,
  })
}

// Whether a record belongs to the lika arbete flow or the women-dominated
// chapter: the overview's "type of comparison" filter, and the deep link
// back into the analysis.
function targetScope(
  target: ActionTargetWire
): "equalWork" | "equivalentWork" | "pair" {
  return target.kind === "pair" ? "pair" : target.scope
}

// The deep link that opens the record's OWN group in the analysis: the
// summary pre-selects the checklist step matching ?step=<scope>:<key>. A
// pair has no chapter step of its own, so it links to the analysis plainly
// (the tvärnivå section sits at the top there).
function analysisStepHref(
  analysisHref: string,
  target: ActionTargetWire
): string {
  if (target.kind === "pair") return analysisHref
  return `${analysisHref}?step=${target.scope}:${encodeURIComponent(target.groupKey)}`
}

// A summary-strip figure: a NumberFlow once the value is known (statuses
// move while the page is open), a small bar while it loads.
function StatValue({ value }: { value: number | undefined }) {
  if (value === undefined) return <Skeleton className="h-4 w-6" />
  return <NumberFlow value={value} />
}

// The muted, non-interactive stand-in for the per-row actions trigger: row
// chrome identical on every row renders as its real icon, never a gray bar.
const MENU_PLACEHOLDER = (
  <HugeiconsIcon
    icon={MoreVerticalIcon}
    strokeWidth={2}
    aria-hidden="true"
    className="size-4 text-muted-foreground/50"
  />
)

const ACTION_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { className: "h-9" },
  { className: "h-5 w-16 rounded-full" },
  { className: "w-24" },
  {},
  { className: "w-24" },
  { className: "w-20" },
  { className: "ml-auto w-16" },
  { content: MENU_PLACEHOLDER },
]

const NOTE_SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { className: "h-5 w-24 rounded-full" },
  { className: "w-24" },
  {},
  { className: "w-24" },
  { className: "w-20" },
]

// The action plan's own workspace (Iteration 2 note 5, part B): every åtgärd
// and notering the run carries, in one place, with filters and inline status
// updates, so the follow-up work never requires walking back through the
// analysis. Reads the run shell's shared subscriptions; the analysis views
// remain where records are created.
export function PayMappingActionsOverview() {
  const t = useTranslations("dashboard.payMapping.actions")
  const tOverview = useTranslations("dashboard.payMapping.actionsOverview")
  const tToolbar = useTranslations("dashboard.payMapping.toolbar")
  const tToast = useTranslations("dashboard.toast")
  const format = useFormatter()
  const money = useMoney()
  const pathname = usePathname()
  const { orgId } = useOrganization()
  const { run, gap, actions, notes } = usePayMappingRun()
  const setActionStatus = useMutation(api.payMapping.actions.setActionStatus)

  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [scopeFilter, setScopeFilter] = useState("all")
  const [ownerFilter, setOwnerFilter] = useState("all")
  const [dueFilter, setDueFilter] = useState("all")
  const [actionsPage, setActionsPage] = useState(0)
  const [notesPage, setNotesPage] = useState(0)

  const [, slug] = pathname.split("/").filter(Boolean)
  const analysisHref = `/pay-mappings/${slug}/analysis`
  const currency = gap?.currency ?? ""
  const locked = run?.status === "completed"
  const loading =
    run === undefined || actions === undefined || notes === undefined

  // A filter change re-scopes both lists, so both pagers go back to page 1.
  function filterSetter(setter: (value: string) => void) {
    return (value: string) => {
      setter(value)
      setActionsPage(0)
      setNotesPage(0)
    }
  }

  // Owner options come from the records themselves (an owner who has no
  // action is not a useful filter value).
  const owners = useMemo(() => {
    const byId = new Map<string, string>()
    for (const action of actions ?? []) {
      byId.set(action.ownerUserId, action.ownerName)
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [actions])

  // The due window is computed against the run's frozen reference date, not
  // the live clock: every figure on a kartläggning replays identically
  // (ADR-0011).
  const dueBefore =
    run === undefined
      ? 0
      : run.referenceDate + DUE_WINDOW_DAYS * 24 * 60 * 60 * 1000

  const visibleActions = (actions ?? []).filter((action) => {
    if (statusFilter !== "all" && action.status !== statusFilter) return false
    if (priorityFilter !== "all" && action.priority !== priorityFilter)
      return false
    if (scopeFilter !== "all" && targetScope(action.target) !== scopeFilter)
      return false
    if (ownerFilter !== "all" && action.ownerUserId !== ownerFilter)
      return false
    if (dueFilter === "soon" && action.plannedDate > dueBefore) return false
    return true
  })
  const visibleNotes = (notes ?? []).filter((note) => {
    if (scopeFilter !== "all" && targetScope(note.target) !== scopeFilter)
      return false
    return true
  })

  // Clamped so a shrinking result set can never strand the pager past the
  // last page.
  const actionsPageCount = Math.max(
    1,
    Math.ceil(visibleActions.length / PAGE_SIZE)
  )
  const actionsPage0 = Math.min(actionsPage, actionsPageCount - 1)
  const pagedActions = visibleActions.slice(
    actionsPage0 * PAGE_SIZE,
    (actionsPage0 + 1) * PAGE_SIZE
  )
  const notesPageCount = Math.max(1, Math.ceil(visibleNotes.length / PAGE_SIZE))
  const notesPage0 = Math.min(notesPage, notesPageCount - 1)
  const pagedNotes = visibleNotes.slice(
    notesPage0 * PAGE_SIZE,
    (notesPage0 + 1) * PAGE_SIZE
  )

  const totals = useMemo(() => {
    if (actions === undefined || notes === undefined) return undefined
    return {
      total: actions.length,
      notStarted: actions.filter((a) => a.status === "notStarted").length,
      inProgress: actions.filter((a) => a.status === "inProgress").length,
      done: actions.filter((a) => a.status === "done").length,
      cost: actions.reduce((sum, a) => sum + (a.estimatedCost ?? 0), 0),
      notes: notes.length,
      discussion: notes.filter((n) => n.noteType === "discussionNeeded").length,
    }
  }, [actions, notes])

  // NumberFlow's currency format throws on an invalid code (imported
  // currencies are not schema-constrained), so validate once and fall back
  // to the plain formatMoney text, which has its own fallback.
  const costFormat = useMemo(() => {
    try {
      new Intl.NumberFormat("en", { style: "currency", currency })
      return {
        style: "currency" as const,
        currency,
        maximumFractionDigits: 0,
      }
    } catch {
      return null
    }
  }, [currency])

  async function handleStatus(action: PayMappingActionWire, next: string) {
    try {
      await setActionStatus({
        orgId,
        actionId: action.actionId,
        status: next as ActionStatus,
      })
      toast.success(tToast("payMappingActionStatusChanged"))
    } catch {
      toast.error(tToast("error"))
    }
  }

  const empty = !loading && totals?.total === 0 && totals.notes === 0

  return (
    <div className="space-y-6">
      {/* The summary strip: live counts roll digit-by-digit (they change
          while the page is open, as statuses move). */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border px-4 py-3 text-sm">
        <span className="flex items-center gap-1.5">
          {tOverview("totalLabel")}
          <span className="font-semibold tabular-nums">
            <StatValue value={totals?.total} />
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {t("status.notStarted")}
          <span className="tabular-nums">
            <StatValue value={totals?.notStarted} />
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {t("status.inProgress")}
          <span className="tabular-nums">
            <StatValue value={totals?.inProgress} />
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {t("status.done")}
          <span className="tabular-nums">
            <StatValue value={totals?.done} />
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {tOverview("notesLabel")}
          <span className="tabular-nums">
            <StatValue value={totals?.notes} />
          </span>
        </span>
        {totals !== undefined && currency !== "" && (
          <span className="ml-auto flex items-center gap-1.5">
            {tOverview("costLabel")}
            <span className="font-semibold tabular-nums">
              {/* The roll-up moves as costs are edited elsewhere: a live
                  number, so it rolls like its sibling counts. */}
              {costFormat === null ? (
                money(totals.cost, currency)
              ) : (
                <NumberFlow value={totals.cost} format={costFormat} />
              )}
            </span>
          </span>
        )}
      </div>

      {empty ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon
                icon={CheckListIcon}
                strokeWidth={2}
                aria-hidden="true"
              />
            </EmptyMedia>
            <EmptyTitle>{tOverview("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{tOverview("emptyBody")}</EmptyDescription>
          </EmptyHeader>
          <Link
            href={analysisHref}
            className="text-sm underline underline-offset-4"
          >
            {tOverview("emptyCta")}
          </Link>
        </Empty>
      ) : (
        <>
          {/* Filters: the same select toolbar as the registers, rendered as
              the REAL controls while the data loads (their labels are static
              i18n text). Each narrows the actions list; the scope filter
              also narrows the notes. */}
          <div className="flex flex-wrap items-center gap-2">
            <Select
              items={{
                all: tOverview("statusAll"),
                ...Object.fromEntries(
                  STATUSES.map((s) => [s, t(`status.${s}`)])
                ),
              }}
              value={statusFilter}
              onValueChange={onSelectValue(filterSetter(setStatusFilter))}
            >
              <SelectTrigger aria-label={tOverview("statusAll")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tOverview("statusAll")}</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              items={{
                all: tOverview("priorityAll"),
                ...Object.fromEntries(
                  PRIORITIES.map((p) => [p, t(`priority.${p}`)])
                ),
              }}
              value={priorityFilter}
              onValueChange={onSelectValue(filterSetter(setPriorityFilter))}
            >
              <SelectTrigger aria-label={tOverview("priorityAll")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tOverview("priorityAll")}</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {t(`priority.${p}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              items={{
                all: tOverview("scopeAll"),
                equalWork: tOverview("scopeEqualWork"),
                equivalentWork: tOverview("scopeEquivalentWork"),
                pair: tOverview("scopePair"),
              }}
              value={scopeFilter}
              onValueChange={onSelectValue(filterSetter(setScopeFilter))}
            >
              <SelectTrigger aria-label={tOverview("scopeAll")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tOverview("scopeAll")}</SelectItem>
                <SelectItem value="equalWork">
                  {tOverview("scopeEqualWork")}
                </SelectItem>
                <SelectItem value="equivalentWork">
                  {tOverview("scopeEquivalentWork")}
                </SelectItem>
                <SelectItem value="pair">{tOverview("scopePair")}</SelectItem>
              </SelectContent>
            </Select>
            {owners.length > 0 && (
              <Select
                items={{
                  all: tOverview("ownerAll"),
                  ...Object.fromEntries(owners),
                }}
                value={ownerFilter}
                onValueChange={onSelectValue(filterSetter(setOwnerFilter))}
              >
                <SelectTrigger aria-label={tOverview("ownerAll")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tOverview("ownerAll")}</SelectItem>
                  {owners.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select
              items={{
                all: tOverview("dueAll"),
                soon: tOverview("dueSoon", { days: DUE_WINDOW_DAYS }),
              }}
              value={dueFilter}
              onValueChange={onSelectValue(filterSetter(setDueFilter))}
            >
              <SelectTrigger aria-label={tOverview("dueAll")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tOverview("dueAll")}</SelectItem>
                <SelectItem value="soon">
                  {tOverview("dueSoon", { days: DUE_WINDOW_DAYS })}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <section className="space-y-2">
            <h3 className="font-semibold text-base">
              {tOverview("actionsHeading")}
            </h3>
            {!loading && visibleActions.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {tOverview("noMatches")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[60rem] table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-36">
                        {tOverview("columns.status")}
                      </TableHead>
                      <TableHead className="w-24">
                        {t("priorityLabel")}
                      </TableHead>
                      <TableHead className="w-44">
                        {tOverview("columns.linkedTo")}
                      </TableHead>
                      <TableHead>{t("problem")}</TableHead>
                      <TableHead className="w-36">{t("owner")}</TableHead>
                      <TableHead className="w-32">{t("plannedDate")}</TableHead>
                      <TableHead className="w-28 text-right">
                        {t("estimatedCost")}
                      </TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  {loading || run === undefined ? (
                    <TableSkeleton
                      rows={PAGE_SIZE}
                      columns={ACTION_SKELETON_COLUMNS}
                    />
                  ) : (
                    <TableBody>
                      {pagedActions.map((action) => {
                        // The row's menu sees every record on ITS target
                        // (never a hardcoded empty list): an existing note
                        // must read "Edit note", or the menu would create a
                        // duplicate.
                        const own = documentationFor(
                          action.target,
                          actions,
                          notes
                        )
                        return (
                          <TableRow key={action.actionId}>
                            <TableCell>
                              {/* Status moves inline: the follow-up years are
                                  spent here, not back in the analysis. Allowed
                                  even on a completed run (ADR-0015). */}
                              <Select
                                items={Object.fromEntries(
                                  STATUSES.map((s) => [s, t(`status.${s}`)])
                                )}
                                value={action.status}
                                onValueChange={onSelectValue((value: string) =>
                                  handleStatus(action, value)
                                )}
                              >
                                <SelectTrigger
                                  aria-label={tOverview("columns.status")}
                                  className="w-full"
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUSES.map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {t(`status.${s}`)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                <Badge variant="secondary">
                                  {t(`priority.${action.priority}`)}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="truncate">
                              {/* Back into the analysis, opening the
                                  record's own group. */}
                              <Link
                                href={analysisStepHref(
                                  analysisHref,
                                  action.target
                                )}
                                className="underline underline-offset-4"
                              >
                                {targetGroupLabel(action.target) ||
                                  t(`targetKind.${action.target.kind}`)}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <div className="truncate">{action.problem}</div>
                              {/* The planned action rides under the problem
                                  (an eighth column would not fit). */}
                              <div className="truncate text-muted-foreground text-xs">
                                {action.plannedAction}
                              </div>
                            </TableCell>
                            <TableCell className="truncate">
                              {action.ownerName}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {format.dateTime(new Date(action.plannedDate), {
                                dateStyle: "medium",
                              })}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {action.estimatedCost === null || currency === ""
                                ? "-"
                                : money(action.estimatedCost, currency)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                <DocumentationMenu
                                  runId={run.runId}
                                  target={action.target}
                                  targetLabel={
                                    targetGroupLabel(action.target) ||
                                    t(`targetKind.${action.target.kind}`)
                                  }
                                  actions={own.actions}
                                  notes={own.notes}
                                  currency={currency}
                                  locked={locked}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  )}
                </Table>
              </div>
            )}
            {visibleActions.length > PAGE_SIZE && (
              <TablePagination
                page={actionsPage0}
                pageCount={actionsPageCount}
                hasMore={false}
                canPrev={actionsPage0 > 0}
                canNext={actionsPage0 < actionsPageCount - 1}
                onPrev={() => setActionsPage(actionsPage0 - 1)}
                onNext={() => setActionsPage(actionsPage0 + 1)}
                onSelect={setActionsPage}
                previousLabel={tToolbar("previous")}
                nextLabel={tToolbar("next")}
              />
            )}
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-base">
              {tOverview("notesHeading")}
              {totals !== undefined && totals.discussion > 0 && (
                <span className="ml-2 font-normal text-muted-foreground text-sm">
                  {tOverview("discussionCount", { count: totals.discussion })}
                </span>
              )}
            </h3>
            {!loading && visibleNotes.length === 0 ? (
              // "No matches" only when a filter actually hid something;
              // with no notes at all the honest line is that none exist.
              <p className="text-muted-foreground text-sm">
                {totals?.notes === 0
                  ? tOverview("noNotesYet")
                  : tOverview("noNotes")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[48rem] table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-52">
                        {t("noteTypeLabel")}
                      </TableHead>
                      <TableHead className="w-44">
                        {tOverview("columns.linkedTo")}
                      </TableHead>
                      <TableHead>{t("noteText")}</TableHead>
                      <TableHead className="w-36">
                        {tOverview("columns.author")}
                      </TableHead>
                      <TableHead className="w-32">
                        {tOverview("columns.created")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  {loading ? (
                    <TableSkeleton
                      rows={PAGE_SIZE}
                      columns={NOTE_SKELETON_COLUMNS}
                    />
                  ) : (
                    <TableBody>
                      {pagedNotes.map((note: PayMappingNoteWire) => (
                        <TableRow key={note.noteId}>
                          <TableCell>
                            <div className="flex items-center">
                              <Badge variant="secondary">
                                {t(`noteType.${note.noteType}`)}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="truncate">
                            <Link
                              href={analysisStepHref(analysisHref, note.target)}
                              className="underline underline-offset-4"
                            >
                              {targetGroupLabel(note.target) ||
                                t(`targetKind.${note.target.kind}`)}
                            </Link>
                          </TableCell>
                          <TableCell className="truncate">
                            {note.text}
                          </TableCell>
                          <TableCell className="truncate">
                            {note.createdByName}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {format.dateTime(new Date(note.createdAt), {
                              dateStyle: "medium",
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  )}
                </Table>
              </div>
            )}
            {visibleNotes.length > PAGE_SIZE && (
              <TablePagination
                page={notesPage0}
                pageCount={notesPageCount}
                hasMore={false}
                canPrev={notesPage0 > 0}
                canNext={notesPage0 < notesPageCount - 1}
                onPrev={() => setNotesPage(notesPage0 - 1)}
                onNext={() => setNotesPage(notesPage0 + 1)}
                onSelect={setNotesPage}
                previousLabel={tToolbar("previous")}
                nextLabel={tToolbar("next")}
              />
            )}
          </section>
        </>
      )}
    </div>
  )
}
