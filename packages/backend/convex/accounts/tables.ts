import { defineTable } from "convex/server"
import { v } from "convex/values"

// Thin mirror of Better Auth users (authId = Better Auth user id). Holds
// app-side per-user settings (locale) and gives audit log a join target.
export const users = defineTable({
  authId: v.string(),
  name: v.string(),
  email: v.string(),
  locale: v.optional(v.string()),
}).index("by_auth_id", ["authId"])

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
