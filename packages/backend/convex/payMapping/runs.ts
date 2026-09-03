import {
  BASE_PRAXIS_AREA_KEYS,
  normalizedMonthlyBase,
  PRAXIS_AREA_KEYS,
  type PraxisAreaKey,
} from "@workspace/constants"
import {
  LEVEL_RULES,
  methodBlockersPass,
  validateMethod,
  ZONE_PROFILE_RULES,
} from "@workspace/core"
import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import type {
  DatabaseReader,
  MutationCtx,
  QueryCtx,
} from "../_generated/server"
import { deriveResults } from "../assessment/compute"
import { deriveMethodDrift } from "../assessment/results"
import { buildMethodCheckInput } from "../evaluationModel/approval"
import { buildModelEvidence } from "../evaluationModel/evidence"
import { resolveContentLocale } from "../evaluationModel/model"
import { AUDIT_EVENTS, resolveActorName } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation, orgQuery } from "../lib/functions"
import { uniqueSlug } from "../lib/slug"
import {
  readOrgPayDefaults,
  resolveFullTimeHours,
} from "../people/fullTimeHours"
import { payRecordAt } from "../people/pay"
import { basePayBasis } from "../people/tables"
import { requiredDocumentationKeys } from "./gap"
import { orgGap, type PricedRow } from "./orgGap"
import { payGapFlag, payMappingRunStatus } from "./tables"

const SYSTEM_VERSION = "v2-slice1"

// One role blocking the gate: staffed (holds at least one open assignment)
// but not fully evaluated (resolves no level).
export type PreconditionRole = {
  roleId: Id<"roles">
  title: string
  slug: string
}

export type PayMappingPreconditions = {
  peopleCount: number
  unclassifiedCount: number
  unevaluatedRoles: PreconditionRole[]
  // The org's model carries a CURRENT approval (model.approval !== undefined,
  // not merely a past one sitting in lastApprovedModel). Required for ready:
  // startPayMappingRun freezes the live model as the run's statutory method
  // evidence (ADR-0011/ADR-0023), and a model whose approval was reopened by
  // a later method edit (reopenApprovalIfSet) is no longer a reviewed,
  // signed-off method, so freezing it would stamp unapproved evidence with
  // null approval metadata.
  modelApproved: boolean
  // model.approval.approvedAt when modelApproved is true, else null. Powers
  // the start dialog's "this freezes the model approved on {date}" copy;
  // never populated from lastApprovedModel, which names a PAST approval that
  // may no longer be the live one.
  modelApprovedAt: number | null
  // Non-blocking (CLAUDE.md: recommended, never a blocker): how many staffed,
  // active roles are both evaluated AND have a COMPLETED assessment (so they
  // do NOT appear in unevaluatedRoles above) but were completed before the
  // model's CURRENT approval -- the same drift the roles wire reveals per role
  // (assessment/results.ts's deriveMethodDrift, reused here verbatim so the
  // two can never name a different set of roles). A role only counts once its
  // own assessment is stale against the model that is actually approved right
  // now; while modelApproved is false every completed assessment is trivially
  // stale (deriveMethodDrift treats "no current approval" as drift), which is
  // expected: the modelApproved line above is already the blocker in that
  // state, and this count still names the roles that will need evaluating
  // again once approval is restored.
  driftedRolesCount: number
  ready: boolean
}

