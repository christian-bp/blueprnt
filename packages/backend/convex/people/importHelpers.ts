import { v } from "convex/values"
import type { MutationCtx } from "../_generated/server"
import { internalMutation, internalQuery } from "../_generated/server"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"
import type { AuditPayloads } from "../lib/auditPayloads"
import { orgQuery } from "../lib/functions"
import { readOrgPayDefaults } from "./fullTimeHours"
import {
  archivePeopleCore,
  personImportOptionalArgs,
  upsertPersonByExternalRefCore,
} from "./people"
import { appendSalaryCore, payComponentValidator } from "./pay"
import { basePayBasis } from "./tables"

// The org's pay defaults (currency, country, org-level full-time hours).
// Called by the importPayroll/previewImport actions via ctx.runQuery: the
// import's currency fallback and its plausibility bounds both derive from
// the currency, so one round trip covers both.
export const getOrgPayDefaults = internalQuery({
  args: { orgId: v.string() },
  returns: v.object({
    currency: v.string(),
    country: v.optional(v.string()),
    fullTimeHoursPerMonth: v.optional(v.number()),
  }),
  handler: (ctx, { orgId }) => readOrgPayDefaults(ctx, orgId),
})

// The stored side of previewImport's dry-run diff: every person that carries
// an externalRef (the import upsert key), archived ones included (the diff
// needs them to tell a returning person from a new one), with the
// import-diffable fields and the newest pay record's values. Bounded by
// headcount, same as listPeopleByTitle. Called by the previewImport action
// via ctx.runQuery.
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
      fullTimeHoursPerMonth: v.optional(v.number()),
      country: v.optional(v.string()),
      isManager: v.optional(v.boolean()),
      statisticalCode: v.optional(v.string()),
      department: v.optional(v.string()),
      title: v.optional(v.string()),
      employmentType: v.optional(
        v.union(
          v.literal("permanent"),
          v.literal("fixedTerm"),
          v.literal("substitute"),
          v.literal("hourly")
        )
      ),
      archivedAt: v.optional(v.number()),
      latestSalary: v.union(
        v.object({
          payYear: v.number(),
          basis: basePayBasis,
          basicAmount: v.number(),
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
    ).filter((p) => p.externalRef !== undefined)

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
        ...(person.fullTimeHoursPerMonth !== undefined
          ? { fullTimeHoursPerMonth: person.fullTimeHoursPerMonth }
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
        ...(person.employmentType !== undefined
          ? { employmentType: person.employmentType }
          : {}),
        ...(person.archivedAt !== undefined
          ? { archivedAt: person.archivedAt }
          : {}),
        latestSalary:
          latest !== null
            ? {
                payYear: latest.payYear,
                basis: latest.basis,
                basicAmount: latest.basicAmount,
                currency: latest.currency,
                components: latest.components,
              }
            : null,
      })
    }
    return result
  },
})

