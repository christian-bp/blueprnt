import { v } from "convex/values"
import type { Doc } from "../_generated/dataModel"
import { AUDIT_EVENTS, buildChanges } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation } from "../lib/functions"

// The compliance metadata captured per criterion for the metodbilaga (E2/E5).
// Documentation only: editing these never moves a score, so no band-shift.
export const COMPLIANCE_AUDIT_FIELDS = [
  "purpose",
  "whyRelevant",
  "overlapNotes",
  "biasRisk",
  "biasComment",
  "biasAction",
  "approved",
  "decidedBy",
  "decidedAt",
] as const

const biasRiskValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high")
)

const MAX_COMPLIANCE_TEXT = 2000

const filled = (s: string | undefined) => (s?.trim().length ?? 0) > 0

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
// undefined so the optional stays clean). Reopen-on-edit: if any content field
// changed and the criterion was approved, the sign-off no longer attests to the
// current text, so approval/decidedBy/decidedAt are cleared. No band-shift.
export const saveCriterionCompliance = adminMutation({
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
    const next = {
      purpose: norm(args.purpose),
      whyRelevant: norm(args.whyRelevant),
      overlapNotes: norm(args.overlapNotes),
      biasRisk: args.biasRisk,
      biasComment: norm(args.biasComment),
      biasAction: norm(args.biasAction),
    }
    const contentChanged =
      next.purpose !== criterion.purpose ||
      next.whyRelevant !== criterion.whyRelevant ||
      next.overlapNotes !== criterion.overlapNotes ||
      next.biasRisk !== criterion.biasRisk ||
      next.biasComment !== criterion.biasComment ||
      next.biasAction !== criterion.biasAction
    const reopen = contentChanged && criterion.approved === true
    const patch = {
      ...next,
      ...(reopen
        ? { approved: undefined, decidedBy: undefined, decidedAt: undefined }
        : {}),
    }
    await ctx.db.patch(args.criterionId, patch)
    await ctx.audit.log({
      type: AUDIT_EVENTS.modelUpdated,
      payload: {
        change: "criterion.complianceUpdated",
        criterionId: args.criterionId,
        modelId: criterion.modelId,
        // buildChanges skips fields absent from `patch`, so approved/decidedBy/
        // decidedAt only appear when reopen added them.
        changes: buildChanges(criterion, patch, COMPLIANCE_AUDIT_FIELDS),
      },
    })
    return null
  },
})

// Explicit admin sign-off. Approving requires the criterion to be documented
// (required subset present); stamps decidedBy (the acting admin) + decidedAt.
// Un-approving clears the stamp. No band-shift.
export const setCriterionApproval = adminMutation({
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
    const patch = args.approved
      ? { approved: true, decidedBy: ctx.authUserId, decidedAt: Date.now() }
      : { approved: undefined, decidedBy: undefined, decidedAt: undefined }
    await ctx.db.patch(args.criterionId, patch)
    await ctx.audit.log({
      type: AUDIT_EVENTS.modelUpdated,
      payload: {
        change: "criterion.approvalChanged",
        criterionId: args.criterionId,
        modelId: criterion.modelId,
        changes: buildChanges(criterion, patch, [
          "approved",
          "decidedBy",
          "decidedAt",
        ]),
      },
    })
    return null
  },
})