// The DL 3 kap. preconditions a kartläggning must satisfy before it can
// start: every active person carries a confirmed open assignment to an
// ACTIVE role ("classified" = confirmed AND the role still exists and is
// not archived; the same definition listPeopleByTitle's currentAssignment,
// countClassified, the people-tab badge, and the to-do's classify group all
// use), every ACTIVE role holding at least one open assignment ("staffed")
// is both evaluated (resolves a level, the same deriveResults resolution the
// frozen snapshot reads) AND has a COMPLETED assessment (spec 2.4/6: a run may
// only include roles whose result has actually been revealed, not merely one
// that is fully rated and still open), AND the org's model carries a CURRENT
// approval (ADR-0011/ADR-0023: the freeze below stamps the live model as the
// run's statutory method evidence, so an unapproved method can never become
// one). An unstaffed role's evaluation state never blocks. Shared by
// startPayMappingRun's server-side gate and getPayMappingPreconditions so
// the two can never fork. Archived roles are excluded from BOTH the
// staffed-evaluation and classified checks: from the staffed-evaluation
// check because deriveResults never resolves a level for them (so they can
// never block), and from the classified check because a confirmed open
// assignment to an archived (or otherwise missing) role is NOT a real
// classification -- it counts toward unclassifiedCount, same as no
// assignment at all. archiveRole normally ends a role's open assignments at
// archive time (assessment/roles.ts), so this only guards a pre-existing
// stale row, not the everyday path.
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
  const levelByRole = new Map(derived.results.map((r) => [r.roleId, r]))

  const model = await ctx.db
    .query("models")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique()
  const modelApproved = model?.approval !== undefined
  const modelApprovedAt = model?.approval?.approvedAt ?? null

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
      open.senioritySource !== "confirmed" ||
      !activeRoleById.has(open.roleId as string)
    ) {
      unclassifiedCount += 1
    }
    if (open !== null) staffedRoleIds.add(open.roleId as string)
  }

  const staffedActiveRoles = [...staffedRoleIds]
    .map((roleId) => activeRoleById.get(roleId))
    .filter((role): role is Doc<"roles"> => role !== undefined)

  const unevaluatedRoles: PreconditionRole[] = staffedActiveRoles
    .filter((role) => {
      const level = levelByRole.get(role._id as string)?.level ?? null
      // Evaluated AND COMPLETED (spec 2.4/6): a staffed role that is fully
      // rated but whose assessment is still open blocks the gate exactly like
      // an unrated one, since its result has not been revealed yet.
      return level === null || role.assessment === undefined
    })
    .map((role) => ({ roleId: role._id, title: role.title, slug: role.slug }))
    .sort((a, b) => a.title.localeCompare(b.title))

  // Drift is a property of the COMPLETED, non-blocking subset: an unevaluated
  // role above already blocks on its own, and there is no completion timestamp
  // to compare while it has none.
  const driftedRolesCount = staffedActiveRoles.filter(
    (role) =>
      role.assessment !== undefined && deriveMethodDrift(role.assessment, model)
  ).length

  // Belt-and-braces, alongside modelApproved above rather than instead of it:
  // re-runs the SAME twelve-check gate approveModel itself refuses on
  // (validateMethod/methodBlockersPass, packages/core), so a future mutation
  // that changes a blocker input and forgets to wire reopenApprovalIfSet
  // (approval.ts) cannot silently leave modelApproved true while the model no
  // longer actually clears its own checklist. Every mutation that CAN move a
  // blocker reopens approval today (approval.ts's governing-rule comment
  // lists them), which makes modelApproved and this check agree in every
  // reachable state -- this exists to keep it that way, not because the two
  // are expected to differ. No separate panel message: modelApproved's own
  // line already tells the reader what to do, and a state where blockers fail
  // while modelApproved reads true should never occur to show it for.
  const blockersPass =
    model !== null &&
    methodBlockersPass(validateMethod(await buildMethodCheckInput(ctx, model)))

  return {
    peopleCount: active.length,
    unclassifiedCount,
    unevaluatedRoles,
    modelApproved,
    modelApprovedAt,
    driftedRolesCount,
    // An org with no people at all is never ready: DL 3 kap. maps employees,
    // so an empty population must import before anything can start.
    ready:
      active.length > 0 &&
      unclassifiedCount === 0 &&
      unevaluatedRoles.length === 0 &&
      modelApproved &&
      blockersPass,
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
    modelApproved: v.boolean(),
    modelApprovedAt: v.union(v.number(), v.null()),
    driftedRolesCount: v.number(),
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

    // Freeze the model config once (ADR-0008). Built by the SHARED evidence
    // builder (evaluationModel/evidence.ts), the same one approveModel writes
    // the model's last-approved buffer with, so the two copies of the method
    // evidence can never diverge in shape or content. Criterion display names
    // and anchor counts come from the library content in the org's own content
    // locale at freeze time and are never re-resolved, so a later locale change
    // or content edit cannot alter an already-frozen run. This is the ADR-0023
    // freeze, the only place the product versions its method (spec 2.6).
    //
    // INVARIANT this freeze relies on, made TRUE by two mechanisms, not
    // narrated on trust: the preconditions gate just above already required
    // modelApproved (model.approval !== undefined) AND, belt-and-braces,
    // methodBlockersPass over the model's CURRENT checklist. modelApproved
    // alone stays honest because every mutation that can change a checklist
    // BLOCKER input reopens approval (reopenApprovalIfSet's governing rule,
    // approval.ts: activateCriterion, deactivateCriterion, rebalanceWeights,
    // setWorkingConditionsDecision, updateLevelRules, updateZoneProfileRules,
    // setCriterionApproval's un-approve direction, and saveCriterionCompliance
    // as defense in depth) -- so a model whose approval is currently set has
    // had no blocker-moving edit since that approval was granted, and the live
    // model's METHOD is the last-approved method, field for field.
    //
    // "Its method", not "the document": two things on a model can move while
    // an approval stands, and neither is method evidence. `weightsSavedAt` is
    // stamped without a reopen on the one path that records an unchanged
    // weighting as decided (criteria.ts), and it is not a checklist blocker
    // and not part of ModelEvidence. Role CALIBRATION
    // (assessment/completion.ts) writes to the role, never the model, and
    // deliberately does not reopen: confirming where a role landed is a review
    // of a placement, not a change to the method that produced it. The
    // invariant this freeze needs is about the evidence, and both stay outside
    // it. The
    // methodBlockersPass re-check is the second, independent proof of the
    // same fact: it would catch a future mutation that changes a blocker
    // input and forgets to wire the reopen. The evidence built below is
    // therefore the latest APPROVED method (with non-null approval metadata),
    // never a live-but-unreviewed edit -- there is no separate "freeze the
    // approved version instead of the live one" step to write, because for an
    // approved model there is only one version.
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    const freezeLocale = await resolveContentLocale(ctx, ctx.orgId)
    // The run freezes the ladder and the zone gates it is actually placed
    // under. They are method law and no longer live on the model document
    // (ADR-0024), so they are added HERE rather than by the shared evidence
    // builder: retuning the constants later must not rewrite what an
    // already-signed kartläggning says it measured.
    const frozenModel = {
      ...(await buildModelEvidence(ctx, model, freezeLocale)),
      levelRules: LEVEL_RULES.map((rule) => ({
        level: rule.level,
        minScore: rule.minScore,
      })),
      zoneProfileRules: ZONE_PROFILE_RULES.map((rule) => ({
        zone: rule.zone,
        minStep: rule.minStep,
      })),
    }

    // Derive level/score for every role once, index by roleId.
    const derived = await deriveResults(ctx, ctx.orgId)
    const levelByRole = new Map(derived.results.map((r) => [r.roleId, r]))

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

    // Org pay defaults, read once outside the per-person loop below (never
    // per person): the currency/country/full-time-hours fallback every
    // person's hours resolution needs. fullTimeHoursDefault is the org-wide
    // figure with no person on hand to resolve against, for the run's own
    // method note; each row still resolves ITS OWN hours through the
    // person's value first.
    const orgDefaults = await readOrgPayDefaults(ctx, ctx.orgId)
    const fullTimeHoursDefault = resolveFullTimeHours(
      {},
      orgDefaults
    ).hoursPerMonth

    const runId = await ctx.db.insert("payMappingRuns", {
      orgId: ctx.orgId,
      slug,
      label: trimmed,
      status: "active",
      referenceDate,
      fullTimeHoursDefault,
      initiatedBy: ctx.authUserId,
      initiatedAt: referenceDate,
      systemVersion: SYSTEM_VERSION,
      // Placeholders, patched below once the rows are frozen: the counts and
      // the gap are all derived from the rows this insert precedes.
      populationCount: 0,
      withPayCount: 0,
      womenCount: 0,
      menCount: 0,
      orgGapPct: null,
      orgGapFlag: "insufficient",
      frozenModel,
    })

    let populationCount = 0
    let withPayCount = 0
    let womenCount = 0
    let menCount = 0
    // Every frozen row, for the org-gap figure stored on the run below.
    // orgGap() applies the priced filter itself.
    const pricedRows: PricedRow[] = []

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
      // level-less row is impossible by construction past this point.
      // Reaching this with one means the gate and this loop have diverged:
      // fail loud rather than silently freezing the exact level-less row the
      // gate exists to prevent. Mirrors the classifyOrg
      // invariant throw (people/classification.ts): a plain Error, not an
      // appError code, since this guards an internal programming error, not
      // a condition a user can trigger or that needs a translated message.
      if (role === undefined || role.archivedAt !== undefined) {
        throw new Error(
          `startPayMappingRun invariant: person ${person._id} has an open assignment to archived/missing role ${open.roleId}, which should be unreachable past the preconditions gate`
        )
      }
      const result = levelByRole.get(open.roleId as string)
      const payRows = await ctx.db
        .query("payRecords")
        .withIndex("by_person", (q) =>
          q.eq("orgId", ctx.orgId).eq("personId", person._id)
        )
        .collect()
      const pay = payRecordAt(payRows, referenceDate)
      if (pay !== null) withPayCount += 1

      // Every row's hours are resolved through the shared rule (person, else
      // org, else country); normalizedMonthlyBase throws on non-positive
      // hours, which resolveFullTimeHours never returns.
      const hours = resolveFullTimeHours(person, orgDefaults)
      const basicMonthly =
        pay === null
          ? null
          : normalizedMonthlyBase(
              pay.basicAmount,
              pay.basis,
              hours.hoursPerMonth
            )

      const snapshotRow = {
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
        seniority: open.seniority,
        level: result?.level ?? null,
        score: result?.score ?? null,
        basicMonthly,
        components: pay?.components ?? [],
        ...(pay !== null
          ? {
              basis: pay.basis,
              basicAmount: pay.basicAmount,
              hoursPerMonth: hours.hoursPerMonth,
            }
          : {}),
        ...(pay?.currency !== undefined ? { currency: pay.currency } : {}),
        ...(pay?.payYear !== undefined ? { payYear: pay.payYear } : {}),
      }
      await ctx.db.insert("payMappingSnapshotRows", snapshotRow)
      // The stored gap derives from the rows actually inserted, through the
      // same helpers getPayMappingGap reads, so the figure on the run row and
      // the figure on the run's own Overview cannot disagree.
      pricedRows.push(snapshotRow)
      populationCount += 1
      if (person.gender === "Kvinna") womenCount += 1
      else menCount += 1
    }

    const gap = orgGap(pricedRows)
    await ctx.db.patch(runId, {
      populationCount,
      withPayCount,
      womenCount,
      menCount,
      orgGapPct: gap.gapPct,
      orgGapFlag: gap.flag,
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
  womenCount: v.number(),
  menCount: v.number(),
  // The frozen org-level gap. Null when that mapping had no measurable gap,
  // which the front page's trend draws as a break in the curve.
  orgGapPct: v.union(v.number(), v.null()),
  orgGapFlag: payGapFlag,
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
      womenCount: r.womenCount,
      menCount: r.menCount,
      withPayCount: r.withPayCount,
      orgGapPct: r.orgGapPct,
      orgGapFlag: r.orgGapFlag,
    }))
  },
})

