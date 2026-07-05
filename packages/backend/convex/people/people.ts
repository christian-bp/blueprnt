import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
import { internalMutation } from "../_generated/server"
import {
  AUDIT_EVENTS,
  buildChanges,
  buildCreateChanges,
  logAudit,
  PERSON_AUDIT_FIELDS,
} from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation, orgMutation, orgQuery } from "../lib/functions"

// The optional person fields shared by createPerson and upsertPersonByExternalRef.
const optionalPersonArgs = {
  externalRef: v.optional(v.string()),
  birthDate: v.optional(v.string()),
  employmentStartDate: v.optional(v.string()),
  ftePercent: v.optional(v.number()),
  country: v.optional(v.string()),
  isManager: v.optional(v.boolean()),
  statisticalCode: v.optional(v.string()),
  department: v.optional(v.string()),
  title: v.optional(v.string()),
}

// Tenant-isolation assert for a point-read: throws notFound when the person
// does not exist or belongs to a different org.
async function requireOwnPerson(
  ctx: QueryCtx & { orgId: string },
  personId: Id<"people">
): Promise<Doc<"people">> {
  const person = await ctx.db.get(personId)
  if (person === null || person.orgId !== ctx.orgId) {
    throw appError(ERROR_CODES.notFound)
  }
  return person
}

// Builds the non-PII subset of a person doc suitable for audit diffs.
// Maps the person doc to a plain Record so buildChanges/buildCreateChanges
// can walk PERSON_AUDIT_FIELDS without hitting Convex document internals.
function nonPiiFields(person: Partial<Doc<"people">>): Record<string, unknown> {
  return {
    externalRef: person.externalRef ?? null,
    employmentStartDate: person.employmentStartDate ?? null,
    ftePercent: person.ftePercent ?? null,
    country: person.country ?? null,
    isManager: person.isManager ?? null,
    statisticalCode: person.statisticalCode ?? null,
    department: person.department ?? null,
    archivedAt: person.archivedAt ?? null,
  }
}

export const createPerson = orgMutation({
  args: {
    displayName: v.string(),
    gender: v.union(v.literal("Man"), v.literal("Kvinna")),
    ...optionalPersonArgs,
  },
  returns: v.id("people"),
  handler: async (ctx, args) => {
    const displayName = args.displayName.trim()
    if (displayName.length === 0) throw appError(ERROR_CODES.invalidInput)

    const personId = await ctx.db.insert("people", {
      orgId: ctx.orgId,
      displayName,
      gender: args.gender,
      ...(args.externalRef !== undefined
        ? { externalRef: args.externalRef }
        : {}),
      ...(args.birthDate !== undefined ? { birthDate: args.birthDate } : {}),
      ...(args.employmentStartDate !== undefined
        ? { employmentStartDate: args.employmentStartDate }
        : {}),
      ...(args.ftePercent !== undefined ? { ftePercent: args.ftePercent } : {}),
      ...(args.country !== undefined ? { country: args.country } : {}),
      ...(args.isManager !== undefined ? { isManager: args.isManager } : {}),
      ...(args.statisticalCode !== undefined
        ? { statisticalCode: args.statisticalCode }
        : {}),
      ...(args.department !== undefined ? { department: args.department } : {}),
      ...(args.title !== undefined ? { title: args.title } : {}),
    })

    // Build the non-PII snapshot for the audit row. We pass the args directly
    // rather than re-reading the inserted doc to avoid an extra read.
    const snapshot: Record<string, unknown> = {
      externalRef: args.externalRef ?? null,
      employmentStartDate: args.employmentStartDate ?? null,
      ftePercent: args.ftePercent ?? null,
      country: args.country ?? null,
      isManager: args.isManager ?? null,
      statisticalCode: args.statisticalCode ?? null,
      department: args.department ?? null,
      archivedAt: null,
    }

    await ctx.audit.log({
      type: AUDIT_EVENTS.personCreated,
      payload: {
        personId,
        changes: buildCreateChanges(snapshot, PERSON_AUDIT_FIELDS),
      },
    })

    return personId
  },
})

