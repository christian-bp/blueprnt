import { defineSchema } from "convex/server"
import generatedSchema from "./generatedSchema"

// generatedSchema.ts is overwritten by schema regeneration; custom indexes
// live here so regeneration never loses them.
export default defineSchema({
  ...generatedSchema.tables,
  member: generatedSchema.tables.member.index("organizationId_userId", [
    "organizationId",
    "userId",
  ]),
})
