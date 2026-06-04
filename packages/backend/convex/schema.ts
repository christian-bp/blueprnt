import { defineSchema } from "convex/server"
import { users, workspaceProfiles } from "./accounts/tables"
import { emails } from "./email/tables"
import { auditLog } from "./shared/tables"

export default defineSchema({
  users,
  workspaceProfiles,
  emails,
  auditLog,
})
