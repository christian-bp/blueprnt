import { TableAggregate } from "@convex-dev/aggregate"
import type { GenericMutationCtx, GenericQueryCtx } from "convex/server"
import { components } from "../_generated/api"
import type { DataModel, Doc } from "../_generated/dataModel"

// Generic ctx types (like lib/audit.ts uses) so both MutationCtx and trigger
// handler contexts are assignable; the component's methods only need the
// structural runQuery/runMutation surface.
type MutationCtx = GenericMutationCtx<DataModel>
type QueryCtx = GenericQueryCtx<DataModel>

// Count/offset aggregates over the append-only auditLog, one per display
// ordering the pager offers: the whole org's trail in time order, and each
// (org, category) slice in time order. They give the audit pager an exact
// total and O(log n) jump-to-page over a table Convex cannot cheaply count
// or offset into. Both are maintained by logAudit (the single audit writer);
// devReset clears them; the trail is append-only, so no delete/replace hooks
// exist. Erasure patches rewrite actorName, payload identity values, and
// searchText, but never the sort key (_creationTime) or namespace, so erasure
// needs no aggregate hook either.
// The aggregates store only namespaces and _creationTime keys, never row
// content, so no PII can reach them by construction.

export const auditAggregateByOrg = new TableAggregate<{
  Key: number
  DataModel: DataModel
  TableName: "auditLog"
  Namespace: string
}>(components.auditAggregateByOrg, {
  namespace: (doc) => doc.orgId,
  sortKey: (doc) => doc._creationTime,
})

// Namespace for the per-category aggregate. The org id and category are
// joined with "|" purely to form a unique namespace value; it is never
// parsed back. Rows written before the category field existed bucket under
// the sentinel, mirroring how the category filter cannot surface them.
export function auditCategoryNamespace(
  orgId: string,
  category: string | undefined
): string {
  return `${orgId}|${category ?? "uncategorized"}`
}

export const auditAggregateByCategory = new TableAggregate<{
  Key: number
  DataModel: DataModel
  TableName: "auditLog"
  Namespace: string
}>(components.auditAggregateByCategory, {
  namespace: (doc) => auditCategoryNamespace(doc.orgId, doc.category),
  sortKey: (doc) => doc._creationTime,
})

// Registers a freshly inserted audit row in both aggregates. Called by
// logAudit in the same transaction as the insert, so the counts can never
// drift from the table.
export async function insertAuditAggregates(
  ctx: MutationCtx,
  doc: Doc<"auditLog">
): Promise<void> {
  await auditAggregateByOrg.insert(ctx, doc)
  await auditAggregateByCategory.insert(ctx, doc)
}

// Idempotent variant for the one-time dev backfill over pre-existing rows.
export async function backfillAuditAggregates(
  ctx: MutationCtx,
  doc: Doc<"auditLog">
): Promise<void> {
  await auditAggregateByOrg.insertIfDoesNotExist(ctx, doc)
  await auditAggregateByCategory.insertIfDoesNotExist(ctx, doc)
}

// Unregisters a row being hard-deleted. The trail is append-only in
// production; the only deleter is the dev-only seeded-org removal
// (accounts/mirrors.ts), whose rows may predate the aggregates, hence the
// idempotent variant.
export async function removeAuditAggregates(
  ctx: MutationCtx,
  doc: Doc<"auditLog">
): Promise<void> {
  await auditAggregateByOrg.deleteIfExists(ctx, doc)
  await auditAggregateByCategory.deleteIfExists(ctx, doc)
}

// Drops every aggregate node across all namespaces (devReset, which also
// deletes the auditLog rows themselves).
export async function clearAuditAggregates(ctx: MutationCtx): Promise<void> {
  await auditAggregateByOrg.clearAll(ctx)
  await auditAggregateByCategory.clearAll(ctx)
}

// Inclusive _creationTime bounds for a count/at call, from the pager's
// optional epoch-ms range.
function timeBounds(start: number | undefined, end: number | undefined) {
  return {
    ...(start !== undefined
      ? { lower: { key: start, inclusive: true as const } }
      : {}),
    ...(end !== undefined
      ? { upper: { key: end, inclusive: true as const } }
      : {}),
  }
}

// Resolves one audit page's coordinates: how many rows match
// (org [, category]) within the inclusive time range, and the _creationTime
// of the row the page starts at, newest first (`offset` rows from the top).
// pageStart is null when the offset lies past the last row (the caller
// renders an empty page and the client clamps).
export async function locateAuditPage(
  ctx: QueryCtx,
  args: {
    orgId: string
    category: string | null
    start: number | undefined
    end: number | undefined
    offset: number
  }
): Promise<{ total: number; pageStart: number | null }> {
  const aggregate =
    args.category !== null ? auditAggregateByCategory : auditAggregateByOrg
  const namespace =
    args.category !== null
      ? auditCategoryNamespace(args.orgId, args.category)
      : args.orgId
  const bounds = timeBounds(args.start, args.end)
  const total = await aggregate.count(ctx, { namespace, bounds })
  if (args.offset >= total) return { total, pageStart: null }
  // Zero-indexed from the end of the key range: at(-1) is the newest row in
  // bounds, so the page's first (newest) row sits at -(offset + 1).
  const { key } = await aggregate.at(ctx, -(args.offset + 1), {
    namespace,
    bounds,
  })
  return { total, pageStart: key }
}
