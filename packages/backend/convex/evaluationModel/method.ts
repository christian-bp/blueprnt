import { v } from "convex/values"
import type { Doc } from "../_generated/dataModel"
import { AUDIT_EVENTS, buildChanges } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation, adminQuery } from "../lib/functions"
import { clampLocale, isCriterionKey } from "./localize"
import { templateContent } from "./standardTemplate"

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
// undefined so the optional stays clean). Approved criteria are locked: editing
// requires an explicit reopen via setCriterionApproval first. No band-shift.
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
    await ctx.db.patch(args.criterionId, patch)
    await ctx.audit.log({
      type: AUDIT_EVENTS.modelUpdated,
      payload: {
        change: "criterion.complianceUpdated",
        criterionId: args.criterionId,
        modelId: criterion.modelId,
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

export const getMethodModel = adminQuery({
  args: { locale: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({
      modelName: v.string(),
      pointBudget: v.number(),
      criteria: v.array(
        v.object({
          criterionId: v.id("criteria"),
          name: v.string(),
          description: v.string(),
          helpText: v.string(),
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
      bandThresholds: v.array(
        v.object({ band: v.number(), minScore: v.number() })
      ),
      progress: v.object({
        documented: v.number(),
        approved: v.number(),
        total: v.number(),
      }),
    })
  ),
  handler: async (ctx, { locale }) => {
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) return null

    const content = templateContent(clampLocale(locale))
    const isTemplateModel = model.templateKey !== undefined

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
      name: string
      description: string
      helpText: string
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
      const localized =
        row.templateKey !== undefined && isCriterionKey(row.templateKey)
          ? content.criteria[row.templateKey]
          : null
      const status = complianceStatus(row)
      if (status === "documented" || status === "approved") documented++
      if (status === "approved") approved++
      criteria.push({
        criterionId: row._id,
        name: localized?.name ?? row.name,
        description: localized?.description ?? row.description,
        helpText: localized?.helpText ?? row.helpText ?? "",
        weightPoints: row.weightPoints,
        share:
          totalPoints > 0
            ? Math.round((row.weightPoints / totalPoints) * 100)
            : 0,
        order: row.order,
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

    const thresholds = [...model.bandThresholds].sort((a, b) => a.band - b.band)

    return {
      modelName: isTemplateModel ? content.modelName : model.name,
      pointBudget: rows.length * 3,
      criteria,
      bandThresholds: thresholds,
      progress: { documented, approved, total: rows.length },
    }
  },
})
