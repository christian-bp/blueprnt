import { defineSchema } from "convex/server"
import { users, organizations } from "./accounts/tables"
import { roleFamilies, roles, ratings } from "./assessment/tables"
import { models, criteria } from "./evaluationModel/tables"
import { emails } from "./email/tables"
import { auditLog, suggestions } from "./shared/tables"

// Nine tables by design (ADR-0006): aggregates (anchors, band thresholds)
// live on their parent documents and the fixed V1 track schema is constants,
// so only entities with external references or independent write paths get
// a table of their own.
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