// Internal upsert used by the payroll-import path. Looks up by the compound
// (orgId, externalRef) index; inserts on miss, patches changed fields on hit.
// No-op when nothing changed: no write, no audit row. Uses the free-function
// logAudit (internal mutations have no ctx.audit).
export const upsertPersonByExternalRef = internalMutation({
  args: {
    orgId: v.string(),
    actorId: v.string(),
    externalRef: v.string(),
    displayName: v.string(),
    gender: v.union(v.literal("Man"), v.literal("Kvinna")),
    birthDate: v.optional(v.string()),
    employmentStartDate: v.optional(v.string()),
    ftePercent: v.optional(v.number()),
    country: v.optional(v.string()),
    isManager: v.optional(v.boolean()),
    statisticalCode: v.optional(v.string()),
    department: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  // `created` distinguishes the insert path from the update path so the
  // import can report new vs updated people separately.
  returns: v.object({ personId: v.id("people"), created: v.boolean() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("people")
      .withIndex("by_org_externalRef", (q) =>
        q.eq("orgId", args.orgId).eq("externalRef", args.externalRef)
      )
      .first()

    if (existing === null) {
      // Insert path.
      const personId = await ctx.db.insert("people", {
        orgId: args.orgId,
        externalRef: args.externalRef,
        displayName: args.displayName,
        gender: args.gender,
        ...(args.birthDate !== undefined ? { birthDate: args.birthDate } : {}),
        ...(args.employmentStartDate !== undefined
          ? { employmentStartDate: args.employmentStartDate }
          : {}),
        ...(args.ftePercent !== undefined
          ? { ftePercent: args.ftePercent }
          : {}),
        ...(args.country !== undefined ? { country: args.country } : {}),
        ...(args.isManager !== undefined ? { isManager: args.isManager } : {}),
        ...(args.statisticalCode !== undefined
          ? { statisticalCode: args.statisticalCode }
          : {}),
        ...(args.department !== undefined
          ? { department: args.department }
          : {}),
        ...(args.title !== undefined ? { title: args.title } : {}),
      })

      const snapshot: Record<string, unknown> = {
        externalRef: args.externalRef,
        employmentStartDate: args.employmentStartDate ?? null,
        ftePercent: args.ftePercent ?? null,
        country: args.country ?? null,
        isManager: args.isManager ?? null,
        statisticalCode: args.statisticalCode ?? null,
        department: args.department ?? null,
        archivedAt: null,
      }

      await logAudit(ctx, {
        orgId: args.orgId,
        type: AUDIT_EVENTS.personCreated,
        actorId: args.actorId,
        payload: {
          personId,
          changes: buildCreateChanges(snapshot, PERSON_AUDIT_FIELDS),
        },
      })

      return { personId, created: true }
    }

    // Update path: compute the patch (non-PII fields only for audit; PII fields
    // like displayName and gender are patched but never diffed in the audit row).
    const patch: Record<string, unknown> = {}
    if (args.displayName !== existing.displayName)
      patch.displayName = args.displayName
    if (args.gender !== existing.gender) patch.gender = args.gender
    if (args.birthDate !== existing.birthDate) {
      patch.birthDate = args.birthDate
    }
    if (args.employmentStartDate !== existing.employmentStartDate) {
      patch.employmentStartDate = args.employmentStartDate
    }
    if (args.ftePercent !== existing.ftePercent) {
      patch.ftePercent = args.ftePercent
    }
    if (args.country !== existing.country) patch.country = args.country
    if (args.isManager !== existing.isManager) patch.isManager = args.isManager
    if (args.statisticalCode !== existing.statisticalCode) {
      patch.statisticalCode = args.statisticalCode
    }
    if (args.department !== existing.department)
      patch.department = args.department
    if (args.title !== existing.title) patch.title = args.title

    // No changes: no write, no audit row.
    if (Object.keys(patch).length === 0) {
      return { personId: existing._id, created: false }
    }

    await ctx.db.patch(existing._id, patch)

    // Diff only the non-PII fields for the audit row.
    const before = nonPiiFields(existing)
    const changes = buildChanges(before, { ...before, ...patch }, [
      ...PERSON_AUDIT_FIELDS,
    ])

    // Only write an audit row when at least one non-PII field changed.
    // (A PII-only change like displayName/gender alone would produce an empty
    // changes map, which is still a meaningful update; we write the row to
    // record that something changed, just without the PII values.)
    await logAudit(ctx, {
      orgId: args.orgId,
      type: AUDIT_EVENTS.personUpdated,
      actorId: args.actorId,
      payload: {
        personId: existing._id,
        changes,
      },
    })

    return { personId: existing._id, created: false }
  },
})

// Person shape returned by listPeople and getPerson queries.
const personShape = v.object({
  personId: v.id("people"),
  displayName: v.string(),
  gender: v.union(v.literal("Man"), v.literal("Kvinna")),
  externalRef: v.union(v.string(), v.null()),
  birthDate: v.union(v.string(), v.null()),
  employmentStartDate: v.union(v.string(), v.null()),
  ftePercent: v.union(v.number(), v.null()),
  country: v.union(v.string(), v.null()),
  isManager: v.union(v.boolean(), v.null()),
  statisticalCode: v.union(v.string(), v.null()),
  department: v.union(v.string(), v.null()),
  title: v.union(v.string(), v.null()),
  archivedAt: v.union(v.number(), v.null()),
})

function toPersonShape(person: Doc<"people">) {
  return {
    personId: person._id,
    displayName: person.displayName,
    gender: person.gender,
    externalRef: person.externalRef ?? null,
    birthDate: person.birthDate ?? null,
    employmentStartDate: person.employmentStartDate ?? null,
    ftePercent: person.ftePercent ?? null,
    country: person.country ?? null,
    isManager: person.isManager ?? null,
    statisticalCode: person.statisticalCode ?? null,
    department: person.department ?? null,
    title: person.title ?? null,
    archivedAt: person.archivedAt ?? null,
  }
}

export const listPeople = orgQuery({
  args: {
    includeArchived: v.optional(v.boolean()),
  },
  returns: v.array(personShape),
  handler: async (ctx, { includeArchived }) => {
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const filtered =
      includeArchived === true
        ? people
        : people.filter((p) => p.archivedAt === undefined)
    return filtered.map(toPersonShape)
  },
})

export const getPerson = orgQuery({
  args: { personId: v.id("people") },
  returns: v.union(personShape, v.null()),
  handler: async (ctx, { personId }) => {
    const person = await ctx.db.get(personId)
    if (person === null || person.orgId !== ctx.orgId) return null
    return toPersonShape(person)
  },
})

export const archivePerson = adminMutation({
  args: { personId: v.id("people") },
  returns: v.null(),
  handler: async (ctx, { personId }) => {
    const person = await requireOwnPerson(ctx, personId)
    // Already archived: no-op.
    if (person.archivedAt !== undefined) return null

    const archivedAt = Date.now()
    await ctx.db.patch(personId, { archivedAt })

    await ctx.audit.log({
      type: AUDIT_EVENTS.personArchived,
      payload: {
        personId,
        changes: { archivedAt: { from: null, to: archivedAt } },
      },
    })

    return null
  },
})