// Every active person that carries an employee number: the set the import
// subtracts the file's rows from to find leavers. Bounded by headcount.
export const getActiveExternalRefs = internalQuery({
  args: { orgId: v.string() },
  returns: v.array(
    v.object({ personId: v.id("people"), externalRef: v.string() })
  ),
  handler: async (ctx, { orgId }) => {
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect()
    return people
      .filter((p) => p.archivedAt === undefined && p.externalRef !== undefined)
      .map((p) => ({ personId: p._id, externalRef: p.externalRef ?? "" }))
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
    peopleArchived: v.number(),
    peopleReactivated: v.number(),
    hourlyPay: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payload: AuditPayloads["people.imported"] = {
      peopleCreated: args.peopleCreated,
      peopleUpdated: args.peopleUpdated,
      peopleUnchanged: args.peopleUnchanged,
      salariesImported: args.salariesImported,
      skippedRows: args.skippedRows,
      peopleArchived: args.peopleArchived,
      peopleReactivated: args.peopleReactivated,
      hourlyPay: args.hourlyPay,
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

// Core of the progress upsert, shared by the standalone mutation below and
// the chunk mutation, which writes its progress in the SAME transaction as
// the chunk's rows, so the bar can only ever show committed counts.
async function setImportProgressCore(
  ctx: MutationCtx,
  args: { orgId: string; importId: string; processed: number; total: number }
): Promise<void> {
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
}

// One normalized import row, mirroring importDiff's NormalizedImportRow (the
// action passes its normalized rows straight through, so a drift here is a
// compile error at that call site). The person fields reuse the same
// validators the single-row upsert takes.
const importRowValidator = v.object({
  externalRef: v.string(),
  person: v.object({
    displayName: v.string(),
    gender: v.union(v.literal("Man"), v.literal("Kvinna")),
    ...personImportOptionalArgs,
  }),
  salary: v.union(
    v.null(),
    v.object({
      payYear: v.number(),
      basis: basePayBasis,
      basicAmount: v.number(),
      currency: v.string(),
      components: v.array(payComponentValidator),
    })
  ),
})

// One chunk of the payroll import, committed as ONE transaction: every row's
// person upsert and salary append, plus the progress row, land together. The
// old shape ran two mutations PER ROW from the action, which made a large
// import mostly transaction round trips; the chunk brings a thousand-person
// import from ~2000 mutations to ~20. The action owns the chunk size
// (IMPORT_CHUNK_SIZE in importDiff.ts) and drives chunks sequentially, so a
// failure mid-import leaves whole committed chunks behind and a re-run
// finishes the rest (both cores are idempotent re-appliers).
export const importChunk = internalMutation({
  args: {
    orgId: v.string(),
    actorId: v.string(),
    importId: v.string(),
    // One shared stamp for the whole run, so every chunk's salaries carry
    // the same effective time.
    effectiveAt: v.number(),
    // Rows committed by earlier chunks, for the progress row.
    processedBefore: v.number(),
    total: v.number(),
    rows: v.array(importRowValidator),
  },
  returns: v.object({
    peopleCreated: v.number(),
    peopleUpdated: v.number(),
    peopleUnchanged: v.number(),
    peopleReactivated: v.number(),
    salariesImported: v.number(),
    hourlyPay: v.number(),
  }),
  handler: async (ctx, args) => {
    let peopleCreated = 0
    let peopleUpdated = 0
    let peopleUnchanged = 0
    let peopleReactivated = 0
    let salariesImported = 0
    let hourlyPay = 0

    for (const row of args.rows) {
      const { personId, outcome, reactivated } =
        await upsertPersonByExternalRefCore(ctx, {
          orgId: args.orgId,
          actorId: args.actorId,
          externalRef: row.externalRef,
          ...row.person,
        })
      if (outcome === "created") {
        peopleCreated += 1
      } else if (outcome === "updated") {
        peopleUpdated += 1
      } else {
        peopleUnchanged += 1
      }
      if (reactivated) {
        peopleReactivated += 1
      }

      if (row.salary === null) continue
      const { created } = await appendSalaryCore(ctx, {
        orgId: args.orgId,
        actorId: args.actorId,
        personId,
        ...row.salary,
        effectiveAt: args.effectiveAt,
      })
      // Identical re-imports skip the append; count only real inserts.
      if (created) {
        salariesImported += 1
        if (row.salary.basis === "hourly") {
          hourlyPay += 1
        }
      }
    }

    await setImportProgressCore(ctx, {
      orgId: args.orgId,
      importId: args.importId,
      processed: args.processedBefore + args.rows.length,
      total: args.total,
    })

    return {
      peopleCreated,
      peopleUpdated,
      peopleUnchanged,
      peopleReactivated,
      salariesImported,
      hourlyPay,
    }
  },
})

// One chunk of the import's leaver archiving, committed as ONE transaction
// together with its progress write, exactly like importChunk. The action
// drives chunks of PEOPLE_ARCHIVE_CHUNK_SIZE sequentially after the row
// chunks, so the importing screen keeps counting past the last row.
export const archiveChunk = internalMutation({
  args: {
    orgId: v.string(),
    actorId: v.string(),
    importId: v.string(),
    personIds: v.array(v.id("people")),
    processedBefore: v.number(),
    total: v.number(),
  },
  returns: v.object({ archived: v.number() }),
  handler: async (ctx, args) => {
    const { archived } = await archivePeopleCore(ctx, {
      orgId: args.orgId,
      actorId: args.actorId,
      personIds: args.personIds,
    })
    await setImportProgressCore(ctx, {
      orgId: args.orgId,
      importId: args.importId,
      processed: args.processedBefore + args.personIds.length,
      total: args.total,
    })
    return { archived }
  },
})

// Upserts the org's live import-progress row. Called by the importPayroll
// action before the first chunk (the 0/total setup state); the chunks
// themselves write progress through the shared core above.
export const setImportProgress = internalMutation({
  args: {
    orgId: v.string(),
    importId: v.string(),
    processed: v.number(),
    total: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await setImportProgressCore(ctx, args)
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
