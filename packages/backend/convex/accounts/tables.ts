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

// One per workspace (orgId = Better Auth organization id). Seeded empty on
// org creation; the company-setup form fills it in a later slice.
export const workspaceProfiles = defineTable({
  orgId: v.string(),
  country: v.optional(v.string()),
  currency: v.optional(v.string()),
  language: v.optional(v.string()),
  employeeCount: v.optional(v.number()),
  businessType: v.optional(v.string()),
}).index("by_org", ["orgId"])
