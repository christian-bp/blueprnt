# Platform admin audit log: parity with the org log

Goal: give the platform admin audit log the same look and functionality as the org `Händelselogg` we just polished: a category filter dropdown, full-text search, cursor pagination, a Category column, and the detail sheet (key/value meta on top, framed before/after details below). Share code with the org log rather than duplicating it (CLAUDE.md: DRY + typed by default).

The org log is the reference implementation:
- Backend: `packages/backend/convex/accounts/audit.ts` (`listAuditLog` paginated + `searchAuditLog` capped), `lib/audit.ts` (`categoryForEvent`, `buildSearchText`, `AUDIT_CATEGORIES`), `shared/tables.ts` (`auditLog` with `category`/`searchText` + `by_org_category` + `search_text`).
- Frontend: `apps/dashboard/components/org-audit-log-section.tsx` (toolbar, table, `AuditDetailSheet`, `ChangeEntryRow`), pure helpers in `apps/dashboard/lib/audit-detail.ts`.

The platform log is `platformAuditLog` (separate table, `PLATFORM_AUDIT_EVENTS`, id-only payloads, `targetUserId`/`targetOrgId`), written by `logPlatformAudit`, read by `platform/admin.ts listAuditLog`, rendered by `apps/dashboard/components/admin/audit-log-section.tsx`.

## Platform categories

```
user:         platform.userCreated, platform.userDeleted
organization: platform.orgCreated, platform.orgUpdated
membership:   platform.membershipGranted, platform.membershipRoleChanged, platform.membershipRevoked
admin:        platform.adminGranted, platform.adminRevoked
```
`PLATFORM_AUDIT_CATEGORIES = ["user","organization","membership","admin"]`.

## PII / search constraint (binding)

The platform log's invariant is id-only, no PII, so erasure leaves nothing. `searchText` must therefore be built ONLY from `actorName + type + payload scalars` (the existing `buildSearchText`), never from the resolved target email or user name. Server search covers operator, action, and payload codes, NOT resolved target names/emails. Document this limitation in code. (Org names and user emails are resolved at read time for display only.)

## Unit 1 - backend (mirror the org backend for the platform log)

`shared/tables.ts` `platformAuditLog`: add `category: v.optional(v.string())` and `searchText: v.optional(v.string())`; add `.index("by_category", ["category"])` and `.searchIndex("search_text", { searchField: "searchText", filterFields: ["category"] })`. Keep `by_actor`. Update the table comment.

`lib/audit.ts`: add
```ts
export const PLATFORM_AUDIT_CATEGORIES = ["user","organization","membership","admin"] as const
export type PlatformAuditCategory = (typeof PLATFORM_AUDIT_CATEGORIES)[number]
export function categoryForPlatformEvent(type: string): PlatformAuditCategory | undefined
```
mapping the events above (prefix/suffix logic on the `platform.*` type). In `logPlatformAudit`, set `category: categoryForPlatformEvent(entry.type)` and `searchText: buildSearchText(actorName, entry.type, entry.payload)` on insert (mirror logAudit).

