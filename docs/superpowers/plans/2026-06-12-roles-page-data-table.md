# Roles Page Grouped Data Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/roles` as one TanStack-powered table grouped by role family, with search (title/team/function), status + track filters, clickable rows, a result counter, and a zero-match empty state.

**Architecture:** The page stays thin (queries + header + empty state); a new `RolesTable` component owns the toolbar and table via `@tanstack/react-table` (shadcn data table recipe). Grouping uses a hidden family column with `groupedColumnMode: "remove"`; the pipeline filters before grouping so empty families disappear. The search matcher is a pure named export.

**Tech Stack:** Next.js 16 (app router, client components), `@tanstack/react-table` v8, shadcn `Table`/`Input`/`Select`/`Empty`, next-intl, Vitest 4 + testing-library (happy-dom).

**Spec:** `docs/superpowers/specs/2026-06-12-roles-page-redesign-design.md`

**Conventions that bind every task** (from CLAUDE.md): all UI strings through i18n (en first, mirrored to sv/nb/da/fi; parity test enforces); internal navigation via `Link` (row click may ALSO use `router.push` as an enhancement, the title link is the accessible path); never `bun test` (use `bun run test`); commits use conventional prefixes; the pre-commit hook runs Biome + typecheck + full tests and must pass.

---

### Task 1: Dependency + i18n keys

