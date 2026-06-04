import { defineSchema } from "convex/server"
import { users, workspaceProfiles } from "./accounts/tables"

export default defineSchema({
  users,
  workspaceProfiles,
})
