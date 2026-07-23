import type { PayGapReason } from "@workspace/constants"
import { PAY_GAP_REASONS, PRAXIS_AREA_KEYS } from "@workspace/constants"
import { v } from "convex/values"
import {
  AUDIT_EVENTS,
  buildChanges,
  GROUP_ANALYSIS_AUDIT_FIELDS,
} from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation, orgQuery } from "../lib/functions"
import { requiredDocumentationKeys } from "./gap"
import { payGapReasonValidator, payMappingFindingValidator } from "./tables"

const scopeValidator = v.union(
  v.literal("equalWork"),
  v.literal("equivalentWork"),
  v.literal("praxis")
)

// Sorts reasons into the fixed taxonomy order (PAY_GAP_REASONS), not the
// client's submission order, so resubmitting the same set in a different
// order is a no-op: neither the stored row nor the audit diff changes.
function canonicalReasons(reasons: readonly PayGapReason[]): PayGapReason[] {
  return [...reasons].sort(
    (a, b) => PAY_GAP_REASONS.indexOf(a) - PAY_GAP_REASONS.indexOf(b)
  )
}

const groupAnalysisShape = v.object({
  scope: scopeValidator,
  groupKey: v.string(),
  reasons: v.array(payGapReasonValidator),
  note: v.union(v.string(), v.null()),
  done: v.boolean(),
  finding: v.union(payMappingFindingValidator, v.null()),
})

// The run's documentation rows (objective reasons, deepened analysis, and
// the Klarmarkerad state per group). Group-level content only: never person
// data (the note's helper text steers users away from naming individuals).
export const listGroupAnalyses = orgQuery({
  args: { runId: v.id("payMappingRuns") },
  returns: v.array(groupAnalysisShape),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId) return []
    const rows = await ctx.db
      .query("payMappingGroupAnalyses")
      .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", runId))
      .collect()
    return rows.map((row) => ({
      scope: row.scope,
      groupKey: row.groupKey,
      reasons: row.reasons,
      note: row.note ?? null,
      done: row.done,
      finding: row.finding ?? null,
    }))
  },
})

// Normalizes an analysis row into the flat scalars the audit diff compares
// (arrays diff by identity, so reasons join into one display string).
// finding is praxis-only; an equalWork/equivalentWork row never carries it,
// so both sides read null and the field never appears in that scope's diff.
function auditView(
  row: {
    reasons: readonly string[]
    note?: string
    done: boolean
    finding?: "none" | "found"
  } | null
) {
  return {
    reasons:
      row === null || row.reasons.length === 0 ? null : row.reasons.join(", "),
    note: row?.note ?? null,
    done: row?.done ?? null,
    finding: row?.finding ?? null,
  }
}

export const upsertGroupAnalysis = orgMutation({
  args: {
    runId: v.id("payMappingRuns"),
    scope: scopeValidator,
    groupKey: v.string(),
    reasons: v.array(payGapReasonValidator),
    note: v.optional(v.string()),
    done: v.boolean(),
    finding: v.optional(payMappingFindingValidator),
  },
  returns: v.null(),
  handler: async (
    ctx,
    { runId, scope, groupKey, reasons, note, done, finding }
  ) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    // A completed kartläggning is locked: its documentation is what was
    // certified. Reopen (overview) to edit.
    if (run.status === "completed")
      throw appError(ERROR_CODES.payMappingRunCompleted)

    const trimmedNote = note?.trim() ?? ""

    const existing = (
      await ctx.db
        .query("payMappingGroupAnalyses")
        .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", runId))
        .collect()
    ).find((row) => row.scope === scope && row.groupKey === groupKey)

    // Carries forward the stored finding when this call omits it (e.g. an
    // in-progress note-only save): Convex's patch already preserves the
    // stored value when `next` omits the key, but the validation gate below
    // and the audit diff (auditView(next)) must agree with that same
    // effective value, or an omitted finding would either wrongly reject
    // `done` on a row that already has a verdict, or log a false
    // "found -> null" audit entry while the DB still holds "found".
    const effectiveFinding =
      scope === "praxis" ? (finding ?? existing?.finding) : undefined

    if (scope === "praxis") {
      // The lönebestämmelser/praxis review areas are a fixed constant slug
      // set (PRAXIS_AREA_KEYS), never derived from the frozen snapshot: no
      // per-group required-documentation lookup applies here.
      if (!(PRAXIS_AREA_KEYS as readonly string[]).includes(groupKey))
        throw appError(ERROR_CODES.notFound)
      // Praxis has no objective-reason taxonomy: reasons only apply to an
      // equalWork/equivalentWork pay gap.
      if (reasons.length > 0) throw appError(ERROR_CODES.invalidInput)
      // Done requires a verdict, carried forward from a prior save when this
      // call omits it; found deficiencies require a description.
      if (done && effectiveFinding === undefined)
        throw appError(ERROR_CODES.payMappingDocumentationRequired)
      if (done && effectiveFinding === "found" && trimmedNote === "")
        throw appError(ERROR_CODES.payMappingDocumentationRequired)
    } else {
      const snapshotRows = await ctx.db
        .query("payMappingSnapshotRows")
        .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", runId))
        .collect()
      const keys = requiredDocumentationKeys(snapshotRows)
      const all =
        scope === "equalWork" ? keys.equalWorkAll : keys.womenDominatedAll
      const required =
        scope === "equalWork"
          ? keys.equalWorkRequired
          : keys.womenDominatedRequired
      if (!all.has(groupKey)) throw appError(ERROR_CODES.notFound)
      // The gate's per-group rule, enforced server-side from the snapshot:
      // never trust the client's flag.
      if (
        done &&
        required.has(groupKey) &&
        reasons.length === 0 &&
        trimmedNote === ""
      )
        throw appError(ERROR_CODES.payMappingDocumentationRequired)
    }

    const next = {
      reasons: canonicalReasons(reasons),
      note: trimmedNote === "" ? undefined : trimmedNote,
      done,
      // finding is praxis-only; effectiveFinding is always undefined for
      // equalWork/equivalentWork so those rows never carry it. Writing the carried-
      // forward value explicitly (rather than omitting the key when this
      // call didn't supply one) keeps the patched DB state and the audit
      // diff (auditView(next) below) reading the exact same object.
      ...(effectiveFinding !== undefined ? { finding: effectiveFinding } : {}),
    }
    if (existing === undefined) {
      await ctx.db.insert("payMappingGroupAnalyses", {
        orgId: ctx.orgId,
        runId,
        scope,
        groupKey,
        ...next,
      })
    } else {
      await ctx.db.patch(existing._id, next)
    }

    const changes = buildChanges(
      auditView(existing ?? null),
      auditView(next),
      GROUP_ANALYSIS_AUDIT_FIELDS
    )
    const [roleTitle, , level] = groupKey.split("|")
    // groupLabel resolves the key to display text (roleTitle · level) for
    // equalWork/equivalentWork: the trail never shows a raw internal key. Praxis'
    // groupKey is already a constant area-key slug (PRAXIS_AREA_KEYS), not
    // the "roleTitle|band|level" format: never split it on "|", log it as
    // the raw key (a stable, non-PII display value).
    const groupLabel =
      scope === "praxis"
        ? groupKey
        : [roleTitle, level].filter((p) => p !== "").join(" · ")
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingGroupAnalysisUpdated,
      payload: {
        runId,
        scope,
        groupLabel,
        changes,
      },
    })
    return null
  },
})