**Files:**
- Modify: `apps/dashboard/package.json` (via bun)
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json`

- [ ] **Step 1: Add @tanstack/react-table to the dashboard**

Run from the repo root:
```bash
cd apps/dashboard && bun add @tanstack/react-table && cd ../..
```
Expected: `@tanstack/react-table` appears under dependencies in `apps/dashboard/package.json` (v8.x).

- [ ] **Step 2: Add the toolbar keys to all five locales**

Run from the repo root:
```bash
python3 << 'PYEOF'
import json
TOOLBAR = {
 "en": {"searchPlaceholder": "Search by title, team, or function", "statusAll": "All statuses",
        "trackAll": "All tracks", "resultCount": "{shown} of {total} roles",
        "noMatches": "No roles match the search or filters.", "clearFilters": "Clear filters"},
 "sv": {"searchPlaceholder": "Sök på titel, team eller funktion", "statusAll": "Alla statusar",
        "trackAll": "Alla tracks", "resultCount": "{shown} av {total} roller",
        "noMatches": "Inga roller matchar sökningen eller filtren.", "clearFilters": "Rensa filtren"},
 "nb": {"searchPlaceholder": "Søk på tittel, team eller funksjon", "statusAll": "Alle statuser",
        "trackAll": "Alle tracks", "resultCount": "{shown} av {total} roller",
        "noMatches": "Ingen roller matcher søket eller filtrene.", "clearFilters": "Nullstill filtrene"},
 "da": {"searchPlaceholder": "Søg på titel, team eller funktion", "statusAll": "Alle statusser",
        "trackAll": "Alle tracks", "resultCount": "{shown} af {total} roller",
        "noMatches": "Ingen roller matcher søgningen eller filtrene.", "clearFilters": "Ryd filtrene"},
 "fi": {"searchPlaceholder": "Hae nimikkeellä, tiimillä tai toiminnolla", "statusAll": "Kaikki tilat",
        "trackAll": "Kaikki trackit", "resultCount": "{shown}/{total} roolia",
        "noMatches": "Yksikään rooli ei vastaa hakua tai suodattimia.", "clearFilters": "Tyhjennä suodattimet"},
}
for loc in ["en", "sv", "nb", "da", "fi"]:
    p = f"packages/i18n/messages/{loc}.json"
    m = json.load(open(p, encoding="utf-8"))
    m["dashboard"]["roles"]["toolbar"] = TOOLBAR[loc]
    with open(p, "w", encoding="utf-8") as f:
        json.dump(m, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(loc, "ok")
PYEOF
```
Expected: five "ok" lines.

- [ ] **Step 3: Run the i18n parity test**

Run: `cd packages/i18n && bun run test; cd ../..`
Expected: PASS (all locales share the key set).

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/package.json bun.lock packages/i18n/messages
git commit -m "feat(roles): add tanstack table dependency and toolbar i18n keys"
```
Note: nb/da/fi strings are machine drafts; the commit body convention for that note is handled in the final task's squashed message if landing via worktree, otherwise leave as is.

---

### Task 2: Pure search matcher (TDD)

**Files:**
- Create: `apps/dashboard/components/roles/roles-table.tsx` (matcher only at this point)
- Create: `apps/dashboard/components/roles/roles-table.test.tsx` (matcher describe only)

- [ ] **Step 1: Write the failing matcher tests**

Create `apps/dashboard/components/roles/roles-table.test.tsx`:
```tsx
import { describe, expect, it } from "vitest"
import { matchesRoleQuery } from "@/components/roles/roles-table"

const ROLE = { title: "Senior Engineer", team: "Core", function: "Engineering" }

describe("matchesRoleQuery", () => {
  it("matches case-insensitive substrings in title, team, and function", () => {
    expect(matchesRoleQuery(ROLE, "senior")).toBe(true)
    expect(matchesRoleQuery(ROLE, "core")).toBe(true)
    expect(matchesRoleQuery(ROLE, "ENGINEERING")).toBe(true)
  })

  it("returns true for an empty or whitespace query", () => {
    expect(matchesRoleQuery(ROLE, "")).toBe(true)
    expect(matchesRoleQuery(ROLE, "   ")).toBe(true)
  })

  it("returns false when no field matches", () => {
    expect(matchesRoleQuery(ROLE, "sales")).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/dashboard && bunx vitest run components/roles/roles-table.test.tsx`
Expected: FAIL (cannot resolve `@/components/roles/roles-table`).

- [ ] **Step 3: Create the module with the matcher**

Create `apps/dashboard/components/roles/roles-table.tsx`:
```tsx
"use client"

// The role register's free-text search: case-insensitive substring over the
// role's free-text fields (title, team, function). Pure and exported so the
// matching rules are unit-tested without a DOM; the table wires it in as
// its globalFilterFn.
export function matchesRoleQuery(
  role: { title: string; team: string; function: string },
  query: string
): boolean {
  const q = query.trim().toLowerCase()
  if (q === "") return true
  return [role.title, role.team, role.function].some((field) =>
    field.toLowerCase().includes(q)
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd apps/dashboard && bunx vitest run components/roles/roles-table.test.tsx`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/roles/roles-table.tsx apps/dashboard/components/roles/roles-table.test.tsx
git commit -m "feat(roles): pure search matcher for the role register"
```

---

### Task 3: RolesTable component (TDD)

**Files:**
- Modify: `apps/dashboard/components/roles/roles-table.tsx` (add the component)
- Modify: `apps/dashboard/components/roles/roles-table.test.tsx` (add the component describe)

- [ ] **Step 1: Write the failing component tests**

Append to `apps/dashboard/components/roles/roles-table.test.tsx` (and extend the imports at the top of the file accordingly):
```tsx
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { RolesTable, type RolesTableRow } from "@/components/roles/roles-table"

const pushMock = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

const toolbar = messages.dashboard.roles.toolbar

function row(overrides: Partial<RolesTableRow>): RolesTableRow {
  return {
    roleId: "r1",
    title: "Senior Engineer",
    function: "Engineering",
    team: "Core",
    trackKey: "IC",
    trackName: "Individual contributor",
    status: "draft",
    ratedCount: 3,
    totalCriteria: 9,
    familyId: "f-eng",
    familyName: "Engineering",
    ...overrides,
  }
}

const ROLES: RolesTableRow[] = [
  row({ roleId: "r1", title: "Senior Engineer" }),
  row({ roleId: "r2", title: "Staff Engineer", status: "approved" }),
  row({
    roleId: "r3",
    title: "Account Executive",
    team: "Sales North",
    function: "Sales",
    trackKey: "M",
    trackName: "Manager",
    familyId: "f-sales",
    familyName: "Sales",
  }),
  row({
    roleId: "r4",
    title: "Office Coordinator",
    team: "Ops",
    function: "Operations",
    familyId: null,
    familyName: null,
  }),
]

const TRACKS = [
  { key: "IC", name: "Individual contributor" },
  { key: "M", name: "Manager" },
]

function renderTable(roles: RolesTableRow[] = ROLES) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {/* form wrapper: radix Selects render their hidden native <select>
          only inside a form under happy-dom (same pattern as family-picker). */}
      <form>
        <RolesTable roles={roles} tracks={TRACKS} />
      </form>
    </NextIntlClientProvider>
  )
}

// The two toolbar selects in DOM order: status first, then track.
function hiddenSelects(): HTMLSelectElement[] {
  return [...document.querySelectorAll("select")]
}

