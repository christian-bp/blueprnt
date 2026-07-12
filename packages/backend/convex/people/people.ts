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
import { uniquePersonPublicId } from "../lib/slug"
import { personImportPatch } from "./importDiff"

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
  // Anställningsform. Canonical values mirror @workspace/constants EMPLOYMENT_TYPES.
  employmentType: v.optional(
    v.union(
      v.literal("permanent"),
      v.literal("fixedTerm"),
      v.literal("substitute"),
      v.literal("hourly")
    )
  ),
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
// Excludes externalRef (the employee number, a person identifier) along with
// the other PII, so audit diffs and their searchText carry no identifier.
function nonPiiFields(person: Partial<Doc<"people">>): Record<string, unknown> {
  return {
    employmentStartDate: person.employmentStartDate ?? null,
    ftePercent: person.ftePercent ?? null,
    country: person.country ?? null,
    isManager: person.isManager ?? null,
    statisticalCode: person.statisticalCode ?? null,
    department: person.department ?? null,
    employmentType: person.employmentType ?? null,
    archivedAt: person.archivedAt ?? null,
  }
}

export const createPerson = orgMutation({
  args: {
    displayName: v.string(),
    gender: v.union(v.literal("Man"), v.literal("Kvinna")),
    ...optionalPersonArgs,
  },
  // Returns the internal id (for follow-up writes) and the publicId (the
  // route handle), so a caller can navigate to the new person without a
  // second read (same contract as createRole's { roleId, slug }).
  returns: v.object({ personId: v.id("people"), publicId: v.string() }),
  handler: async (ctx, args) => {
    const displayName = args.displayName.trim()
    if (displayName.length === 0) throw appError(ERROR_CODES.invalidInput)

    // The employee number is the import upsert key: a duplicate would make
    // future payroll imports update one row while the other silently drifts,
    // so a taken ref is rejected here (empty/whitespace means "no ref").
    const externalRef =
      args.externalRef !== undefined && args.externalRef.trim() !== ""
        ? args.externalRef.trim()
        : undefined
    if (externalRef !== undefined) {
      const taken = await ctx.db
        .query("people")
        .withIndex("by_org_externalRef", (q) =>
          q.eq("orgId", ctx.orgId).eq("externalRef", externalRef)
        )
        .first()
      if (taken !== null) throw appError(ERROR_CODES.personRefExists)
    }

    const publicId = await uniquePersonPublicId(ctx, ctx.orgId)
    const personId = await ctx.db.insert("people", {
      orgId: ctx.orgId,
      publicId,
      displayName,
      gender: args.gender,
      ...(externalRef !== undefined ? { externalRef } : {}),
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
      ...(args.employmentType !== undefined
        ? { employmentType: args.employmentType }
        : {}),
    })

    // Build the non-PII snapshot for the audit row. We pass the args directly
    // rather than re-reading the inserted doc to avoid an extra read.
    const snapshot: Record<string, unknown> = {
      externalRef: externalRef ?? null,
      employmentStartDate: args.employmentStartDate ?? null,
      ftePercent: args.ftePercent ?? null,
      country: args.country ?? null,
      isManager: args.isManager ?? null,
      statisticalCode: args.statisticalCode ?? null,
      department: args.department ?? null,
      employmentType: args.employmentType ?? null,
      archivedAt: null,
    }

    await ctx.audit.log({
      type: AUDIT_EVENTS.personCreated,
      payload: {
        personId,
        changes: buildCreateChanges(snapshot, PERSON_AUDIT_FIELDS),
      },
    })

    return { personId, publicId }
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
    employmentType: v.optional(
      v.union(
        v.literal("permanent"),
        v.literal("fixedTerm"),
        v.literal("substitute"),
        v.literal("hourly")
      )
    ),
  },
  // The outcome tells the import what actually happened, so it can report
  // new vs updated vs already-up-to-date people separately: "created" for
  // the insert path, "updated" when an existing person's fields changed,
  // "unchanged" when the incoming data matched what is already stored
  // (no write, no audit row).
  returns: v.object({
    personId: v.id("people"),
    outcome: v.union(
      v.literal("created"),
      v.literal("updated"),
      v.literal("unchanged")
    ),
  }),
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
        publicId: await uniquePersonPublicId(ctx, args.orgId),
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
        ...(args.employmentType !== undefined
          ? { employmentType: args.employmentType }
          : {}),
      })

      const snapshot: Record<string, unknown> = {
        externalRef: args.externalRef,
        employmentStartDate: args.employmentStartDate ?? null,
        ftePercent: args.ftePercent ?? null,
        country: args.country ?? null,
        isManager: args.isManager ?? null,
        statisticalCode: args.statisticalCode ?? null,
        department: args.department ?? null,
        employmentType: args.employmentType ?? null,
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

      return { personId, outcome: "created" as const }
    }

    // Update path: compute the patch via the shared import-diff rule (also
    // used by previewImport, so the review preview cannot disagree with the
    // import). A field ABSENT from the file is left untouched, never cleared.
    // Non-PII fields only reach the audit diff; PII fields like displayName
    // and gender are patched but never diffed in the audit row.
    const patch: Record<string, unknown> = personImportPatch(existing, {
      displayName: args.displayName,
      gender: args.gender,
      birthDate: args.birthDate,
      employmentStartDate: args.employmentStartDate,
      ftePercent: args.ftePercent,
      country: args.country,
      isManager: args.isManager,
      statisticalCode: args.statisticalCode,
      department: args.department,
      title: args.title,
      employmentType: args.employmentType,
    })

    // No changes: no write, no audit row.
    if (Object.keys(patch).length === 0) {
      return { personId: existing._id, outcome: "unchanged" as const }
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

    return { personId: existing._id, outcome: "updated" as const }
  },
})

