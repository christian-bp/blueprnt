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

// The stored side of previewImport's dry-run diff: every active person that
// carries an externalRef (the import upsert key), with the import-diffable
// fields and the newest pay record's values. Bounded by headcount, same as
// listPeopleByTitle. Called by the previewImport action via ctx.runQuery.
export const getImportBaseline = internalQuery({
  args: { orgId: v.string() },
  returns: v.array(
    v.object({
      externalRef: v.string(),
      displayName: v.string(),
      gender: v.union(v.literal("Man"), v.literal("Kvinna")),
      birthDate: v.optional(v.string()),
      employmentStartDate: v.optional(v.string()),
      ftePercent: v.optional(v.number()),
      country: v.optional(v.string()),
      isManager: v.optional(v.boolean()),
      statisticalCode: v.optional(v.string()),
      department: v.optional(v.string()),
      title: v.optional(v.string()),
      latestSalary: v.union(
        v.object({
          payYear: v.number(),
          basicMonthly: v.number(),
          currency: v.string(),
          components: v.array(
            v.object({ kind: v.string(), monthlyAmount: v.number() })
          ),
        }),
        v.null()
      ),
    })
  ),
  handler: async (ctx, { orgId }) => {
    const people = (
      await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    ).filter((p) => p.archivedAt === undefined && p.externalRef !== undefined)

    const result = []
    for (const person of people) {
      const latest = await ctx.db
        .query("payRecords")
        .withIndex("by_person", (q) =>
          q.eq("orgId", orgId).eq("personId", person._id)
        )
        .order("desc")
        .first()
      result.push({
        // The filter above guarantees externalRef; the fallback narrows the type.
        externalRef: person.externalRef ?? "",
        displayName: person.displayName,
        gender: person.gender,
        ...(person.birthDate !== undefined
          ? { birthDate: person.birthDate }
          : {}),
        ...(person.employmentStartDate !== undefined
          ? { employmentStartDate: person.employmentStartDate }
          : {}),
        ...(person.ftePercent !== undefined
          ? { ftePercent: person.ftePercent }
          : {}),
        ...(person.country !== undefined ? { country: person.country } : {}),
        ...(person.isManager !== undefined
          ? { isManager: person.isManager }
          : {}),
        ...(person.statisticalCode !== undefined
          ? { statisticalCode: person.statisticalCode }
          : {}),
        ...(person.department !== undefined
          ? { department: person.department }
          : {}),
        ...(person.title !== undefined ? { title: person.title } : {}),
        latestSalary:
          latest !== null
            ? {
                payYear: latest.payYear,
                basicMonthly: latest.basicMonthly,
                currency: latest.currency,
                components: latest.components,
              }
            : null,
      })
    }
    return result
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
