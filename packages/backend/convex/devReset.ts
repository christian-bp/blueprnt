import { v } from "convex/values"
import type { TableNames } from "./_generated/dataModel"
import { internalMutation } from "./_generated/server"
import {
  backfillAuditAggregates,
  clearAuditAggregates,
} from "./lib/auditAggregates"

// Dev-only database wipe. This mutation is internal and never internet-exposed,
// but it must ONLY ever be reached via seed:resetDatabase, the "use node" action
// that carries the SITE_URL-localhost guard. Do not call it from any other path
// and never expose it publicly: it unconditionally deletes every app-side row.

// Every table declared in convex/schema.ts.
const APP_TABLES = [
  "users",
  "organizations",
  "auditLog",
  "platformAuditLog",
  "models",
  "criteria",
  "roleFamilies",
  "roles",
  "ratings",
  "suggestions",
  "aiUsageEvents",
  "aiUsageMonthly",
  "assistantThreads",
  "assistantMessages",
  "people",
  "personAssignments",
  "payRecords",
  "importMappingProfiles",
  "importProgress",
  "payMappingRuns",
  "payMappingSnapshotRows",
  "payMappingGroupAnalyses",
  "payMappingActions",
  "payMappingNotes",
] as const satisfies readonly TableNames[]

// `satisfies readonly TableNames[]` above only checks that every name LISTED is
// a real table. It says nothing about the other direction, so the list silently
// fell twelve tables behind the schema and a "reset" left people, pay records
// and every pay-mapping row in place. This asserts the direction that actually
// matters: if a schema table is missing from APP_TABLES, `Exclude` resolves to
// that table's name instead of `never` and the constraint fails, naming it.
type AssertNever<T extends never> = T
type _EveryTableIsWiped = AssertNever<
  Exclude<TableNames, (typeof APP_TABLES)[number]>
>

// Delete at most this many rows per table per invocation so a single mutation
// stays under Convex's per-transaction write limit. The caller (resetDatabase)
// loops until done; dev-scale data finishes in one pass.
const PAGE_SIZE = 500

export const wipeAppTables = internalMutation({
  args: {},
  returns: v.object({ done: v.boolean() }),
  handler: async (ctx) => {
    let truncated = false
    for (const table of APP_TABLES) {
      const rows = await ctx.db.query(table).take(PAGE_SIZE)
      for (const row of rows) {
        await ctx.db.delete(row._id)
      }
      // A full page means there may be more rows in this table; keep looping.
      if (rows.length === PAGE_SIZE) {
        truncated = true
      }
    }
    // The audit pager's count/offset aggregates mirror auditLog; a reset that
    // wiped the rows but kept the aggregate nodes would leave phantom pages.
    // clearAll is cheap and idempotent, so it runs on every pass.
    await clearAuditAggregates(ctx)
    return { done: !truncated }
  },
})

// One-time dev backfill: registers every pre-existing auditLog row in the
// pager's count/offset aggregates (rows written after the aggregates shipped
// register themselves in logAudit). Idempotent (insertIfDoesNotExist) and
// paged by cursor; run repeatedly from the CLI until it reports done:
//   npx convex run devReset:backfillAuditLogAggregates '{}'
//   npx convex run devReset:backfillAuditLogAggregates '{"cursor": "<continueCursor>"}'
// Dev-only tooling: production starts from a go-live reset, where logAudit
// maintains the aggregates from the first row.
export const backfillAuditLogAggregates = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.object({
    done: v.boolean(),
    processed: v.number(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("auditLog")
      .paginate({ numItems: PAGE_SIZE, cursor: args.cursor ?? null })
    for (const row of page.page) {
      await backfillAuditAggregates(ctx, row)
    }
    return {
      done: page.isDone,
      processed: page.page.length,
      continueCursor: page.continueCursor,
    }
  },
})
