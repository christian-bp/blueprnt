import { defineSchema } from "convex/server"
import { users, workspaceProfiles } from "./accounts/tables"
import { roles, ratings } from "./assessment/tables"
import {
  models,
  criteria,
  criterionAnchors,
  tracks,
  levels,
  trackGuardrails,
  bandThresholds,
} from "./evaluationModel/tables"
import { emails } from "./email/tables"
import { auditLog, suggestions } from "./shared/tables"

export default defineSchema({
  users,
  workspaceProfiles,
  emails,
  auditLog,
  models,
  criteria,
  criterionAnchors,
  tracks,
  levels,
  trackGuardrails,
  bandThresholds,
  roles,
  ratings,
  suggestions,
})
