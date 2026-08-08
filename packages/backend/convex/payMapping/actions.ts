import { v } from "convex/values"
import { components } from "../_generated/api"
import {
  ACTION_AUDIT_FIELDS,
  ACTION_UPDATE_AUDIT_FIELDS,
  AUDIT_EVENTS,
  buildChanges,
  buildCreateChanges,
  resolveActorName,
} from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation, orgQuery } from "../lib/functions"
import {
  actionTargetValidator,
  payGapReasonValidator,
  payMappingActionPriorityValidator,
  payMappingActionStatusValidator,
} from "./tables"
import {
  assertActionNumbersValid,
  assertOwnerIsMember,
  plannedDateIso,
  resolveTargetLabel,
  snapshotRowsForRun,
  targetLabelFromRows,
  validateTarget,
} from "./workLayer"

// The audit-diff view of an action's structured fields (ACTION_AUDIT_FIELDS):
// free text, owner, and cost deliberately never enter the trail (ADR-0015).
function auditView(action: {
  status: string
  priority: string
  reason?: string
  plannedDate: number
}) {
  return {
    status: action.status,
    priority: action.priority,
    reason: action.reason ?? null,
    plannedDate: plannedDateIso(action.plannedDate),
  }
}

const actionShape = v.object({
  actionId: v.id("payMappingActions"),
  target: actionTargetValidator,
  problem: v.string(),
  plannedAction: v.string(),
  reason: v.union(payGapReasonValidator, v.null()),
  ownerUserId: v.string(),
  ownerName: v.string(),
  plannedDate: v.number(),
  estimatedCost: v.union(v.number(), v.null()),
  priority: payMappingActionPriorityValidator,
  status: payMappingActionStatusValidator,
  createdAt: v.number(),
})

// The run's actions, newest first, with owner names resolved at read time
// (erasure/renames stay accurate; never frozen onto the row).
export const listActions = orgQuery({
  args: { runId: v.id("payMappingRuns") },
  returns: v.array(actionShape),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId) return []
    const actions = await ctx.db
      .query("payMappingActions")
      .withIndex("by_run", (q) => q.eq("orgId", ctx.orgId).eq("runId", runId))
      .collect()
    actions.sort((a, b) => b.createdAt - a.createdAt)
    const distinctOwners = [...new Set(actions.map((a) => a.ownerUserId))]
    const nameById = new Map(
      await Promise.all(
        distinctOwners.map(
          async (id) => [id, await resolveActorName(ctx, id)] as const
        )
      )
    )
    return actions.map((a) => ({
      actionId: a._id,
      target: a.target,
      problem: a.problem,
      plannedAction: a.plannedAction,
      reason: a.reason ?? null,
      ownerUserId: a.ownerUserId,
      ownerName: nameById.get(a.ownerUserId) ?? "unknown",
      plannedDate: a.plannedDate,
      estimatedCost: a.estimatedCost ?? null,
      priority: a.priority,
      status: a.status,
      createdAt: a.createdAt,
    }))
  },
})

// The assignable owners (every org member, id + name only): the action
// dialog's Ansvarig select. Editors create actions too, so this is org-wide,
// unlike the admin-only team roster.
export const listActionOwners = orgQuery({
  args: {},
  returns: v.array(v.object({ userId: v.string(), name: v.string() })),
  handler: async (ctx) => {
    const members: { userId: string; name: string; email: string }[] =
      await ctx.runQuery(components.betterAuth.provisioning.listMembers, {
        organizationId: ctx.orgId,
      })
    // A member without a name falls back to the email's local part, never
    // the full address: this roster is org-wide (editors assign owners),
    // and a name lookup must not turn into an email disclosure.
    return members.map((m) => ({
      userId: m.userId,
      name: m.name || (m.email.split("@")[0] ?? m.email),
    }))
  },
})

const actionContentArgs = {
  target: actionTargetValidator,
  problem: v.string(),
  plannedAction: v.string(),
  reason: v.optional(payGapReasonValidator),
  ownerUserId: v.string(),
  plannedDate: v.number(),
  estimatedCost: v.optional(v.number()),
  priority: payMappingActionPriorityValidator,
}

export const createAction = orgMutation({
  args: { runId: v.id("payMappingRuns"), ...actionContentArgs },
  returns: v.id("payMappingActions"),
  handler: async (ctx, { runId, ...content }) => {
    const run = await ctx.db.get(runId)
    if (run === null || run.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    // Creation locks with the rest of the work layer: new actions after
    // completion belong to the next year's run.
    if (run.status === "completed")
      throw appError(ERROR_CODES.payMappingRunCompleted)
    if (content.problem.trim() === "" || content.plannedAction.trim() === "")
      throw appError(ERROR_CODES.invalidInput)
    assertActionNumbersValid(content)

    const rows = await snapshotRowsForRun(ctx, ctx.orgId, runId)
    const { targetLabel } = validateTarget(rows, content.target, {
      allowExcludedGroups: false,
    })
    const members: { userId: string }[] = await ctx.runQuery(
      components.betterAuth.provisioning.listMembers,
      { organizationId: ctx.orgId }
    )
    assertOwnerIsMember(members, content.ownerUserId)

    const doc = {
      orgId: ctx.orgId,
      runId,
      target: content.target,
      problem: content.problem.trim(),
      plannedAction: content.plannedAction.trim(),
      ...(content.reason !== undefined ? { reason: content.reason } : {}),
      ownerUserId: content.ownerUserId,
      plannedDate: content.plannedDate,
      ...(content.estimatedCost !== undefined
        ? { estimatedCost: content.estimatedCost }
        : {}),
      priority: content.priority,
      status: "notStarted" as const,
      createdBy: ctx.authUserId,
      createdAt: Date.now(),
    }
    const actionId = await ctx.db.insert("payMappingActions", doc)
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingActionCreated,
      payload: {
        runId,
        actionId,
        targetKind: content.target.kind,
        targetLabel,
        // An optional field the user left unset is not a "change" on
        // create: including it rendered as an empty-valued row
        // ("Sakligt skäl: ") in the log.
        changes: Object.fromEntries(
          Object.entries(
            buildCreateChanges(auditView(doc), ACTION_AUDIT_FIELDS)
          ).filter(([, change]) => change.to !== null)
        ),
      },
    })
    return actionId
  },
})

