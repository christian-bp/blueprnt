import {
  BASE_PRAXIS_AREA_KEYS,
  PRAXIS_AREA_KEYS,
  type PraxisAreaKey,
} from "@workspace/constants"
import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import type {
  DatabaseReader,
  MutationCtx,
  QueryCtx,
} from "../_generated/server"
import { deriveResults } from "../assessment/compute"
import { AUDIT_EVENTS, resolveActorName } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation, orgQuery } from "../lib/functions"
import { uniqueSlug } from "../lib/slug"
import { requiredDocumentationKeys } from "./gap"
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

// One role blocking the gate: staffed (holds at least one open assignment)
// but not fully evaluated (resolves no band).
export type PreconditionRole = {
  roleId: Id<"roles">
  title: string
  slug: string
}

export type PayMappingPreconditions = {
  peopleCount: number
  unclassifiedCount: number
  unevaluatedRoles: PreconditionRole[]
  ready: boolean
}

// The DL 3 kap. preconditions a kartläggning must satisfy before it can
// start: every active person carries a confirmed open assignment to an
// ACTIVE role ("classified" = confirmed AND the role still exists and is
// not archived; the same definition listPeopleByTitle's currentAssignment,
// countClassified, the people-tab badge, and the to-do's classify group all
// use), and every ACTIVE role holding at least one open assignment
// ("staffed") resolves a band (complete evaluation, the same deriveResults
// resolution the frozen snapshot reads). An unstaffed role's evaluation
// state never blocks. Shared by startPayMappingRun's server-side gate and
// getPayMappingPreconditions so the two can never fork. Archived roles are
// excluded from BOTH checks: from the staffed-evaluation check because
// deriveResults never resolves a band for them (so they can never block),
// and from the classified check because a confirmed open assignment to an
// archived (or otherwise missing) role is NOT a real classification -- it
// counts toward unclassifiedCount, same as no assignment at all. archiveRole
// normally ends a role's open assignments at archive time (assessment/
// roles.ts), so this only guards a pre-existing stale row, not the everyday
// path.
export async function computePayMappingPreconditions(
  ctx: QueryCtx | MutationCtx,
  orgId: string
): Promise<PayMappingPreconditions> {
  const people = await ctx.db
    .query("people")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect()
  const active = people.filter((p) => p.archivedAt === undefined)

  const derived = await deriveResults(ctx, orgId)
  const bandByRole = new Map(derived.results.map((r) => [r.roleId, r]))

  const roleRows = await ctx.db
    .query("roles")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect()
  const activeRoleById = new Map(
    roleRows
      .filter((r) => r.archivedAt === undefined)
      .map((r) => [r._id as string, r])
  )

  let unclassifiedCount = 0
  const staffedRoleIds = new Set<string>()
  for (const person of active) {
    const assignments = await ctx.db
      .query("personAssignments")
      .withIndex("by_person", (q) =>
        q.eq("orgId", orgId).eq("personId", person._id)
      )
      .collect()
    const open = assignments.find((a) => a.endedAt === undefined) ?? null
    if (
      open === null ||
      open.levelSource !== "confirmed" ||
      !activeRoleById.has(open.roleId as string)
    ) {
      unclassifiedCount += 1
    }
    if (open !== null) staffedRoleIds.add(open.roleId as string)
  }

  const unevaluatedRoles: PreconditionRole[] = [...staffedRoleIds]
    .map((roleId) => activeRoleById.get(roleId))
    .filter((role): role is Doc<"roles"> => role !== undefined)
    .filter(
      (role) => (bandByRole.get(role._id as string)?.band ?? null) === null
    )
    .map((role) => ({ roleId: role._id, title: role.title, slug: role.slug }))
    .sort((a, b) => a.title.localeCompare(b.title))

  return {
    peopleCount: active.length,
    unclassifiedCount,
    unevaluatedRoles,
    // An org with no people at all is never ready: DL 3 kap. maps employees,
    // so an empty population must import before anything can start.
    ready:
      active.length > 0 &&
      unclassifiedCount === 0 &&
      unevaluatedRoles.length === 0,
  }
}

