import { v } from "convex/values"
import { internalMutation, internalQuery } from "../_generated/server"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"
import type { AuditPayloads } from "../lib/auditPayloads"

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
    peopleImported: v.number(),
    salariesImported: v.number(),
    skippedRows: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payload: AuditPayloads["people.imported"] = {
      peopleImported: args.peopleImported,
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