const snapshotRowShape = v.object({
  // The pseudonymous person key (never a name-derived slug, never the raw
  // id): the detail views anchor per-individual actions and notes to it.
  personPublicId: v.string(),
  displayName: v.string(),
  erased: v.boolean(),
  gender: v.union(v.literal("Man"), v.literal("Kvinna")),
  birthDate: v.optional(v.string()),
  employmentStartDate: v.optional(v.string()),
  ftePercent: v.optional(v.number()),
  roleTitle: v.string(),
  trackKey: v.string(),
  seniority: v.string(),
  level: v.union(v.number(), v.null()),
  basicMonthly: v.union(v.number(), v.null()),
  // The frozen raw figure, its basis and the full-time hours used to derive
  // basicMonthly. Present exactly when basicMonthly is non-null.
  basis: v.optional(basePayBasis),
  basicAmount: v.optional(v.number()),
  hoursPerMonth: v.optional(v.number()),
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
      // The organization's resolved full-time hours per month at freeze time
      // (the report's method note). A row's own hoursPerMonth wins when it
      // differs (a person with a value of their own).
      fullTimeHoursDefault: v.number(),
      // The frozen headcount, denormalized at freeze time. The overview's
      // population card reads it here rather than counting `rows`, so this
      // run and the one it is compared against (listPayMappingRuns) report
      // the same figure from the same field.
      populationCount: v.number(),
      rows: v.array(snapshotRowShape),
      collaboration: v.union(
        v.object({ participants: v.string(), description: v.string() }),
        v.null()
      ),
      // The frozen model's criteria, name + weight only: the report's method
      // section cites the method the run was actually computed under
      // (ADR-0008 reproducibility), never the live model. Ordered as the
      // frozen evidence orders them.
      frozenCriteria: v.array(
        v.object({ name: v.string(), weightPoints: v.number() })
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
      fullTimeHoursDefault: run.fullTimeHoursDefault,
      populationCount: run.populationCount,
      collaboration: run.collaboration ?? null,
      frozenCriteria: [...run.frozenModel.criteria]
        .sort(
          (a, b) =>
            (a.order ?? Number.POSITIVE_INFINITY) -
            (b.order ?? Number.POSITIVE_INFINITY)
        )
        .map((criterion) => ({
          name: criterion.name,
          weightPoints: criterion.weightPoints,
        })),
      rows: rows.map((r) => ({
        personPublicId: r.personPublicId,
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
        seniority: r.seniority,
        level: r.level,
        basicMonthly: r.basicMonthly,
        ...(r.basis !== undefined ? { basis: r.basis } : {}),
        ...(r.basicAmount !== undefined ? { basicAmount: r.basicAmount } : {}),
        ...(r.hoursPerMonth !== undefined
          ? { hoursPerMonth: r.hoursPerMonth }
          : {}),
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
    // Orphaned rows (groups the entry conditions have since excluded) stay
    // stored as history but never count: the audited done-figures must match
    // the groups that actually exist in the run.
    const equalWorkDone = new Set(
      [...doneKeys("equalWork")].filter((key) => keys.equalWorkAll.has(key))
    )
    const equivalentWorkDone = new Set(
      [...doneKeys("equivalentWork")].filter((key) =>
        keys.womenDominatedAll.has(key)
      )
    )
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

// Rename a pay mapping. The run is route-exposed, so the slug is regenerated
// from the new label (CLAUDE.md: routes resolve by (orgId, slug), never a raw
// id) and any open link to the old slug stops resolving; the run's _id, and so
// every snapshot row and analysis pointing at it, is untouched.
//
// Renaming is allowed in any status, including completed: the label is the
// document's title, not part of the frozen evidence (which is the population,
// the model and the analyses). An unchanged label is a no-op, so a dialog that
// opens and closes writes no audit row.
export const renamePayMappingRun = orgMutation({
  args: { runId: v.id("payMappingRuns"), label: v.string() },
  returns: v.null(),
  handler: async (ctx, { runId, label }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)

    const trimmed = label.trim()
    if (trimmed === "") throw appError(ERROR_CODES.invalidInput)
    if (trimmed === run.label) return null

    await ctx.db.patch(runId, {
      label: trimmed,
      slug: await uniqueSlug(ctx, "payMappingRuns", ctx.orgId, trimmed, {
        excludeId: runId,
      }),
    })
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingRunRenamed,
      payload: {
        runId,
        changes: { label: { from: run.label, to: trimmed } },
      },
    })
    return null
  },
})

// Hard-deletes a pay-mapping run and every child row that references it,
// child-first: payMappingSnapshotRows, payMappingGroupAnalyses,
// payMappingActions and payMappingNotes are the tables that carry a runId
// (payMapping/tables.ts's by_run indexes); deleting the parent row first
// would strand them. A completed run is the statutory kartläggning evidence
// document and cannot be deleted directly: reopening it first (its own
// audited step) is the deliberate two-step path, so an evidence document
// never disappears in one gesture. The audit payload carries the run's own
// label (org content, never person PII) and the population count, mirroring
// runStarted's flat-stat shape; runId is never rendered as a raw value
// (payloadStats drops any "*Id" key).
export const deletePayMappingRun = orgMutation({
  args: { runId: v.id("payMappingRuns") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    if (run.status === "completed")
      throw appError(ERROR_CODES.payMappingRunCompleted)

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

    const actionRows = await ctx.db
      .query("payMappingActions")
      .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", runId))
      .collect()
    for (const row of actionRows) {
      await ctx.db.delete(row._id)
    }

    const noteRows = await ctx.db
      .query("payMappingNotes")
      .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", runId))
      .collect()
    for (const row of noteRows) {
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
