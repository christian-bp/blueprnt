import type { DimensionKey } from "@workspace/core"
import { v } from "convex/values"
import type { Doc } from "../_generated/dataModel"
import { AUDIT_EVENTS, buildChanges } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation, orgQuery } from "../lib/functions"
import { reopenApprovalIfSet } from "./approval"
import { criteriaLibraryContent, LIBRARY_DIMENSION } from "./criteriaLibrary"
import { clampLocale } from "./localize"
import { dimensionKeyValidator, libraryKeyValidator } from "./tables"

// The compliance content fields logged in the audit diff. decidedBy/decidedAt
// are intentionally excluded: they are redundant with the audit row's own actor
// + timestamp and render as ugly raw values in the detail sheet. approved is
// excluded too: it no longer changes via save (reopen is a separate explicit
// action via setCriterionApproval).
export const COMPLIANCE_AUDIT_FIELDS = [
  "purpose",
  "whyRelevant",
  "overlapNotes",
  "biasRisk",
  "biasComment",
  "biasAction",
] as const

const biasRiskValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high")
)

const MAX_COMPLIANCE_TEXT = 2000

// Shared with approval.ts's buildMethodCheckInput (the engine-input builder
// needs the same "is this text field meaningfully filled" test).
export const filled = (s: string | undefined) => (s?.trim().length ?? 0) > 0

// A criterion is "documented" when the required subset is present: purpose,
// whyRelevant, biasRisk, biasComment. overlapNotes and biasAction are optional.
function isDocumented(c: {
  purpose?: string
  whyRelevant?: string
  biasRisk?: "low" | "medium" | "high"
  biasComment?: string
}): boolean {
  return (
    filled(c.purpose) &&
    filled(c.whyRelevant) &&
    c.biasRisk !== undefined &&
    filled(c.biasComment)
  )
}

export type ComplianceStatus =
  | "notStarted"
  | "inProgress"
  | "documented"
  | "approved"

// Four-state per-criterion status. Single source of truth, reused by
// getMethodModel (per-criterion status + aggregate) and the approval gate.
export function complianceStatus(c: Doc<"criteria">): ComplianceStatus {
  if (c.approved === true) return "approved"
  if (isDocumented(c)) return "documented"
  const hasAny =
    filled(c.purpose) ||
    filled(c.whyRelevant) ||
    filled(c.overlapNotes) ||
    filled(c.biasComment) ||
    filled(c.biasAction) ||
    c.biasRisk !== undefined
  return hasAny ? "inProgress" : "notStarted"
}

