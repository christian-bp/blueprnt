import { defineSchema } from "convex/server"
import { users, organizations } from "./accounts/tables"
import { aiUsageEvents, aiUsageMonthly } from "./ai/tables"
import { roleFamilies, roles, ratings } from "./assessment/tables"
import { models, criteria } from "./evaluationModel/tables"
import { emails } from "./email/tables"
import { auditLog, suggestions } from "./shared/tables"

// Nine domain tables by design (ADR-0006): aggregates (anchors, band
// thresholds) live on their parent documents and the fixed V1 track schema is
// constants, so only entities with external references or independent write
// paths get a table of their own. The two aiUsage* tables are append-only
// telemetry / rollup for AI cost tracking (spec 2026-06-10), outside that
// domain count.
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
  aiUsageEvents,
  aiUsageMonthly,
})
