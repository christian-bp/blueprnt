import { defineSchema } from "convex/server"
import { users, organizations } from "./accounts/tables"
import { aiUsageEvents, aiUsageMonthly } from "./ai/tables"
import { roleFamilies, roles, ratings } from "./assessment/tables"
import { models, criteria } from "./evaluationModel/tables"
import {
  people,
  personAssignments,
  payRecords,
  importMappingProfiles,
  importProgress,
} from "./people/tables"
import { auditLog, suggestions, platformAuditLog } from "./shared/tables"

// Minimal domain tables by design (ADR-0006): aggregates (anchors, band
// thresholds) live on their parent documents and the fixed V1 track schema is
// constants, so only entities with external references or independent write
// paths get a table of their own. Since ADR-0006 the set shifted: the operator
// log `platformAuditLog` was added (ADR-0009), and the former `emails` outbox
// table was retired when email moved to the Sweego component (its records live
// in that component now, not in the app schema). The two aiUsage* tables are
// append-only telemetry / rollup for AI cost tracking (spec 2026-06-10),
// outside that domain count.
export default defineSchema({
  users,
  organizations,
  auditLog,
  platformAuditLog,
  models,
  criteria,
  roleFamilies,
  roles,
  ratings,
  suggestions,
  aiUsageEvents,
  aiUsageMonthly,
  // people/pay bounded context (Plan 2, Task 1)
  people,
  personAssignments,
  payRecords,
  importMappingProfiles,
  importProgress,
})