const preconditionRoleShape = v.object({
  roleId: v.id("roles"),
  title: v.string(),
  slug: v.string(),
})

// Read-only precondition check for the create surface's guidance panel. The
// mutation below re-derives the identical check server-side; this query is
// convenience, never the authority.
export const getPayMappingPreconditions = orgQuery({
  args: {},
  returns: v.object({
    peopleCount: v.number(),
    unclassifiedCount: v.number(),
    unevaluatedRoles: v.array(preconditionRoleShape),
    ready: v.boolean(),
  }),
  handler: async (ctx) => computePayMappingPreconditions(ctx, ctx.orgId),
})

export const startPayMappingRun = orgMutation({
  args: { label: v.string() },
  returns: v.object({ runId: v.id("payMappingRuns"), slug: v.string() }),
  handler: async (ctx, { label }) => {
    const referenceDate = Date.now()
    const trimmed = label.trim()
    if (trimmed === "") throw appError(ERROR_CODES.invalidInput)

    // Server-side authority: the client's precondition panel is convenience,
    // this check is the gate. DL 3 kap. requires the kartläggning to cover
    // every employee, so a run cannot start while anyone is unclassified or
    // any staffed role is unevaluated.
    const preconditions = await computePayMappingPreconditions(ctx, ctx.orgId)
    if (!preconditions.ready) {
      throw appError(ERROR_CODES.payMappingPreconditionsUnmet)
    }

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
      frozenModel,
    })

    let populationCount = 0
    let withPayCount = 0

    for (const person of active) {
      const assignments = await ctx.db
        .query("personAssignments")
        .withIndex("by_person", (q) =>
          q.eq("orgId", ctx.orgId).eq("personId", person._id)
        )
        .collect()
      // The precondition gate above guarantees every active person carries a
      // confirmed open assignment; this find is defensive only.
      const open = assignments.find((a) => a.endedAt === undefined) ?? null
      if (open === null) continue
      const role = roleById.get(open.roleId as string)
      // The gate above (computePayMappingPreconditions) already counts a
      // confirmed open assignment to an archived/missing role as
      // unclassified and rejects the run before this loop ever starts, so a
      // band-less row is impossible by construction past this point.
      // Reaching this with one means the gate and this loop have diverged:
      // fail loud rather than silently freezing the exact band-less row the
      // gate exists to prevent (the C1 defect). Mirrors the classifyOrg
      // invariant throw (people/classification.ts): a plain Error, not an
      // appError code, since this guards an internal programming error, not
      // a condition a user can trigger or that needs a translated message.
      if (role === undefined || role.archivedAt !== undefined) {
        throw new Error(
          `startPayMappingRun invariant: person ${person._id} has an open assignment to archived/missing role ${open.roleId}, which should be unreachable past the preconditions gate`
        )
      }
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
    })
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingRunStarted,
      payload: {
        runId,
        populationCount,
        withPayCount,
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
  birthDate: v.optional(v.string()),
  employmentStartDate: v.optional(v.string()),
  ftePercent: v.optional(v.number()),
  roleTitle: v.string(),
  trackKey: v.string(),
  level: v.string(),
  band: v.union(v.number(), v.null()),
  basicMonthly: v.union(v.number(), v.null()),
  components: v.array(
    v.object({ kind: v.string(), monthlyAmount: v.number() })
  ),
  currency: v.optional(v.string()),
  payYear: v.optional(v.number()),
})

