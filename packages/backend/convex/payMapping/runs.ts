import { v } from "convex/values"
import type { Doc } from "../_generated/dataModel"
import { deriveResults } from "../assessment/compute"
import { AUDIT_EVENTS, resolveActorName } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation, orgQuery } from "../lib/functions"
import { uniqueSlug } from "../lib/slug"
import { payMappingRunStatus } from "./tables"

const SYSTEM_VERSION = "v2-slice1"

// The pay record active at `asOf`: greatest effectiveAt <= asOf (mirrors
// getCurrentSalary's inner rule; raw Doc, not the wire shape).
function payRecordAt(
  rows: readonly Doc<"payRecords">[],
  asOf: number
): Doc<"payRecords"> | null {
  let current: Doc<"payRecords"> | null = null
  for (const row of rows) {
    if (
      row.effectiveAt <= asOf &&
      (current === null || row.effectiveAt > current.effectiveAt)
    ) {
      current = row
    }
  }
  return current
}

export const startPayMappingRun = orgMutation({
  args: { label: v.string() },
  returns: v.object({ runId: v.id("payMappingRuns"), slug: v.string() }),
  handler: async (ctx, { label }) => {
    const referenceDate = Date.now()
    const trimmed = label.trim()
    if (trimmed === "") throw appError(ERROR_CODES.invalidInput)
    const slug = await uniqueSlug(ctx, "payMappingRuns", ctx.orgId, trimmed)

    // Freeze the model config once (ADR-0008).
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    const criteriaRows = model
      ? await ctx.db
          .query("criteria")
          .withIndex("by_model", (q) => q.eq("modelId", model._id))
          .collect()
      : []
    const frozenModel = {
      criteria: criteriaRows.map((c) => ({
        name: c.name,
        weightPoints: c.weightPoints,
        anchorCount: c.anchors.length,
      })),
      bandThresholds: model?.bandThresholds ?? [],
    }

    // Derive band/score for every role once, index by roleId.
    const derived = await deriveResults(ctx, ctx.orgId)
    const bandByRole = new Map(derived.results.map((r) => [r.roleId, r]))

    // Roles for title/track lookup.
    const roleRows = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const roleById = new Map(roleRows.map((r) => [r._id as string, r]))

    // Population = active (non-archived) people with an open assignment.
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const active = people.filter((p) => p.archivedAt === undefined)

    const runId = await ctx.db.insert("payMappingRuns", {
      orgId: ctx.orgId,
      slug,
      label: trimmed,
      status: "active",
      referenceDate,
      initiatedBy: ctx.authUserId,
      initiatedAt: referenceDate,
      systemVersion: SYSTEM_VERSION,
      populationCount: 0,
      withPayCount: 0,
      unclassifiedExcludedCount: 0,
      frozenModel,
    })

    let populationCount = 0
    let withPayCount = 0
    let unclassifiedExcludedCount = 0

    for (const person of active) {
      const assignments = await ctx.db
        .query("personAssignments")
        .withIndex("by_person", (q) =>
          q.eq("orgId", ctx.orgId).eq("personId", person._id)
        )
        .collect()
      const open = assignments.find((a) => a.endedAt === undefined) ?? null
      if (open === null) {
        unclassifiedExcludedCount += 1
        continue
      }
      const role = roleById.get(open.roleId as string)
      const result = bandByRole.get(open.roleId as string)
      const payRows = await ctx.db
        .query("payRecords")
        .withIndex("by_person", (q) =>
          q.eq("orgId", ctx.orgId).eq("personId", person._id)
        )
        .collect()
      const pay = payRecordAt(payRows, referenceDate)
      if (pay !== null) withPayCount += 1

      await ctx.db.insert("payMappingSnapshotRows", {
        orgId: ctx.orgId,
        runId,
        personPublicId: person.publicId,
        displayName: person.displayName,
        erased: false,
        gender: person.gender,
        ...(person.birthDate !== undefined
          ? { birthDate: person.birthDate }
          : {}),
        ...(person.employmentType !== undefined
          ? { employmentType: person.employmentType }
          : {}),
        ...(person.department !== undefined
          ? { department: person.department }
          : {}),
        ...(person.ftePercent !== undefined
          ? { ftePercent: person.ftePercent }
          : {}),
        ...(person.employmentStartDate !== undefined
          ? { employmentStartDate: person.employmentStartDate }
          : {}),
        roleTitle: role?.title ?? "",
        trackKey: role?.trackKey ?? "",
        level: open.level,
        band: result?.band ?? null,
        score: result?.score ?? null,
        basicMonthly: pay?.basicMonthly ?? null,
        components: pay?.components ?? [],
        ...(pay?.currency !== undefined ? { currency: pay.currency } : {}),
        ...(pay?.payYear !== undefined ? { payYear: pay.payYear } : {}),
      })
      populationCount += 1
    }

    await ctx.db.patch(runId, {
      populationCount,
      withPayCount,
      unclassifiedExcludedCount,
    })
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingRunStarted,
      payload: {
        runId,
        populationCount,
        withPayCount,
        unclassifiedExcludedCount,
      },
    })
    return { runId, slug }
  },
})