`platform/admin.ts`:
- `listAuditLog`: args `{ paginationOpts: paginationOptsValidator, category?: v.optional(v.string()) }`. If `category` is a `PLATFORM_AUDIT_CATEGORIES` value, query `by_category` `.eq("category", category)`, else the table, both `.order("desc").paginate(opts)`. Resolve `targetUser`/`targetOrg` per page exactly as today (fetch `listAllUsers`/`listAllOrganizations`, build maps, map the page). Return `{ ...result, page }` (omit the `returns` validator per the org's paginated pattern). Each page row keeps the current shape: `{ id, at, actorId, actorName, type, category?, targetUser, targetOrg, payload }` (add `category`).
- `searchAuditLog`: args `{ search: v.string(), category?: v.optional(v.string()) }`. Empty/whitespace search returns `{ rows: [] }`. Use `.withSearchIndex("search_text", q => { let s = q.search("searchText", search); if (validCategory) s = s.eq("category", category); return s }).take(50)`, resolve targets, return `{ rows }` with the same row shape.
- Read the org `accounts/audit.ts` for the exact pagination/search API shapes; follow `convex/_generated/ai/guidelines.md`.

Tests (`platform/admin.test.ts`): `categoryForPlatformEvent` mapping; a paginated two-page list (newest first, cursor, isDone); category filter; search hits actor/type/code and misses unrelated; empty search returns `{ rows: [] }`; platform-admin-only rejection on both (mirror existing). Run `bunx convex codegen`.

## Unit 2 - frontend (shared parts + admin UI)

Share, don't duplicate:
- Extract `ChangeEntryRow` into a namespace-agnostic shared component `apps/dashboard/components/audit/change-entry-row.tsx` taking string props (`emptyLabel: string`, optional `clearedNote?: string`) instead of a scoped `t`. Refactor the org section to import it and pass `t("detail.emptyValue")` / the cleared note. Org behavior must stay identical (its tests + the audit-detail tests stay green; verify by inspection that the sheet renders the same).
- Reuse the pure helpers in `lib/audit-detail.ts` (`changeEntries`, `orderEntries`, `sectionKind`, `formatChanges`, `payloadChanges`, `formatAuditValue`) in the admin section. Field labels reuse `dashboard.auditLog.fields.*` (same domain fields).

Rewrite `apps/dashboard/components/admin/audit-log-section.tsx` mirroring the org section:
- Toolbar: search input on the left, a category `Select` dropdown to its right (options: All + the four platform categories). State drives `usePaginatedQuery(api.platform.admin.listAuditLog, { paginationOpts via hook, category })` and `useQuery(api.platform.admin.searchAuditLog, { search, category })`, browse XOR search, debounced search (`useDebouncedValue`), same as org. (No `role` gate needed; the page is already platform-admin gated, but keep the query calls unconditional.)
- Table columns: When / Operator / Category / Action / Target / Details. Category renders a `Badge` (variant secondary). Rows are clickable (role=button, Enter/Space) to open the sheet. Details cell keeps the current one-line summary (`formatChanges` when `payload.changes`, else the flat `key: value` `formatPayload`).
- Pagination slot (fixed height): Load more while browsing (`CanLoadMore`/`LoadingMore`), search cap note when searching and `rows.length === 50`.
- Detail sheet (mirror org `AuditDetailSheet`): SheetTitle = action label; SheetDescription = the target (`composeTarget`) or the long date. KV meta grid (the same `grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2.5 text-sm`): Operator, When, Category (badge), Target. Then the framed change record (heading via `sectionKind`, `changeEntries` + the shared `ChangeEntryRow`) when `payload.changes` exists; otherwise a framed flat list of the remaining payload scalars (id/code `key: value` rows) or a muted "no details" line. Footer: the raw event `type` in muted mono. No provenance, no items/moves/suggestions (platform payloads have none).

i18n `dashboard.admin.auditLog` (all five locales, parity; en source, Nordic drafts flagged): add `table.category`; `categories.{all,user,organization,membership,admin}`; `categoryFilterLabel`; `search.{placeholder,capped,empty}` (capped uses `{count}`); `loadMore`; `loadingMore`; `detail.{operator,target,when,category,changes,detailsHeading,removedHeading,emptyValue,noChanges,close,viewDetails}`. (Operator/Target are admin-specific; the rest mirror the org detail strings in the admin namespace so the admin component stays decoupled.) Preserve ICU `{count}`; edit JSON directly (no shell perl/sed); keep all five key sets identical; grep for mojibake.

Tests: extend `apps/dashboard/lib/audit-detail.test.ts` only if the shared extraction changes a signature; the admin section itself is not unit-tested (consistent with the org section). Verify `bun run test --filter=dashboard --filter=@workspace/backend --filter=@workspace/i18n` green, dashboard typecheck clean.

## Out of scope

The org log is already done; do not change its behavior. Do not store any PII in `platformAuditLog.searchText`.