// Saves rationale + bias texts. Empty strings clear a field (stored as
// undefined so the optional stays clean). Approved criteria are locked: editing
// requires an explicit reopen via setCriterionApproval first. No level-shift.
//
// Also reopens the MODEL's own approval if it is currently set (defense in
// depth, approval.ts's reopenApprovalIfSet): the criterionLocked guard above
// means this is only reachable once the criterion is already un-approved,
// which itself already reopens the model (setCriterionApproval), so this call
// is normally a no-op. It stays here anyway so this mutation is correct on
// its own terms and does not silently depend on always being called after
// setCriterionApproval to keep the model's approval honest.
export const saveCriterionCompliance = orgMutation({
  args: {
    criterionId: v.id("criteria"),
    purpose: v.string(),
    whyRelevant: v.string(),
    overlapNotes: v.string(),
    biasRisk: v.optional(biasRiskValidator),
    biasComment: v.string(),
    biasAction: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const criterion = await ctx.db.get(args.criterionId)
    if (criterion === null || criterion.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    if (criterion.approved === true) {
      throw appError(ERROR_CODES.criterionLocked)
    }
    for (const text of [
      args.purpose,
      args.whyRelevant,
      args.overlapNotes,
      args.biasComment,
      args.biasAction,
    ]) {
      if (text.length > MAX_COMPLIANCE_TEXT)
        throw appError(ERROR_CODES.invalidInput)
    }
    const norm = (s: string) => (s.trim().length === 0 ? undefined : s.trim())
    const patch = {
      purpose: norm(args.purpose),
      whyRelevant: norm(args.whyRelevant),
      overlapNotes: norm(args.overlapNotes),
      biasRisk: args.biasRisk,
      biasComment: norm(args.biasComment),
      biasAction: norm(args.biasAction),
    }
    // No-op short-circuit (mirrors rebalanceWeights,
    // setCriterionWeightMotivation and setWorkingConditionsDecision): an
    // identical resubmission writes nothing, so a dialog reopened and saved
    // unchanged never adds an audit row. buildChanges returns {} for an
    // unchanged patch, and a row carrying an empty diff reads "0 fields
    // changed" in the log while recording nothing. The compliance dialog's own
    // dirty gate keeps this clean in practice; the invariant belongs here,
    // where every caller meets it.
    const changes = buildChanges(criterion, patch, COMPLIANCE_AUDIT_FIELDS)
    if (Object.keys(changes).length === 0) return null
    await ctx.db.patch(args.criterionId, patch)
    const model = await ctx.db.get(criterion.modelId)
    if (model !== null) {
      await reopenApprovalIfSet(ctx, model, AUDIT_EVENTS.modelUpdated)
    }
    await ctx.audit.log({
      type: AUDIT_EVENTS.modelUpdated,
      payload: {
        change: "criterion.complianceUpdated",
        criterionId: args.criterionId,
        modelId: criterion.modelId,
        changes,
      },
    })
    return null
  },
})

// Explicit admin sign-off. Approving requires the criterion to be documented
// (required subset present); stamps decidedBy (the acting admin) + decidedAt.
// Un-approving clears the stamp. No level-shift.
//
// Un-approving also reopens the MODEL's own approval if it is currently set
// (approval.ts's reopenApprovalIfSet): this criterion's `documented` input
// (buildMethodCheckInput: `documented: row.approved === true`) feeds the
// documentationComplete BLOCKER, so flipping it from true to false can move a
// model that currently reads approved to one that would no longer pass its
// own checklist. Leaving model.approval set through that would let
// startPayMappingRun freeze this state as reviewed evidence when it is not.
// The approve direction never needs this: it can only make
// documentationComplete MORE likely to pass, never less, so it cannot
// invalidate an existing approval.
export const setCriterionApproval = orgMutation({
  args: { criterionId: v.id("criteria"), approved: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const criterion = await ctx.db.get(args.criterionId)
    if (criterion === null || criterion.orgId !== ctx.orgId) {
      throw appError(ERROR_CODES.notFound)
    }
    if (args.approved && !isDocumented(criterion)) {
      throw appError(ERROR_CODES.invalidInput)
    }
    // No-op short-circuit, like this file's sibling above and the three in
    // criteria.ts/approval.ts. Re-approving an approved criterion used to pass
    // (an approved criterion is by definition documented), re-stamp decidedBy
    // and decidedAt with a NEW timestamp, and write a second criterion.approved
    // row. The sign-off date is evidence in the kriterieurvalsprotokoll: it
    // moves when a human signs, never because a dialog was saved again.
    if ((criterion.approved === true) === args.approved) return null
    const patch = args.approved
      ? { approved: true, decidedBy: ctx.authUserId, decidedAt: Date.now() }
      : { approved: undefined, decidedBy: undefined, decidedAt: undefined }
    await ctx.db.patch(args.criterionId, patch)
    if (!args.approved) {
      const model = await ctx.db.get(criterion.modelId)
      if (model !== null) {
        await reopenApprovalIfSet(ctx, model, AUDIT_EVENTS.criterionReopened)
      }
    }
    await ctx.audit.log({
      type: args.approved
        ? AUDIT_EVENTS.criterionApproved
        : AUDIT_EVENTS.criterionReopened,
      payload: {
        criterionId: args.criterionId,
        modelId: criterion.modelId,
      },
    })
    return null
  },
})

const orderShape = (a: { order: number }, b: { order: number }) =>
  a.order - b.order

// An orgQuery, not an adminQuery, for the same reason getMethodChecks is one
// (evaluationModel/approval.ts): the Metod chapter is one of the model
// section's four, and an admin gate on its only read throws in render and
// leaves an editor a live tab that crashes. It carries org-level method
// content only: each criterion's protokoll and bias documentation, its weight
// and derived share, and the model's own rules. No person data, no salary.
// Both writes in this file are member-level, and the panel offers them to
// every member.
export const getMethodModel = orgQuery({
  args: { locale: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({
      modelName: v.string(),
      pointBudget: v.number(),
      criteria: v.array(
        v.object({
          criterionId: v.id("criteria"),
          libraryKey: libraryKeyValidator,
          dimensionKey: dimensionKeyValidator,
          name: v.string(),
          // The library's full definition of the criterion: what it covers and
          // what it does not. The Metod chapter's cards carry the one-liner and
          // this text opens with the documentation dialog, where it is the
          // reference the protokoll is written against.
          description: v.string(),
          weightPoints: v.number(),
          share: v.number(),
          order: v.number(),
          purpose: v.union(v.string(), v.null()),
          whyRelevant: v.union(v.string(), v.null()),
          overlapNotes: v.union(v.string(), v.null()),
          biasRisk: v.union(
            v.literal("low"),
            v.literal("medium"),
            v.literal("high"),
            v.null()
          ),
          biasComment: v.union(v.string(), v.null()),
          biasAction: v.union(v.string(), v.null()),
          status: v.union(
            v.literal("notStarted"),
            v.literal("inProgress"),
            v.literal("documented"),
            v.literal("approved")
          ),
          decidedByName: v.union(v.string(), v.null()),
          decidedAt: v.union(v.number(), v.null()),
        })
      ),
      // The ladder and the zone gates are method law in packages/core, so the
      // appendix reads them there rather than over the wire. The materiality
      // decision IS org content and travels; decidedBy stays off the wire (a
      // raw auth id no surface shows).
      workingConditions: v.union(
        v.null(),
        v.object({
          status: v.union(v.literal("active"), v.literal("testedNotMaterial")),
          motivation: v.string(),
          decidedAt: v.number(),
        })
      ),
      progress: v.object({
        documented: v.number(),
        approved: v.number(),
        total: v.number(),
      }),
      // Whether the MODEL AS A WHOLE carries a current approval (ADR-0023),
      // distinct from `progress.approved` (a per-criterion compliance count
      // above): the dashboard todo needs this to prompt the final "approve
      // the method" step once every per-criterion item is done.
      modelApproved: v.boolean(),
    })
  ),
  handler: async (ctx, { locale }) => {
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) return null

    const content = criteriaLibraryContent(clampLocale(locale))

    const rows = await ctx.db
      .query("criteria")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    rows.sort(orderShape)

    const totalPoints = rows.reduce((sum, r) => sum + r.weightPoints, 0)

    // Resolve decidedBy (Better Auth id) to a display name via the users mirror.
    // Deduped so N approvals by one admin cost one lookup.
    const nameCache = new Map<string, string | null>()
    const resolveName = async (authId: string): Promise<string | null> => {
      if (nameCache.has(authId)) return nameCache.get(authId) ?? null
      const user = await ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", authId))
        .first()
      const name = user?.name ?? null
      nameCache.set(authId, name)
      return name
    }

    type CriterionRow = {
      criterionId: (typeof rows)[number]["_id"]
      libraryKey: (typeof rows)[number]["libraryKey"]
      dimensionKey: DimensionKey
      name: string
      description: string
      weightPoints: number
      share: number
      order: number
      purpose: string | null
      whyRelevant: string | null
      overlapNotes: string | null
      biasRisk: "low" | "medium" | "high" | null
      biasComment: string | null
      biasAction: string | null
      status: ComplianceStatus
      decidedByName: string | null
      decidedAt: number | null
    }
    const criteria: CriterionRow[] = []
    let documented = 0
    let approved = 0
    for (const row of rows) {
      const entry = content.criteria[row.libraryKey]
      const status = complianceStatus(row)
      if (status === "documented" || status === "approved") documented++
      if (status === "approved") approved++
      criteria.push({
        criterionId: row._id,
        libraryKey: row.libraryKey,
        dimensionKey: LIBRARY_DIMENSION[row.libraryKey],
        name: entry.name,
        description: entry.fullDefinition,
        weightPoints: row.weightPoints,
        share:
          totalPoints > 0
            ? Math.round((row.weightPoints / totalPoints) * 100)
            : 0,
        order: row.order,
        // Compliance texts are the org's own documentation, pre-filled once at
        // activation (evaluationModel/criteria.ts) and edited from then on:
        // they always read from the stored row, never re-localized.
        purpose: row.purpose ?? null,
        whyRelevant: row.whyRelevant ?? null,
        overlapNotes: row.overlapNotes ?? null,
        biasRisk: row.biasRisk ?? null,
        biasComment: row.biasComment ?? null,
        biasAction: row.biasAction ?? null,
        status,
        decidedByName:
          row.decidedBy !== undefined ? await resolveName(row.decidedBy) : null,
        decidedAt: row.decidedAt ?? null,
      })
    }

    const workingConditions =
      model.workingConditions === undefined
        ? null
        : {
            status: model.workingConditions.status,
            motivation: model.workingConditions.motivation,
            decidedAt: model.workingConditions.decidedAt,
          }
    return {
      modelName: model.name,
      pointBudget: rows.length * 3,
      criteria,
      workingConditions,
      progress: { documented, approved, total: rows.length },
      modelApproved: model.approval !== undefined,
    }
  },
})