// Person shape returned by getPersonByPublicId; listPeople extends it below.
const personFields = {
  personId: v.id("people"),
  publicId: v.string(),
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
}
const personShape = v.object(personFields)

// listPeople additionally joins each person's active role assignment so the
// register can filter by role and flag still-suggested (unconfirmed)
// assignments. Both are null when the person has no active assignment.
const listPersonShape = v.object({
  ...personFields,
  roleId: v.union(v.id("roles"), v.null()),
  levelSource: v.union(
    v.literal("suggested"),
    v.literal("confirmed"),
    v.null()
  ),
})

function toPersonShape(person: Doc<"people">) {
  return {
    personId: person._id,
    publicId: person.publicId,
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
  returns: v.array(listPersonShape),
  handler: async (ctx, { includeArchived }) => {
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const filtered =
      includeArchived === true
        ? people
        : people.filter((p) => p.archivedAt === undefined)

    // Map each person to their single active assignment (invariant: at most one
    // active per person), so the register can filter by role and flag suggested
    // assignments without a per-row query.
    const assignments = await ctx.db
      .query("personAssignments")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const activeByPerson = new Map<
      string,
      { roleId: Id<"roles">; levelSource: "suggested" | "confirmed" }
    >()
    for (const assignment of assignments) {
      if (assignment.endedAt === undefined) {
        activeByPerson.set(assignment.personId, {
          roleId: assignment.roleId,
          levelSource: assignment.levelSource,
        })
      }
    }

    return filtered.map((person) => {
      const active = activeByPerson.get(person._id)
      return {
        ...toPersonShape(person),
        roleId: active?.roleId ?? null,
        levelSource: active?.levelSource ?? null,
      }
    })
  },
})

// Route resolution for the person detail page: people are route-exposed by
// their short random publicId (never the internal _id, never a name slug;
// see lib/slug.ts). Resolves within the caller's org via by_org_publicId,
// so a cross-org publicId simply misses.
export const getPersonByPublicId = orgQuery({
  args: { publicId: v.string() },
  returns: v.union(personShape, v.null()),
  handler: async (ctx, { publicId }) => {
    const person = await ctx.db
      .query("people")
      .withIndex("by_org_publicId", (q) =>
        q.eq("orgId", ctx.orgId).eq("publicId", publicId)
      )
      .first()
    return person !== null ? toPersonShape(person) : null
  },
})

// Manual full-field edit from the person page. Every field is optional in
// the args (undefined = leave unchanged); for the optional person fields an
// empty string (or null for ftePercent) CLEARS the stored value, which the
// import path never does (a field absent from a file is left untouched, but
// a manual edit clearing a field is an explicit decision). Patches only what
// actually changed: an effective no-op writes nothing and no audit row.
export const updatePerson = orgMutation({
  args: {
    personId: v.id("people"),
    displayName: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("Man"), v.literal("Kvinna"))),
    externalRef: v.optional(v.string()),
    department: v.optional(v.string()),
    employmentStartDate: v.optional(v.string()),
    ftePercent: v.optional(v.union(v.number(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const person = await requireOwnPerson(ctx, args.personId)

    const patch: Record<string, unknown> = {}
    if (args.displayName !== undefined) {
      const displayName = args.displayName.trim()
      if (displayName.length === 0) throw appError(ERROR_CODES.invalidInput)
      if (displayName !== person.displayName) patch.displayName = displayName
    }
    if (args.gender !== undefined && args.gender !== person.gender) {
      patch.gender = args.gender
    }
    if (args.externalRef !== undefined) {
      // Empty clears; a non-empty ref must stay unique within the org (it is
      // the import upsert key), excluding this person's own current value.
      const externalRef =
        args.externalRef.trim() === "" ? undefined : args.externalRef.trim()
      if (externalRef !== undefined && externalRef !== person.externalRef) {
        const taken = await ctx.db
          .query("people")
          .withIndex("by_org_externalRef", (q) =>
            q.eq("orgId", ctx.orgId).eq("externalRef", externalRef)
          )
          .first()
        if (taken !== null) throw appError(ERROR_CODES.personRefExists)
      }
      if (externalRef !== person.externalRef) patch.externalRef = externalRef
    }
    if (args.department !== undefined) {
      const department =
        args.department.trim() === "" ? undefined : args.department.trim()
      if (department !== person.department) patch.department = department
    }
    if (args.employmentStartDate !== undefined) {
      const employmentStartDate =
        args.employmentStartDate === "" ? undefined : args.employmentStartDate
      if (employmentStartDate !== person.employmentStartDate) {
        patch.employmentStartDate = employmentStartDate
      }
    }
    if (args.ftePercent !== undefined) {
      const ftePercent = args.ftePercent === null ? undefined : args.ftePercent
      if (ftePercent !== person.ftePercent) patch.ftePercent = ftePercent
    }

    // Nothing actually changed: no write, no audit row.
    if (Object.keys(patch).length === 0) return null

    await ctx.db.patch(args.personId, patch)

    // Diff only the non-PII fields for the audit row; a PII-only change
    // (displayName/gender) still writes the row to record that something
    // changed, just without the values (the upsert path's rule). The after
    // side goes through nonPiiFields too, so a cleared field diffs to null
    // (an undefined would be stripped from the stored payload).
    await ctx.audit.log({
      type: AUDIT_EVENTS.personUpdated,
      payload: {
        personId: args.personId,
        changes: buildChanges(
          nonPiiFields(person),
          nonPiiFields({ ...person, ...patch } as Partial<Doc<"people">>),
          [...PERSON_AUDIT_FIELDS]
        ),
      },
    })

    return null
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
