import { v } from "convex/values"
import { internalMutation, internalQuery } from "../_generated/server"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"
import type { AuditPayloads } from "../lib/auditPayloads"
import { orgQuery } from "../lib/functions"

// Returns the org's configured currency, or "SEK" as a safe default.
// Called by the importPayroll action via ctx.runQuery.
export const getOrgCurrency = internalQuery({
  args: { orgId: v.string() },
  returns: v.string(),
  handler: async (ctx, { orgId }) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique()
    return org?.currency ?? "SEK"
  },
})

// Writes the people.imported audit row from inside a mutation transaction.
// Actions have no ctx.db and therefore cannot call logAudit directly, so the
// import action delegates here via ctx.runMutation. Counts only: no PII, no
// salary amounts (GDPR constraint from the plan).
export const logImportCompleted = internalMutation({
  args: {
    orgId: v.string(),
    actorId: v.string(),
    peopleCreated: v.number(),
    peopleUpdated: v.number(),
    peopleUnchanged: v.number(),
    salariesImported: v.number(),
    skippedRows: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payload: AuditPayloads["people.imported"] = {
      peopleCreated: args.peopleCreated,
      peopleUpdated: args.peopleUpdated,
      peopleUnchanged: args.peopleUnchanged,
      salariesImported: args.salariesImported,
      skippedRows: args.skippedRows,
    }
    await logAudit(ctx, {
      orgId: args.orgId,
      type: AUDIT_EVENTS.importCompleted,
      actorId: args.actorId,
      payload,
    })
    return null
  },
})

// Upserts the org's live import-progress row. Called by the importPayroll
// action as it processes rows so the importing screen can show real counts.
export const setImportProgress = internalMutation({
  args: {
    orgId: v.string(),
    importId: v.string(),
    processed: v.number(),
    total: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("importProgress")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .unique()
    if (existing === null) {
      await ctx.db.insert("importProgress", {
        orgId: args.orgId,
        importId: args.importId,
        processed: args.processed,
        total: args.total,
      })
    } else {
      await ctx.db.patch(existing._id, {
        importId: args.importId,
        processed: args.processed,
        total: args.total,
      })
    }
    return null
  },
})

// Removes the org's import-progress row when the import finishes.
export const clearImportProgress = internalMutation({
  args: { orgId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("importProgress")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .unique()
    if (existing !== null) {
      await ctx.db.delete(existing._id)
    }
    return null
  },
})

// The live progress of the caller's import run, or null when that run has
// not reported yet. Scoped by importId so a stale row from an earlier
// (e.g. abandoned) run is never shown for a new one. The importing screen
// subscribes to this reactively.
export const getImportProgress = orgQuery({
  args: { importId: v.string() },
  returns: v.union(
    v.object({ processed: v.number(), total: v.number() }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("importProgress")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (row === null || row.importId !== args.importId) return null
    return { processed: row.processed, total: row.total }
  },
})
