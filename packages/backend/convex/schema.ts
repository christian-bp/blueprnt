import { defineSchema } from "convex/server"
import { users, workspaceProfiles } from "./accounts/tables"
import { auditLog } from "./shared/tables"

export default defineSchema({
  users,
  workspaceProfiles,
  auditLog,
})
