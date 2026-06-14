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

// Roles per model call, kept small ON PURPOSE. generateRoleProfileBatch wraps a
// single completion in AbortSignal.timeout(60_000), and generating many full
// { purpose, responsibilities } profiles in one completion does not finish in
// 60s. A small chunk (~5) keeps each call's output small enough to beat the
// timeout, so the empty roles of an onboarding org are split into ceil(n / 5)
// chunks instead of one oversized request.
const PREFILL_MAX_PER_CALL = 5

// How many chunks may have a model request in flight at once. The chunks run in
// WAVES of this size (Promise.all over up to this many chunks, waves one after
// another), so a large set finishes in a few waves instead of strictly serial
// calls, while the number of concurrent model requests stays bounded. Kept low
// (2): the EU model's rate limit is tight enough that a wave of 4 tripped it
// ("Rate limit exceeded") on a ~40 role set. With 2 in flight plus the model
// call's own 429 backoff (maxRetries in generateRoleProfileBatch, which spaces
// retried requests out), the effective request rate stays under the limit; a
// chunk that still exhausts its retries is isolated and the frontend re-runs
// prefill once to re-target whatever stayed empty.
const PREFILL_CONCURRENCY = 2

// Auto-applies AI-drafted job profiles for an org's roles whose profile is
// still empty, during onboarding. Collects every empty-profile role, splits
// them into small chunks (PREFILL_MAX_PER_CALL), and for each chunk makes ONE
// structured-object call that returns one profile per role in the chunk
// (generateRoleProfileBatch); each returned profile is applied directly to its
// role (applyPrefill) instead of routing through the suggestion/confirm flow.
// The chunks run in bounded-concurrency WAVES (PREFILL_CONCURRENCY at a time),
// and each call stays small enough to beat generateRoleProfileBatch's 60s
// per-call timeout.
//
// ADR-0003 note: this is a deliberate, scoped softening of "AI output is a
// suggestion HR confirms". The auto-applied text is name-derived profile copy
// the user edits later, and the deterministic score/band path never depends
// on it (ADR-0002). Provenance is preserved by: one aiUsageEvents row PER CALL
// and a per-role role.updated audit row (written by applyPrefill).
//
// Roles with a non-empty profile are EXCLUDED before any model call, so
// revisiting onboarding with no new empty roles costs nothing. Each chunk is
// independent: a chunk that throws (rate limit, timeout, or an index-misaligned
// response) leaves that chunk's roles empty + counted failed, without aborting
// the other chunks in its wave (or any later wave) and without a partial write
// within the failed chunk.
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
    // Slice the targets into small chunks, then run those chunks in waves of
    // PREFILL_CONCURRENCY so at most that many model requests are ever in flight
    // (a wave is a Promise.all over up to PREFILL_CONCURRENCY chunks; waves run
    // one after another). Each chunk commits its own results as soon as it
    // resolves (applyPrefill per role), which is what drives the frontend
    // progress. Even 100 roles is 20 chunks over 5 waves of fast calls, well
    // within an action's wall-clock budget.
    const chunks: PrefillTarget[][] = []
    for (let i = 0; i < targets.length; i += PREFILL_MAX_PER_CALL) {
      chunks.push(targets.slice(i, i + PREFILL_MAX_PER_CALL))
    }

    let generated = 0
    let failed = 0
    for (let i = 0; i < chunks.length; i += PREFILL_CONCURRENCY) {
      const wave = chunks.slice(i, i + PREFILL_CONCURRENCY)
      // prefillChunk is self-contained: it try/catches and resolves to the
      // applied count (never rejects), so Promise.all over a wave never rejects
      // and one bad chunk cannot fail the rest of its wave.
      const appliedCounts = await Promise.all(
        wave.map((chunk) =>
          prefillChunk(ctx, { orgId, actorId, context, chunk })
        )
      )
      for (let w = 0; w < wave.length; w++) {
        const applied = appliedCounts[w] ?? 0
        generated += applied
        failed += (wave[w]?.length ?? 0) - applied
      }
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
