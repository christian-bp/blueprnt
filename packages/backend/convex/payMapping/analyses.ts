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
import {
  comparisonDocumentationKey,
  comparisonKeysForGroup,
  requiredDocumentationKeys,
} from "./gap"
import { payGapReasonValidator, payMappingFindingValidator } from "./tables"
import { groupKeyLabel } from "./workLayer"

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
  // Null on the group's own row (klarmarkering + summary note) and on every
  // equalWork row; set to the comparator's key on an equivalentWork row that
  // explains ONE comparison.
  comparisonKey: v.union(v.string(), v.null()),
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
      comparisonKey: row.comparisonKey ?? null,
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
    // equivalentWork only: documents the difference against ONE comparator
    // instead of the group as a whole (DL 3 kap. 9 § asks about each).
    comparisonKey: v.optional(v.string()),
    reasons: v.array(payGapReasonValidator),
    note: v.optional(v.string()),
    done: v.boolean(),
    finding: v.optional(payMappingFindingValidator),
  },
  returns: v.null(),
  handler: async (
    ctx,
    { runId, scope, groupKey, comparisonKey, reasons, note, done, finding }
  ) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    // A completed kartläggning is locked: its documentation is what was
    // certified. Reopen (overview) to edit.
    if (run.status === "completed")
      throw appError(ERROR_CODES.payMappingRunCompleted)

    const trimmedNote = note?.trim() ?? ""

    const rowsForRun = await ctx.db
      .query("payMappingGroupAnalyses")
      .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", runId))
      .collect()
    // The comparison key is part of the row's identity: the group's own row
    // and each comparison's row are separate documents, so documenting a
    // comparison must never patch the row holding the klarmarkering.
    const existing = rowsForRun.find(
      (row) =>
        row.scope === scope &&
        row.groupKey === groupKey &&
        (row.comparisonKey ?? null) === (comparisonKey ?? null)
    )

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
      if (comparisonKey !== undefined) {
        // Equal work compares WITHIN one group (DL 3 kap. 8 § p2), so it has
        // no comparator to key a row against.
        if (scope !== "equivalentWork") throw appError(ERROR_CODES.invalidInput)
        if (
          !keys.womenDominatedComparisonsAll.has(
            comparisonDocumentationKey(groupKey, comparisonKey)
          )
        )
          throw appError(ERROR_CODES.notFound)
      }
      // The gate's rule, enforced server-side from the snapshot: never trust
      // the client's flag. Equal work asks the group for one explanation;
      // equivalent work asks every comparison for its own, because every
      // comparator in that table out-earns the group and 3 kap. 9 § asks
      // about each difference separately.
      //
      // What counts as an explanation is the SAME on both: a reason from the
      // taxonomy, or a written assessment. The law asks for a bedömning, not
      // for our chip taxonomy, and a rule that took the note for equal work
      // and refused it here left a reader who had written one per row unable
      // to close the group and unable to see why.
      if (done && required.has(groupKey)) {
        if (scope === "equivalentWork") {
          const explained = new Set(
            rowsForRun
              .filter(
                (row) =>
                  row.scope === "equivalentWork" &&
                  row.groupKey === groupKey &&
                  row.comparisonKey !== undefined &&
                  (row.reasons.length > 0 || (row.note ?? "").trim() !== "")
              )
              .map((row) => row.comparisonKey)
          )
          // This call may be the one explaining the last comparison.
          if (
            comparisonKey !== undefined &&
            (reasons.length > 0 || trimmedNote !== "")
          )
            explained.add(comparisonKey)
          const unexplained = comparisonKeysForGroup(
            keys.womenDominatedComparisonsAll,
            groupKey
          ).some((key) => !explained.has(key))
          if (unexplained)
            throw appError(ERROR_CODES.payMappingDocumentationRequired)
        } else if (reasons.length === 0 && trimmedNote === "") {
          throw appError(ERROR_CODES.payMappingDocumentationRequired)
        }
      }
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
        // Part of the row's identity, so it belongs on the insert rather than
        // in `next` (which is also what a patch applies, and a patch must
        // never move an existing row to another comparison).
        ...(comparisonKey !== undefined ? { comparisonKey } : {}),
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
    // groupKeyLabel resolves the key to display text (the role title)
    // for equalWork/equivalentWork: the trail never shows a raw internal key.
    // Praxis' groupKey is already a constant area-key slug (PRAXIS_AREA_KEYS),
    // not a composed group key: never split it on "|", log it as the raw key
    // (a stable, non-PII display value).
    const groupLabel = scope === "praxis" ? groupKey : groupKeyLabel(groupKey)
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingGroupAnalysisUpdated,
      payload: {
        runId,
        scope,
        groupLabel,
        // Names the comparison this row explains, so a reader of the trail
        // sees which difference was documented, not only which group.
        ...(comparisonKey !== undefined
          ? { comparisonLabel: groupKeyLabel(comparisonKey) }
          : {}),
        changes,
      },
    })
    return null
  },
})