export const getPayMappingRunBySlug = orgQuery({
  args: { slug: v.string() },
  // Deliberately lean: only what the run workspace consumes (the shell's
  // page title + gap-query key, the header switcher's identity, the analysis
  // member rows, the scatter's per-row age/tenure/FTE/pay-breakdown computed
  // at the frozen referenceDate, and the review journey's start step, which
  // needs collaboration to compute its done state). The list page reads the
  // run metadata from listPayMappingRuns instead; a field returns here when a
  // surface needs it, not before.
  returns: v.union(
    v.null(),
    v.object({
      runId: v.id("payMappingRuns"),
      label: v.string(),
      status: payMappingRunStatus,
      referenceDate: v.number(),
      rows: v.array(snapshotRowShape),
      collaboration: v.union(
        v.object({ participants: v.string(), description: v.string() }),
        v.null()
      ),
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
    return {
      runId: run._id,
      label: run.label,
      status: run.status,
      referenceDate: run.referenceDate,
      collaboration: run.collaboration ?? null,
      rows: rows.map((r) => ({
        displayName: r.displayName,
        erased: r.erased,
        gender: r.gender,
        ...(r.birthDate !== undefined ? { birthDate: r.birthDate } : {}),
        ...(r.employmentStartDate !== undefined
          ? { employmentStartDate: r.employmentStartDate }
          : {}),
        ...(r.ftePercent !== undefined ? { ftePercent: r.ftePercent } : {}),
        roleTitle: r.roleTitle,
        trackKey: r.trackKey,
        level: r.level,
        band: r.band,
        basicMonthly: r.basicMonthly,
        components: r.components,
        ...(r.currency !== undefined ? { currency: r.currency } : {}),
        ...(r.payYear !== undefined ? { payYear: r.payYear } : {}),
      })),
    }
  },
})

// The praxis review areas (DL 3 kap. 8 § p1) applicable to THIS run:
// BASE_PRAXIS_AREA_KEYS always, plus previousActions once the org has an
// earlier COMPLETED kartläggning to evaluate. The documentation's evaluation
// duty (did last year's actions get carried out, and did they have the
// intended effect) only exists once there IS a previous year's run to
// evaluate; a first-ever kartläggning has nothing to look back on. Exported
// so the review-journey UI's client-side applicability check (a later task)
// and tests can compute the identical set without re-deriving the rule. Kept
// deliberately simple: any earlier completed run with an earlier reference
// date qualifies, not "the most recent one" or any richer lineage.
export async function applicablePraxisKeys(
  ctx: { db: DatabaseReader; orgId: string },
  run: Doc<"payMappingRuns">
): Promise<readonly PraxisAreaKey[]> {
  const orgRuns = await ctx.db
    .query("payMappingRuns")
    .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
    .collect()
  const hasEarlierCompletedRun = orgRuns.some(
    (other) =>
      other._id !== run._id &&
      other.status === "completed" &&
      other.referenceDate < run.referenceDate
  )
  return hasEarlierCompletedRun ? PRAXIS_AREA_KEYS : BASE_PRAXIS_AREA_KEYS
}

// The ADR-0012 completion gate: a kartläggning reaches Slutförd only when
// every group the analysis requires documentation for is marked done, the
// samverkansredogörelse (collaboration) is filled in, and every applicable
// praxis review area is marked done. The requirement set is recomputed here
// from the frozen snapshot (+ the org's run history for praxis
// applicability); the client's progress card is a preview, never the
// authority.
export const completePayMappingRun = orgMutation({
  args: { runId: v.id("payMappingRuns") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    if (run.status !== "active") throw appError(ERROR_CODES.invalidTransition)

    const rows = await ctx.db
      .query("payMappingSnapshotRows")
      .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", runId))
      .collect()
    const keys = requiredDocumentationKeys(rows)
    const analyses = await ctx.db
      .query("payMappingGroupAnalyses")
      .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", runId))
      .collect()
    const doneKeys = (scope: "equalWork" | "equivalentWork" | "praxis") =>
      new Set(
        analyses
          .filter((row) => row.scope === scope && row.done)
          .map((row) => row.groupKey)
      )
    const equalWorkDone = doneKeys("equalWork")
    const equivalentWorkDone = doneKeys("equivalentWork")
    const praxisDone = doneKeys("praxis")
    const praxisRequired = await applicablePraxisKeys(ctx, run)
    const collaborationFilled =
      run.collaboration !== undefined &&
      run.collaboration.participants.trim() !== "" &&
      run.collaboration.description.trim() !== ""
    const unmet =
      [...keys.equalWorkRequired].some((key) => !equalWorkDone.has(key)) ||
      [...keys.womenDominatedRequired].some(
        (key) => !equivalentWorkDone.has(key)
      ) ||
      praxisRequired.some((key) => !praxisDone.has(key)) ||
      !collaborationFilled
    if (unmet) throw appError(ERROR_CODES.payMappingGateUnmet)

    await ctx.db.patch(runId, { status: "completed" })
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingRunCompleted,
      payload: {
        runId,
        equalWorkDone: equalWorkDone.size,
        equivalentWorkDone: equivalentWorkDone.size,
      },
    })
    return null
  },
})

