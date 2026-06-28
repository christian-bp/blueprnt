import { defineSchema } from "convex/server"
import generatedSchema from "./generatedSchema"

// generatedSchema.ts is overwritten by schema regeneration; custom indexes
// live here so regeneration never loses them.
// Never regenerate THIS file; only generatedSchema.ts is generated (from
// inside this directory, see its header). If member is missing here after a
// regen, the generator dropped the table, not just the index (bug #157).
export default defineSchema({
  ...generatedSchema.tables,
  member: generatedSchema.tables.member.index("organizationId_userId", [
    "organizationId",
    "userId",
  ]),
  // The organization plugin looks up invitations by (email, organizationId,
  // status) when inviting and by (organizationId, status) when listing. The
  // adapter selects an index by matching the where fields in order, so these
  // compound indexes keep both lookups off a full table scan.
  invitation: generatedSchema.tables.invitation
    .index("email_organizationId_status", ["email", "organizationId", "status"])
    .index("organizationId_status", ["organizationId", "status"]),
})
