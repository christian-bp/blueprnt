import { MIN_CRITERIA } from "@workspace/core"
import { v } from "convex/values"
import { internalQuery } from "../_generated/server"
import { AUDIT_EVENTS, buildChanges, SETTINGS_AUDIT_FIELDS } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation, orgQuery } from "../lib/functions"

const settingsShape = v.object({
  orgId: v.string(),
  country: v.union(v.string(), v.null()),
  currency: v.union(v.string(), v.null()),
  language: v.union(v.string(), v.null()),
  employeeCount: v.union(v.number(), v.null()),
  industry: v.union(v.string(), v.null()),
})

export const getOrganizationSettings = orgQuery({
  args: {},
  returns: settingsShape,
  handler: async (ctx) => {
    const settings = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (settings === null) throw appError(ERROR_CODES.notFound)
    return {
      orgId: settings.orgId,
      country: settings.country ?? null,
      currency: settings.currency ?? null,
      language: settings.language ?? null,
      employeeCount: settings.employeeCount ?? null,
      industry: settings.industry ?? null,
    }
  },
})

// Upsert: if the trigger-seeded row exists, patch it; otherwise insert a new
// one. This makes it safe to call updateOrganizationSettings immediately after
// organization.create, before the onOrganizationCreate trigger has committed.
export const updateOrganizationSettings = adminMutation({
  args: {
    country: v.optional(v.string()),
    currency: v.optional(v.string()),
    language: v.optional(v.string()),
    employeeCount: v.optional(v.number()),
    industry: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (settings === null) {
      await ctx.db.insert("organizations", { orgId: ctx.orgId, ...args })
    } else {
      await ctx.db.patch(settings._id, args)
    }
    await ctx.audit.log({
      type: AUDIT_EVENTS.organizationSettingsUpdated,
      // `settings` is read before the write, so it is the correct before-state.
      // `created` flags the upsert-insert path; employeeCount is included so a
      // changed headcount is captured in the diff.
      payload: {
        created: settings === null,
        changes: buildChanges(settings ?? {}, args, SETTINGS_AUDIT_FIELDS),
      },
    })
    return null
  },
})

// Marks onboarding as finished by stamping onboardingCompletedAt. The gate
// trusts this explicit, persisted act instead of inferring "done" from the
// presence of a model. Upsert posture mirrors updateOrganizationSettings: insert
// an empty row if the trigger-seeded one is not there yet. Idempotent: the
// first timestamp is kept and no second audit row is written on re-calls.
// Composition floor: a model may not be finished with fewer than
// MIN_CRITERIA criteria (the wizard's Next gates enforce this in the UI;
// this is the server-side backstop).
export const completeOnboarding = adminMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    // Lifted to outer scope so the audit payload can report the criteria count.
    let count: number | null = null
    if (model !== null) {
      count = (
        await ctx.db
          .query("criteria")
          .withIndex("by_model", (q) => q.eq("modelId", model._id))
          .collect()
      ).length
      if (count < MIN_CRITERIA) throw appError(ERROR_CODES.tooFewCriteria)
    }
    const settings = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    // Hoisted so the stamped value and the audited `to` are identical.
    const completedAt = Date.now()
    if (settings === null) {
      await ctx.db.insert("organizations", {
        orgId: ctx.orgId,
        onboardingCompletedAt: completedAt,
      })
    } else {
      if (typeof settings.onboardingCompletedAt === "number") return null
      await ctx.db.patch(settings._id, { onboardingCompletedAt: completedAt })
    }
    await ctx.audit.log({
      type: AUDIT_EVENTS.onboardingCompleted,
      // The early-return guard means a re-stamp never reaches here, so `from` is
      // structurally null: this is a one-time completion stamp, not an edit.
      payload: {
        created: settings === null,
        criteriaCount: count ?? null,
        hadModel: model !== null,
        changes: {
          onboardingCompletedAt: {
            from: settings?.onboardingCompletedAt ?? null,
            to: completedAt,
          },
        },
      },
    })
    return null
  },
})

// Used by the auth invitation callback to resolve the organization's language so
// the invite email goes out in the org's locale. Not org-scoped: the caller is
// Better Auth (no app session), and it only exposes the language.
export const getLanguageForOrg = internalQuery({
  args: { orgId: v.string() },
  returns: v.union(
    v.null(),
    v.object({ language: v.union(v.string(), v.null()) })
  ),
  handler: async (ctx, { orgId }) => {
    const settings = await ctx.db
      .query("organizations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique()
    if (settings === null) return null
    return { language: settings.language ?? null }
  },
})
