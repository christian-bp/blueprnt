"use node"

import { v } from "convex/values"
import { SUGGESTION_KINDS } from "@workspace/constants"
import { internal } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { type ActionCtx, action } from "../_generated/server"
import { ERROR_CODES } from "../lib/errors"
import { AI_MODEL_ID, AI_PROVIDER } from "./config"
import { generateRoleProfileBatch } from "./generate"

// One role that needs prefilling, resolved by the internal query: the title +
// HR context the prompt consumes, plus the org's company context (the AI
// settings the draft flow also reads). Roles that already have a profile are
// never returned here, so they cost no model call.
interface PrefillTarget {
  roleId: Id<"roles">
  title: string
  trackName: string
  roleFunction: string
  team: string
  // Present only for roles that belong to a family (collectPrefillTargets
  // omits the key otherwise); fed into the prompt's role-identity line.
  family?: string
}

interface PrefillContext {
  locale: string
  industry: string
  employeeCount?: number
  country: string
}

// Safety cap on roles per model call. The normal case is one call for the few
// empty roles an onboarding org has (template roles ship with predefined
// profiles, so only renamed/new/pasted roles ever reach here). An unusually
// large set is split into ceil(n / cap) SEQUENTIAL calls (at most one in
// flight) so a single request never grows unbounded.
const PREFILL_MAX_PER_CALL = 30

// Auto-applies AI-drafted job profiles for an org's roles whose profile is
// still empty, during onboarding. Collects every empty-profile role and, in
// the normal case, makes ONE structured-object call that returns one profile
// per role (generateRoleProfileBatch); each returned profile is applied
// directly to its role (applyPrefill) instead of routing through the
// suggestion/confirm flow. An unusually large set is split into a few
// sequential calls under PREFILL_MAX_PER_CALL.
//
// ADR-0003 note: this is a deliberate, scoped softening of "AI output is a
// suggestion HR confirms". The auto-applied text is name-derived profile copy
// the user edits later, and the deterministic score/band path never depends
// on it (ADR-0002). Provenance is preserved by: one aiUsageEvents row PER CALL
// and a per-role role.updated audit row (written by applyPrefill).
//
// Roles with a non-empty profile are EXCLUDED before any model call, so
// revisiting onboarding with no new empty roles costs nothing. Each call is
// independent: a call that throws (rate limit, timeout, or an index-misaligned
// response) leaves that call's roles empty + counted failed, without aborting
// the other (rare) chunks and without a partial write within the failed call.
export const prefillRoleProfiles = action({
  args: { orgId: v.string() },
  returns: v.object({ generated: v.number(), failed: v.number() }),
  handler: async (
    ctx,
    { orgId }
  ): Promise<{ generated: number; failed: number }> => {
    // Org scope: resolve identity + membership exactly like the org function
    // wrapper, but from an action (which has ctx.auth but no ctx.db). The
    // internal query re-checks the membership and only ever reads THIS org's
    // roles, so a foreign org is rejected before any model call.
    const identity = await ctx.auth.getUserIdentity()
    if (identity === null) throw new Error(ERROR_CODES.notAuthenticated)

    const { targets, context, actorId } = await ctx.runQuery(
      internal.ai.prefillData.collectPrefillTargets,
      { orgId, userId: identity.subject }
    )

    // No empty roles -> no model call (the "no changes -> no AI" gate).
    let generated = 0
    let failed = 0
    for (let i = 0; i < targets.length; i += PREFILL_MAX_PER_CALL) {
      const chunk = targets.slice(i, i + PREFILL_MAX_PER_CALL)
      const applied = await prefillChunk(ctx, {
        orgId,
        actorId,
        context,
        chunk,
      })
      generated += applied
      failed += chunk.length - applied
    }
    return { generated, failed }
  },
})

// Generates profiles for ONE chunk of empty roles in a single batched call and
// applies each by index, then logs ONE usage event for the whole call. Returns
// how many roles were applied (the caller derives the failed count from the
// chunk size). A failed call (model unavailable, generation error, or an
// index-misaligned response) returns 0 applied with NO partial write: usage is
// logged only after a successful generation, and no role is patched.
async function prefillChunk(
  ctx: ActionCtx,
  args: {
    orgId: string
    actorId: string
    context: PrefillContext
    chunk: PrefillTarget[]
  }
): Promise<number> {
  const { orgId, actorId, context, chunk } = args
  const roleInputs = chunk.map((target) => ({
    locale: context.locale,
    industry: context.industry,
    country: context.country,
    ...(context.employeeCount !== undefined
      ? { employeeCount: context.employeeCount }
      : {}),
    title: target.title,
    trackName: target.trackName,
    roleFunction: target.roleFunction,
    team: target.team,
    ...(target.family !== undefined ? { family: target.family } : {}),
  }))

  try {
    const { profiles, usage } = await generateRoleProfileBatch(
      context,
      roleInputs
    )
    // One usage event per CALL (not per role), attributed directly to the org
    // and the caller (no per-role suggestion row to derive it from). Best
    // effort: a usage-write failure must not undo the successful generation.
    try {
      await ctx.runMutation(internal.ai.usage.recordAiUsageDirect, {
        orgId,
        kind: SUGGESTION_KINDS.roleProfile,
        provider: AI_PROVIDER,
        model: AI_MODEL_ID,
        actorId,
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        totalTokens: usage.totalTokens ?? 0,
        cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
      })
    } catch (error) {
      console.error("prefill usage recording failed", {
        orgId,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    // generateRoleProfileBatch returns profiles ordered to match roleInputs
    // (index-aligned), so profiles[i] belongs to chunk[i]. applyPrefill keeps
    // the lock re-check + trust-boundary validation and writes the per-role
    // role.updated audit row that is now the provenance.
    let applied = 0
    for (let i = 0; i < chunk.length; i++) {
      const target = chunk[i]
      const profile = profiles[i]
      if (target === undefined || profile === undefined) continue
      const didApply: boolean = await ctx.runMutation(
        internal.ai.prefillData.applyPrefill,
        { orgId, roleId: target.roleId, actorId, profile }
      )
      if (didApply) applied += 1
    }
    return applied
  } catch (error) {
    // The whole call failed (or its response was misaligned): leave every role
    // in the chunk empty, no partial write. The frontend offers a manual
    // fallback for an empty profile.
    console.error("role profile prefill call failed", {
      orgId,
      roles: chunk.length,
      error: error instanceof Error ? error.message : String(error),
    })
    return 0
  }
}