const runSummary = v.object({
  runId: v.id("payMappingRuns"),
  slug: v.string(),
  label: v.string(),
  status: payMappingRunStatus,
  referenceDate: v.number(),
  initiatedBy: v.string(),
  initiatedByName: v.string(),
  populationCount: v.number(),
  withPayCount: v.number(),
})

export const listPayMappingRuns = orgQuery({
  args: {},
  returns: v.array(runSummary),
  handler: async (ctx) => {
    const runs = await ctx.db
      .query("payMappingRuns")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    runs.sort((a, b) => b.referenceDate - a.referenceDate) // newest first

    // Resolve each distinct initiator id to a name once (read time, so
    // erasure/renames stay accurate; never frozen onto the run row).
    const distinctIds = [...new Set(runs.map((r) => r.initiatedBy))]
    const nameById = new Map(
      await Promise.all(
        distinctIds.map(
          async (id) => [id, await resolveActorName(ctx, id)] as const
        )
      )
    )

    return runs.map((r) => ({
      runId: r._id,
      slug: r.slug,
      label: r.label,
      status: r.status,
      referenceDate: r.referenceDate,
      initiatedBy: r.initiatedBy,
      initiatedByName: nameById.get(r.initiatedBy) ?? "unknown",
      populationCount: r.populationCount,
      withPayCount: r.withPayCount,
    }))
  },
})

const snapshotRowShape = v.object({
  displayName: v.string(),
  erased: v.boolean(),
  gender: v.union(v.literal("Man"), v.literal("Kvinna")),
  roleTitle: v.string(),
  trackKey: v.string(),
  level: v.string(),
  band: v.union(v.number(), v.null()),
  basicMonthly: v.union(v.number(), v.null()),
  currency: v.optional(v.string()),
  payYear: v.optional(v.number()),
})

export const getPayMappingRunBySlug = orgQuery({
  args: { slug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      runId: v.id("payMappingRuns"),
      label: v.string(),
      status: payMappingRunStatus,
      referenceDate: v.number(),
      initiatedBy: v.string(),
      initiatedByName: v.string(),
      populationCount: v.number(),
      withPayCount: v.number(),
      unclassifiedExcludedCount: v.number(),
      populationNote: v.union(v.string(), v.null()),
      rows: v.array(snapshotRowShape),
    })
  ),
  handler: async (ctx, { slug }) => {
    const run = await ctx.db
      .query("payMappingRuns")
      .withIndex("by_org_slug", (q) =>
        q.eq("orgId", ctx.orgId).eq("slug", slug)
      )
      .first()
    if (run === null) return null
    const rows = await ctx.db
      .query("payMappingSnapshotRows")
      .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", run._id))
      .collect()
    const initiatedByName = await resolveActorName(ctx, run.initiatedBy)
    return {
      runId: run._id,
      label: run.label,
      status: run.status,
      referenceDate: run.referenceDate,
      initiatedBy: run.initiatedBy,
      initiatedByName,
      populationCount: run.populationCount,
      withPayCount: run.withPayCount,
      unclassifiedExcludedCount: run.unclassifiedExcludedCount,
      populationNote: run.populationNote ?? null,
      rows: rows.map((r) => ({
        displayName: r.displayName,
        erased: r.erased,
        gender: r.gender,
        roleTitle: r.roleTitle,
        trackKey: r.trackKey,
        level: r.level,
        band: r.band,
        basicMonthly: r.basicMonthly,
        ...(r.currency !== undefined ? { currency: r.currency } : {}),
        ...(r.payYear !== undefined ? { payYear: r.payYear } : {}),
      })),
    }
  },
})

// View-logging (ADR-0011 section 3). A mutation, called by the detail page on
// mount. Not audited via ctx.audit: this is the separate access dimension.
export const logPayMappingView = orgMutation({
  args: { runId: v.id("payMappingRuns") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    await ctx.db.insert("payMappingAccessLog", {
      orgId: ctx.orgId,
      runId,
      actorId: ctx.authUserId,
      at: Date.now(),
      kind: "view",
    })
    return null
  },
})
