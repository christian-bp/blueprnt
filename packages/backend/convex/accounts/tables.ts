import { defineTable } from "convex/server"
import { v } from "convex/values"

// Thin mirror of Better Auth users (authId = Better Auth user id). Holds
// app-side per-user settings (locale) and gives audit log a join target.
// isPlatformAdmin is the cross-org operator flag (see docs/adr): it is the
// ONLY authorization source for the platform admin page and is written ONLY
// by the out-of-band bootstrap path (internal mutation / dev seed), never by
// any client-callable or org-scoped mutation.
export const users = defineTable({
  authId: v.string(),
  name: v.string(),
  email: v.string(),
  locale: v.optional(v.string()),
  isPlatformAdmin: v.optional(v.boolean()),
  // Account-level 2FA state (per-person, independent of any org). The method
  // the user chose; mfaConfirmedAt is the authoritative "setup complete" signal
  // (Better Auth's twoFactorEnabled flips early under skipVerificationOnEnable).
  // Removed with the rest of the mirror row on GDPR erasure.
  mfaMethod: v.optional(v.union(v.literal("totp"), v.literal("email"))),
  mfaConfirmedAt: v.optional(v.number()),
  // The uploaded avatar's file-storage id. The avatar is PERSONAL DATA, so it
  // lives ONLY here on the per-person mirror and is deleted (file + field) when
  // the person is erased, by both the self-service (eraseSelf) and admin
  // (platform/admin.ts deleteUser) erase paths. Never copied to any domain
  // table (Role != Person).
  imageId: v.optional(v.id("_storage")),
})
  .index("by_auth_id", ["authId"])
  // Lookup index for the rare out-of-band bootstrap path that resolves a user
  // by email. Email UNIQUENESS is still enforced in Better Auth, not here; this
  // is only a non-scanning lookup so the bootstrap mutations avoid a full table
  // scan.
  .index("by_email", ["email"])

// App-side organization settings (country, currency, language, industry,
// employeeCount, onboardingCompletedAt, ...). Identity (name/slug/members) lives
// in the Better Auth component; this row is trigger-seeded on org creation and
// keyed by the component org id (orgId = Better Auth organization id).
export const organizations = defineTable({
  orgId: v.string(),
  country: v.optional(v.string()),
  currency: v.optional(v.string()),
  language: v.optional(v.string()),
  // Never asked in onboarding; derived in V2 from imported employees (decided 2026-06-05).
  employeeCount: v.optional(v.number()),
  industry: v.optional(v.string()),
  // Set once by completeOnboarding when the wizard finishes; the gate trusts
  // this, never inferred state.
  onboardingCompletedAt: v.optional(v.number()),
}).index("by_org", ["orgId"])