// The samverkansredogörelse (DL 3 kap. 11-14 §§): who the employer
// cooperated with and how. Trims both fields; when both are empty after
// trim, clears the field entirely (never stores an empty-string object).
// AUDIT PRIVACY: participants are people's names by design (statutory
// documentation content on this run document), so the trail logs a pure
// { runId } marker only, mirroring reopenPayMappingRun's precedent; the
// names themselves must NEVER enter the audit payload/searchText.
export const setPayMappingCollaboration = orgMutation({
  args: {
    runId: v.id("payMappingRuns"),
    participants: v.string(),
    description: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { runId, participants, description }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    if (run.status === "completed")
      throw appError(ERROR_CODES.payMappingRunCompleted)

    const trimmedParticipants = participants.trim()
    const trimmedDescription = description.trim()
    if (trimmedParticipants === "" && trimmedDescription === "") {
      await ctx.db.patch(runId, { collaboration: undefined })
    } else {
      await ctx.db.patch(runId, {
        collaboration: {
          participants: trimmedParticipants,
          description: trimmedDescription,
        },
      })
    }
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingCollaborationUpdated,
      payload: { runId },
    })
    return null
  },
})

// Hard-deletes a pay-mapping run and every child row that references it,
// child-first: payMappingSnapshotRows and payMappingGroupAnalyses are the
// only two tables that carry a runId (payMapping/tables.ts's by_run
// indexes); deleting the parent row first would strand them. Pre-launch
// (CLAUDE.md "No legacy before launch"): any run status is deletable, not
// only draft/active ones -- the frontend's confirm dialog carries the
// "cannot be undone" warning instead of a server-side status gate. The
// audit payload carries the run's own label (org content, never person
// PII) and the population count, mirroring runStarted's flat-stat shape;
// runId is never rendered as a raw value (payloadStats drops any "*Id" key).
export const deletePayMappingRun = orgMutation({
  args: { runId: v.id("payMappingRuns") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)

    const snapshotRows = await ctx.db
      .query("payMappingSnapshotRows")
      .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", runId))
      .collect()
    for (const row of snapshotRows) {
      await ctx.db.delete(row._id)
    }

    const analysisRows = await ctx.db
      .query("payMappingGroupAnalyses")
      .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", runId))
      .collect()
    for (const row of analysisRows) {
      await ctx.db.delete(row._id)
    }

    await ctx.db.delete(runId)

    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingRunDeleted,
      payload: {
        runId,
        label: run.label,
        populationCount: run.populationCount,
      },
    })
    return null
  },
})

export const reopenPayMappingRun = orgMutation({
  args: { runId: v.id("payMappingRuns") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    if (run.status !== "completed")
      throw appError(ERROR_CODES.invalidTransition)
    await ctx.db.patch(runId, { status: "active" })
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingRunReopened,
      payload: { runId },
    })
    return null
  },
})
