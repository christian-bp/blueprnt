"use node"

import { v } from "convex/values"
import { internal } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { type ActionCtx, action } from "../_generated/server"
import { ERROR_CODES } from "../lib/errors"
import { generateRoleProfile } from "./generate"

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
}

interface PrefillContext {
  locale: string
  industry: string
  employeeCount?: number
  country: string
}

// One model call per role, so cap how many run at once: a full starter set
// fired in parallel bursts past the EU model's rate limit. Small sequential
// waves keep us under it (and once template roles ship with predefined
// profiles, only the few renamed/new/pasted roles ever reach here).
const PREFILL_CONCURRENCY = 3

// Auto-applies AI-drafted job profiles for an org's roles whose profile is
// still empty, during onboarding. For each empty-profile role it generates a
// { purpose, responsibilities } from the role TITLE with the SAME logic the
// draft flow uses (generateRoleProfile), then APPLIES it directly instead of
// routing through the suggestion/confirm flow.
//
// ADR-0003 note: this is a deliberate, scoped softening of "AI output is a
// suggestion HR confirms". The auto-applied text is name-derived profile copy
// the user edits later, and the deterministic score/band path never depends
// on it (ADR-0002). Provenance is preserved: every generation still creates a
// suggestion row (confirmed by the caller), an aiUsageEvents row, and a
// role.updated audit row.
//
// Roles with a non-empty profile are SKIPPED with no model call, so revisiting
// onboarding with no new empty roles costs nothing. Generations run in small
// throttled waves (PREFILL_CONCURRENCY) so a full set never bursts the model's
// rate limit; each is independent, so one role's failure leaves that role empty
// (the frontend offers a manual fallback) without aborting the others.
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

    // Throttle into sequential waves of PREFILL_CONCURRENCY so we never fire
    // the whole starter set at the model at once (the rate-limit cause). Each
    // role is independent; a failure within a wave leaves that role empty
    // without aborting the rest.
    let generated = 0
    let failed = 0
    for (let i = 0; i < targets.length; i += PREFILL_CONCURRENCY) {
      const wave = targets.slice(i, i + PREFILL_CONCURRENCY)
      const results = await Promise.allSettled(
        wave.map((target) =>
          prefillOne(ctx, { orgId, actorId, target, context })
        )
      )
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) generated += 1
        else failed += 1
      }
    }
    return { generated, failed }
  },
})

// Generates and auto-applies one role's profile. Each role owns its OWN
// suggestion row so usage logging derives org/kind/actor from it exactly like
// the draft flow, and the role.updated audit row records the auto-apply. A
// failure marks the suggestion failed and leaves the role empty; it never
// throws, so Promise.allSettled isolation is belt-and-suspenders.
async function prefillOne(
  ctx: ActionCtx,
  args: {
    orgId: string
    actorId: string
    target: PrefillTarget
    context: PrefillContext
  }
): Promise<boolean> {
  const { orgId, actorId, target, context } = args
  const suggestionId = await ctx.runMutation(
    internal.ai.prefillData.openPrefillSuggestion,
    { orgId, roleId: target.roleId, requestedBy: actorId }
  )
  try {
    const profile = await generateRoleProfile(ctx, suggestionId, {
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
    })
    await ctx.runMutation(internal.ai.prefillData.applyPrefill, {
      suggestionId,
      orgId,
      roleId: target.roleId,
      actorId,
      profile,
    })
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("role profile prefill failed", {
      roleId: target.roleId,
      error: message,
    })
    await ctx.runMutation(internal.ai.persist.markFailed, {
      suggestionId,
      errorCode:
        message === ERROR_CODES.aiUnavailable
          ? ERROR_CODES.aiUnavailable
          : ERROR_CODES.aiGenerationFailed,
    })
    return false
  }
}