// Applies one explanation to every comparison of a women-dominated group that
// has none yet.
//
// An employer often has a single objective reason covering several
// comparators, and DL 3 kap. 9 § still wants that reason recorded against
// each difference it explains. Typing it once per row is what made a per-row
// rule look unworkable at scale; this is the shortcut that makes the rule
// hold without the typing. It never touches a comparison that already carries
// reasons, because that is a judgement the user made deliberately.
//
// One mutation rather than a client loop: the fill is one atomic write, and a
// group's comparator count is bounded (the comparators of one level band),
// so it stays well inside a transaction's document limits.
export const applyReasonsToRemainingComparisons = orgMutation({
  args: {
    runId: v.id("payMappingRuns"),
    groupKey: v.string(),
    reasons: v.array(payGapReasonValidator),
  },
  returns: v.null(),
  handler: async (ctx, { runId, groupKey, reasons }) => {
    // A fill with nothing to fill in would silently mark every remaining
    // comparison as "explained by nothing".
    if (reasons.length === 0) throw appError(ERROR_CODES.invalidInput)
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    if (run.status === "completed")
      throw appError(ERROR_CODES.payMappingRunCompleted)

    const snapshotRows = await ctx.db
      .query("payMappingSnapshotRows")
      .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", runId))
      .collect()
    const keys = requiredDocumentationKeys(snapshotRows)
    if (!keys.womenDominatedAll.has(groupKey))
      throw appError(ERROR_CODES.notFound)

    const rowsForRun = await ctx.db
      .query("payMappingGroupAnalyses")
      .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", runId))
      .collect()
    const canonical = canonicalReasons(reasons)

    let filled = 0
    for (const comparisonKey of comparisonKeysForGroup(
      keys.womenDominatedComparisonsAll,
      groupKey
    )) {
      const existing = rowsForRun.find(
        (row) =>
          row.scope === "equivalentWork" &&
          row.groupKey === groupKey &&
          row.comparisonKey === comparisonKey
      )
      if (existing !== undefined && existing.reasons.length > 0) continue
      filled += 1
      if (existing === undefined) {
        await ctx.db.insert("payMappingGroupAnalyses", {
          orgId: ctx.orgId,
          runId,
          scope: "equivalentWork",
          groupKey,
          comparisonKey,
          reasons: canonical,
          done: false,
        })
      } else {
        await ctx.db.patch(existing._id, { reasons: canonical })
      }
    }

    // One audit row for the whole fill, carrying how many comparisons it
    // touched: a row per comparison would bury the trail under an action the
    // user experienced as a single click.
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingGroupAnalysisUpdated,
      payload: {
        runId,
        scope: "equivalentWork",
        groupLabel: groupKeyLabel(groupKey),
        filledComparisons: filled,
        changes: {},
      },
    })
    return null
  },
})