export const updateAction = orgMutation({
  args: { actionId: v.id("payMappingActions"), ...actionContentArgs },
  returns: v.null(),
  handler: async (ctx, { actionId, ...content }) => {
    const action = await ctx.db.get(actionId)
    if (action === null || action.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    const run = await ctx.db.get(action.runId)
    if (run === null) throw appError(ERROR_CODES.notFound)
    // Content edits lock with the run; only status moves stay open
    // (setActionStatus below).
    if (run.status === "completed")
      throw appError(ERROR_CODES.payMappingRunCompleted)
    if (content.problem.trim() === "" || content.plannedAction.trim() === "")
      throw appError(ERROR_CODES.invalidInput)
    assertActionNumbersValid(content)

    const rows = await snapshotRowsForRun(ctx, ctx.orgId, action.runId)
    const { targetLabel } = validateTarget(rows, content.target, {
      allowExcludedGroups: false,
    })
    const members: { userId: string }[] = await ctx.runQuery(
      components.betterAuth.provisioning.listMembers,
      { organizationId: ctx.orgId }
    )
    assertOwnerIsMember(members, content.ownerUserId)

    const next = {
      target: content.target,
      problem: content.problem.trim(),
      plannedAction: content.plannedAction.trim(),
      reason: content.reason,
      ownerUserId: content.ownerUserId,
      plannedDate: content.plannedDate,
      estimatedCost: content.estimatedCost,
      priority: content.priority,
    }
    await ctx.db.patch(actionId, next)
    // The diff covers the structured fields AND the target (a re-target must
    // never render as a no-op row), plus the detailsChanged marker when an
    // edit only touched the untrailed fields (free text, owner, cost).
    const changes = buildChanges(
      {
        ...auditView(action),
        targetKind: action.target.kind,
        targetLabel: targetLabelFromRows(rows, action.target),
      },
      {
        ...auditView({ ...next, status: action.status }),
        targetKind: content.target.kind,
        targetLabel,
      },
      // detailsChanged is absent from both views, so buildChanges skips it
      // here; it is set explicitly below when the marker applies.
      [...ACTION_AUDIT_FIELDS, ...ACTION_UPDATE_AUDIT_FIELDS]
    )
    const detailsChanged =
      action.problem !== next.problem ||
      action.plannedAction !== next.plannedAction ||
      action.ownerUserId !== next.ownerUserId ||
      (action.estimatedCost ?? null) !== (content.estimatedCost ?? null)
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingActionUpdated,
      payload: {
        runId: action.runId,
        actionId,
        targetLabel,
        changes: {
          ...changes,
          ...(detailsChanged
            ? { detailsChanged: { from: null, to: true } }
            : {}),
        },
      },
    })
    return null
  },
})

// Status moves stay allowed on a completed run: the action plan is executed
// and followed up over years, long after the kartläggning itself is sealed
// (ADR-0015).
export const setActionStatus = orgMutation({
  args: {
    actionId: v.id("payMappingActions"),
    status: payMappingActionStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, { actionId, status }) => {
    const action = await ctx.db.get(actionId)
    if (action === null || action.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    if (action.status === status) return null
    await ctx.db.patch(actionId, { status })
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingActionStatusChanged,
      payload: {
        runId: action.runId,
        actionId,
        targetLabel: resolveTargetLabel(action.target),
        changes: { status: { from: action.status, to: status } },
      },
    })
    return null
  },
})

export const deleteAction = orgMutation({
  args: { actionId: v.id("payMappingActions") },
  returns: v.null(),
  handler: async (ctx, { actionId }) => {
    const action = await ctx.db.get(actionId)
    if (action === null || action.orgId !== ctx.orgId)
      throw appError(ERROR_CODES.notFound)
    const run = await ctx.db.get(action.runId)
    if (run === null) throw appError(ERROR_CODES.notFound)
    // A completed run's action plan is part of the sealed documentation.
    if (run.status === "completed")
      throw appError(ERROR_CODES.payMappingRunCompleted)
    const targetLabel = resolveTargetLabel(action.target)
    await ctx.db.delete(actionId)
    await ctx.audit.log({
      type: AUDIT_EVENTS.payMappingActionDeleted,
      payload: {
        runId: action.runId,
        actionId,
        targetKind: action.target.kind,
        targetLabel,
      },
    })
    return null
  },
})