describe("RolesTable", () => {
  afterEach(() => {
    cleanup()
    pushMock.mockReset()
  })

  it("renders one table with family group rows, counts, and links", () => {
    renderTable()
    // One single column header row set.
    expect(screen.getAllByRole("columnheader")).toHaveLength(5)
    // Family groups in name order, family-less last.
    const engineering = screen.getByRole("link", { name: "Engineering" })
    expect(engineering.getAttribute("href")).toBe("/roles/families/f-eng")
    expect(screen.getByRole("link", { name: "Sales" })).toBeDefined()
    expect(
      screen.getByText(messages.dashboard.roles.family.none)
    ).toBeDefined()
    // Counts per group (roleCount: "{count} roles").
    expect(
      screen.getByText(
        messages.dashboard.roles.family.roleCount.replace("{count}", "2")
      )
    ).toBeDefined()
  })

  it("searching hides families without matches and shows the counter", () => {
    renderTable()
    fireEvent.change(screen.getByPlaceholderText(toolbar.searchPlaceholder), {
      target: { value: "sales" },
    })
    // Only the Sales family remains (its group row + Account Executive).
    expect(screen.queryByRole("link", { name: "Engineering" })).toBeNull()
    expect(screen.getByText("Account Executive")).toBeDefined()
    // Counter: 1 of 4 roles.
    expect(
      screen.getByText(
        toolbar.resultCount
          .replace("{shown}", "1")
          .replace("{total}", "4")
      )
    ).toBeDefined()
  })

  it("filters by status via the select", () => {
    renderTable()
    const statusSelect = hiddenSelects()[0]
    if (statusSelect === undefined) throw new Error("status select missing")
    fireEvent.change(statusSelect, { target: { value: "approved" } })
    expect(screen.getByText("Staff Engineer")).toBeDefined()
    expect(screen.queryByText("Senior Engineer")).toBeNull()
    expect(screen.queryByText("Account Executive")).toBeNull()
  })

  it("filters by track via the select", () => {
    renderTable()
    const trackSelect = hiddenSelects()[1]
    if (trackSelect === undefined) throw new Error("track select missing")
    fireEvent.change(trackSelect, { target: { value: "M" } })
    expect(screen.getByText("Account Executive")).toBeDefined()
    expect(screen.queryByText("Senior Engineer")).toBeNull()
  })

  it("shows the zero-match empty state and clears all filters", () => {
    renderTable()
    fireEvent.change(screen.getByPlaceholderText(toolbar.searchPlaceholder), {
      target: { value: "no such role" },
    })
    expect(screen.getByText(toolbar.noMatches)).toBeDefined()
    fireEvent.click(
      screen.getByRole("button", { name: toolbar.clearFilters })
    )
    expect(screen.getByText("Senior Engineer")).toBeDefined()
    // Counter hidden again without active filters.
    expect(
      screen.queryByText(
        toolbar.resultCount.replace("{shown}", "4").replace("{total}", "4")
      )
    ).toBeNull()
  })

  it("navigates on row click while the title stays a real link", () => {
    renderTable()
    const titleLink = screen.getByRole("link", { name: "Senior Engineer" })
    expect(titleLink.getAttribute("href")).toBe("/roles/r1")
    const rowEl = titleLink.closest("tr")
    if (rowEl === null) throw new Error("row not found")
    fireEvent.click(within(rowEl).getByText("Core"))
    expect(pushMock).toHaveBeenCalledWith("/roles/r1")
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/dashboard && bunx vitest run components/roles/roles-table.test.tsx`
Expected: FAIL (`RolesTable`/`RolesTableRow` not exported).

- [ ] **Step 3: Implement the component**

Replace the full contents of `apps/dashboard/components/roles/roles-table.tsx` with:
```tsx
"use client"

import { Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  type Row,
  useReactTable,
} from "@tanstack/react-table"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { groupByFamily } from "@/lib/role-groups"
import { statusBadgeVariant } from "@/lib/role-status"

// The role register as ONE grouped data table (shadcn data table recipe on
// @tanstack/react-table), per the 2026-06-12 design spec: a hidden family
// column carries the grouping, the pipeline filters BEFORE grouping so
// families without matches disappear, and expansion is pinned open (the
// groups are organization, not disclosure). Search is the exported pure
// matcher below; status/track filter through column filters.

// Structural subset of listRoles rows (same precedent as CreateRoleDialog's
// TrackOption): the table needs no convex types of its own.
export interface RolesTableRow {
  roleId: string
  title: string
  function: string
  team: string
  trackKey: string
  trackName: string
  status: string
  ratedCount: number
  totalCriteria: number
  familyId: string | null
  familyName: string | null
}

export interface RolesTableTrack {
  key: string
  name: string
}

// The role register's free-text search: case-insensitive substring over the
// role's free-text fields (title, team, function). Pure and exported so the
// matching rules are unit-tested without a DOM; the table wires it in as
// its globalFilterFn.
export function matchesRoleQuery(
  role: { title: string; team: string; function: string },
  query: string
): boolean {
  const q = query.trim().toLowerCase()
  if (q === "") return true
  return [role.title, role.team, role.function].some((field) =>
    field.toLowerCase().includes(q)
  )
}

const ROLE_STATUSES = ["draft", "inReview", "approved"] as const

const exactString = (
  row: Row<RolesTableRow>,
  columnId: string,
  value: string
) => row.getValue<string>(columnId) === value

export function RolesTable({
  roles,
  tracks,
}: {
  roles: RolesTableRow[]
  tracks: RolesTableTrack[]
}) {
  const t = useTranslations("dashboard.roles")
  const tToolbar = useTranslations("dashboard.roles.toolbar")
  const tFamily = useTranslations("dashboard.roles.family")
  const tStatus = useTranslations("assessment.status")
  const router = useRouter()

  const [globalFilter, setGlobalFilter] = useState("")
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  // Family adjacency and order (name order, family-less last) come from the
  // shared grouping helper, flattened: TanStack groups by first appearance,
  // so presorted data yields the same group order as the family pages.
  const data = useMemo(
    () => groupByFamily(roles).flatMap((group) => group.rows),
    [roles]
  )

  const columns = useMemo<ColumnDef<RolesTableRow>[]>(
    () => [
      {
        id: "family",
        // The sentinel keeps family-less roles in ONE group; the group row
        // renders the real name (or the none label) from its leaf rows.
        accessorFn: (row) => row.familyId ?? "__none__",
        enableGlobalFilter: false,
      },
      {
        id: "title",
        accessorKey: "title",
        header: t("table.title"),
        cell: ({ row }) => (
          <Link
            href={`/roles/${row.original.roleId}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        id: "track",
        accessorFn: (row) => row.trackKey,
        header: t("table.track"),
        filterFn: exactString,
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.trackName}
          </span>
        ),
      },
      {
        id: "team",
        accessorKey: "team",
        header: t("table.team"),
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.team}</span>
        ),
      },
      {
        id: "status",
        accessorFn: (row) => row.status,
        header: t("table.status"),
        filterFn: exactString,
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <Badge variant={statusBadgeVariant(row.original.status)}>
            {tStatus(
              row.original.status as "draft" | "inReview" | "approved"
            )}
          </Badge>
        ),
      },
      {
        id: "rated",
        header: () => <span className="block text-right">{t("table.rated")}</span>,
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {row.original.ratedCount}/{row.original.totalCriteria}
          </span>
        ),
      },
    ],
    [t, tStatus]
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      // Grouping and expansion are pinned: the family grouping is the
      // page's organization, never user state, so groups cannot collapse
      // (and autoReset on filter changes cannot close them either).
      grouping: ["family"],
      expanded: true,
      globalFilter,
      columnFilters,
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onExpandedChange: () => {},
    onGroupingChange: () => {},
    groupedColumnMode: "remove",
    // The matcher reads the whole row, so it runs on the title column only
    // (every other column opts out of global filtering).
    globalFilterFn: (row, _columnId, value: string) =>
      matchesRoleQuery(row.original, value),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  })

  const shown = table.getFilteredRowModel().rows.length
  const filtersActive = globalFilter.trim() !== "" || columnFilters.length > 0
  const visibleColumnCount = table.getVisibleLeafColumns().length

  function clearFilters() {
    setGlobalFilter("")
    setColumnFilters([])
  }

  const statusFilter =
    (table.getColumn("status")?.getFilterValue() as string | undefined) ??
    "all"
  const trackFilter =
    (table.getColumn("track")?.getFilterValue() as string | undefined) ??
    "all"

  return (
    <div className="space-y-4">
      {/* Toolbar: search + the two filters; the counter appears only while
          something is narrowing the table. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            size={16}
            strokeWidth={2}
            aria-hidden="true"
            className="-translate-y-1/2 absolute top-1/2 left-2.5 text-muted-foreground"
          />
          <Input
            value={globalFilter}
            placeholder={tToolbar("searchPlaceholder")}
            aria-label={tToolbar("searchPlaceholder")}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="w-64 pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) =>
            table
              .getColumn("status")
              ?.setFilterValue(value === "all" ? undefined : value)
          }
        >
          <SelectTrigger aria-label={t("table.status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tToolbar("statusAll")}</SelectItem>
            {ROLE_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {tStatus(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={trackFilter}
          onValueChange={(value) =>
            table
              .getColumn("track")
              ?.setFilterValue(value === "all" ? undefined : value)
          }
        >
          <SelectTrigger aria-label={t("table.track")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tToolbar("trackAll")}</SelectItem>
            {tracks.map((track) => (
              <SelectItem key={track.key} value={track.key}>
                {track.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtersActive && (
          <span className="ml-auto text-muted-foreground text-sm tabular-nums">
            {tToolbar("resultCount", { shown, total: roles.length })}
          </span>
        )}
      </div>

      {shown === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("heading")}</EmptyTitle>
            <EmptyDescription>{tToolbar("noMatches")}</EmptyDescription>
          </EmptyHeader>
          <Button type="button" variant="outline" onClick={clearFilters}>
            {tToolbar("clearFilters")}
          </Button>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => {
              if (row.getIsGrouped()) {
                // The group's identity comes from its leaf rows (the family
                // column itself is removed via groupedColumnMode).
                const firstLeaf = row.subRows[0]?.original
                return (
                  <TableRow
                    key={row.id}
                    className="bg-muted/50 hover:bg-muted/50"
                  >
                    <TableCell colSpan={visibleColumnCount}>
                      <span className="flex items-baseline gap-2">
                        {firstLeaf !== undefined &&
                        firstLeaf.familyId !== null ? (
                          <Link
                            href={`/roles/families/${firstLeaf.familyId}`}
                            className="font-medium text-sm underline-offset-4 hover:underline"
                          >
                            {firstLeaf.familyName}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {tFamily("none")}
                          </span>
                        )}
                        <span className="text-muted-foreground text-xs">
                          {tFamily("roleCount", { count: row.subRows.length })}
                        </span>
                      </span>
                    </TableCell>
                  </TableRow>
                )
              }
              return (
                <TableRow
                  key={row.id}
                  // Whole-row navigation as an enhancement; the title cell's
                  // Link stays the accessible path (internal-navigation
                  // convention).
                  className="cursor-pointer"
                  onClick={() => router.push(`/roles/${row.original.roleId}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd apps/dashboard && bunx vitest run components/roles/roles-table.test.tsx`
Expected: all 9 tests pass (3 matcher + 6 component).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/roles/roles-table.tsx apps/dashboard/components/roles/roles-table.test.tsx
git commit -m "feat(roles): grouped data table with search and filters"
```

---

### Task 4: Rewire the page

**Files:**
- Modify: `apps/dashboard/app/(app)/roles/page.tsx` (full replacement below)

- [ ] **Step 1: Replace the page**

Replace the full contents of `apps/dashboard/app/(app)/roles/page.tsx` with:
```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Spinner } from "@workspace/ui/components/spinner"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useOrganization } from "@/components/org-context"
import { CreateRoleDialog } from "@/components/roles/create-role-dialog"
import { RolesTable } from "@/components/roles/roles-table"

// The role register: header + create CTA, then the grouped data table
// (search, filters, family group rows) in components/roles/roles-table.tsx.
// This page owns only the queries and the zero-roles empty state.
export default function RolesPage() {
  const t = useTranslations("dashboard.roles")
  const { orgId } = useOrganization()
  const locale = useLocale()
  const roles = useQuery(api.assessment.roles.listRoles, { orgId, locale })
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })

  if (roles === undefined || model === undefined || model === null) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={t("heading")} />
      </main>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium text-lg">{t("heading")}</h2>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        <CreateRoleDialog
          orgId={orgId}
          tracks={model.tracks}
          triggerLabel={t("newCta")}
        />
      </div>
      {roles.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("heading")}</EmptyTitle>
            <EmptyDescription>{t("empty")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <RolesTable roles={roles} tracks={model.tracks} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Biome + typecheck + full test suite**

Run from the repo root:
```bash
bunx biome check --write apps/dashboard && bun run typecheck && bun run test
```
Expected: Biome clean (4 pre-existing nursery warnings in sidebar files are fine), typecheck 0 errors, all packages' tests pass.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(roles): single grouped table on the roles page"
```

---

### Task 5: Verification sweep

- [ ] **Step 1: Spec conformance check**

Re-read `docs/superpowers/specs/2026-06-12-roles-page-redesign-design.md` section by section and confirm each decision is implemented (single table, group rows with links+counts, status/track filters, 3-field search, row click, counter only when active, both empty states, no sorting). Fix anything missing.

- [ ] **Step 2: Full suite once more**

Run: `bun run test && bun run typecheck`
Expected: green.

- [ ] **Step 3: Done**

Report back with what changed and any deviations from the plan.
