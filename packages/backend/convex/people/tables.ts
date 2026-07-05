import { defineTable } from "convex/server"
import { v } from "convex/values"

// Person registry: one row per individual in the org. Holds identity and
// HR-structural attributes only (Role != Person; GDPR). Salary/performance
// fields never live here. archivedAt is a leaver soft-archive, NOT erasure:
// hard delete removes the row and anonymises any audit snapshots.
export const people = defineTable({
  orgId: v.string(),
  // Anstnr (employee number): the import upsert key from the payroll export.
  // Optional so manually created persons don't need a system reference.
  externalRef: v.optional(v.string()),
  displayName: v.string(),
  // Gender categories as defined by Swedish pay-transparency reporting.
  gender: v.union(v.literal("Man"), v.literal("Kvinna")),
  // ISO 8601 date strings (YYYY-MM-DD). Stored as strings, not epoch, so
  // they are human-readable and locale-independent.
  birthDate: v.optional(v.string()),
  employmentStartDate: v.optional(v.string()),
  // Full-time equivalent as a percentage, e.g. 100 = full time, 80 = 80 %.
  ftePercent: v.optional(v.number()),
  // ISO 3166-1 alpha-2 country code of the work location, e.g. "SE".
  country: v.optional(v.string()),
  isManager: v.optional(v.boolean()),
  // SSYK/SNI statistical code for pay-gap reporting.
  statisticalCode: v.optional(v.string()),
  department: v.optional(v.string()),
  // Imported job title string (Befattning). Optional: manually created persons
  // may have no title on record. This is the primary matching signal for the
  // classification engine (title -> role). Not PII (a job title, not identity),
  // so it lives on the person row alongside HR-structural attributes.
  title: v.optional(v.string()),
  // Epoch ms timestamp. Set when the person leaves; null/absent means active.
  // Not a GDPR erasure: full erasure is a hard delete (see CLAUDE.md).
  archivedAt: v.optional(v.number()),
})
  .index("by_org", ["orgId"])
  // Compound index for import upsert: look up by org + employee number.
  .index("by_org_externalRef", ["orgId", "externalRef"])

// Role assignment per individual: connects a person to a role with a seniority
// level. Effective-dated so history is preserved when an assignment changes.
// A person may have at most one active assignment (endedAt absent) at a time;
// this invariant is enforced in mutations, not the schema.
export const personAssignments = defineTable({
  orgId: v.string(),
  personId: v.id("people"),
  roleId: v.id("roles"),
  // Per-individual seniority level within the role's track, e.g. "IC3", "Lead-2", "M1".
  level: v.string(),
  // Whether the level was set by AI suggestion or confirmed by HR.
  levelSource: v.union(v.literal("suggested"), v.literal("confirmed")),
  // Epoch ms: when this assignment became effective.
  effectiveAt: v.number(),
  // Epoch ms: when this assignment ended. Absent means currently active.
  endedAt: v.optional(v.number()),
})
  .index("by_org", ["orgId"])
  .index("by_person", ["orgId", "personId"])
  .index("by_role", ["orgId", "roleId"])

// Annual pay record per person. One row per (person, payYear, source). Total
// compensation for pay-gap analysis under the EU Pay Transparency Directive
// is derived as basicMonthly + sum(components[*].monthlyAmount); the derived
// value is never stored (computed on read by totalMonthlyComp in pay.ts).
export const payRecords = defineTable({
  orgId: v.string(),
  personId: v.id("people"),
  // Löneår: the salary year this record applies to.
  payYear: v.number(),
  // Whether this record came from a payroll import or was entered manually.
  source: v.union(v.literal("import"), v.literal("manual")),
  // Monthly basic salary (fast lön) in the org's currency. This is the Art. 9
  // basic-salary component, distinct from variable/bonus/benefit components.
  basicMonthly: v.number(),
  // ISO 4217 currency code, e.g. "SEK".
  currency: v.string(),
  // Extensible list of additional monthly compensation components beyond basic
  // salary. Each component carries a kind (free string, drawn from
  // PAY_COMPONENT_KINDS in @workspace/constants but not schema-constrained so
  // new kinds can be added without a migration) and its monthly amount.
  // An empty array is valid (basic salary only).
  components: v.array(
    v.object({ kind: v.string(), monthlyAmount: v.number() })
  ),
  // Epoch ms: when this pay record became effective.
  effectiveAt: v.number(),
  // Epoch ms: when this record was created in the system (for audit trail).
  createdAt: v.number(),
})
  .index("by_org", ["orgId"])
  .index("by_person", ["orgId", "personId"])

// Column-mapping profile for CSV/XLSX imports. One active profile per org
// (upserted on each import configuration save). Maps canonical field names
// (e.g. "displayName") to the source file's header (e.g. "Namn").
export const importMappingProfiles = defineTable({
  orgId: v.string(),
  // Canonical field name -> source column header.
  columnMap: v.record(v.string(), v.string()),
  // Optional parsing configuration, e.g. CSV delimiter.
  parseRules: v.optional(
    v.object({
      delimiter: v.optional(v.string()),
    })
  ),
  // Epoch ms: last time this profile was saved.
  updatedAt: v.number(),
}).index("by_org", ["orgId"])

// Live row-count progress for an in-flight payroll import. One row per org,
// written by the importPayroll action as it processes rows and deleted when
// the import finishes, so the importing screen can show real counts via a
// reactive query. Ephemeral UI state: counts only, never PII.
export const importProgress = defineTable({
  orgId: v.string(),
  // Identifies the import run this row belongs to, so the importing screen
  // never shows a stale row from an earlier (e.g. abandoned) run.
  importId: v.string(),
  // Data rows processed so far (including skipped rows).
  processed: v.number(),
  // Total data rows in the file.
  total: v.number(),
}).index("by_org", ["orgId"])
