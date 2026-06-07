import { defineSchema } from "convex/server"
import { users, organizations } from "./accounts/tables"
import { roleFamilies, roles, ratings } from "./assessment/tables"
import { models, criteria } from "./evaluationModel/tables"
import { emails } from "./email/tables"
import { auditLog, suggestions } from "./shared/tables"

export default defineSchema({
  users,
  organizations,
  emails,
  auditLog,
  models,
  criteria,
  roleFamilies,
  roles,
  ratings,
  suggestions,
})
