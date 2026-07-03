import { isValidLevelForTrack } from "@workspace/constants"
import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
import { AUDIT_EVENTS, buildChanges } from "../lib/audit"
import { appError, ERROR_CODES } from "../lib/errors"
import { orgMutation, orgQuery } from "../lib/functions"
import { requireOwnRole } from "../assessment/roles"

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

// The assignment fields included in the audit changes diff.
const ASSIGNMENT_AUDIT_FIELDS = ["roleId", "level", "levelSource"] as const

// Wire shape returned by getCurrentAssignment and listAssignmentsForPerson.
const assignmentShape = v.object({
  assignmentId: v.id("personAssignments"),
  personId: v.id("people"),
  roleId: v.id("roles"),
  level: v.string(),
  levelSource: v.union(v.literal("suggested"), v.literal("confirmed")),
  effectiveAt: v.number(),
  endedAt: v.union(v.number(), v.null()),
})

function toAssignmentShape(doc: Doc<"personAssignments">) {
  return {
    assignmentId: doc._id,
    personId: doc.personId,
    roleId: doc.roleId,
    level: doc.level,
    levelSource: doc.levelSource,
    effectiveAt: doc.effectiveAt,
    endedAt: doc.endedAt ?? null,
  }
}

// Collect all assignments for a (orgId, personId) pair via the by_person index,
// then find the open one (endedAt === undefined) in JS. A person's assignment
// count is small (O(career length)), so the collect is bounded.
async function loadPersonAssignments(
  ctx: QueryCtx,
  orgId: string,
  personId: Id<"people">
): Promise<Doc<"personAssignments">[]> {
  return await ctx.db
    .query("personAssignments")
    .withIndex("by_person", (q) =>
      q.eq("orgId", orgId).eq("personId", personId)
    )
    .collect()
}

// Assign a person to a role at a given seniority level.
// If the person has an open assignment (no endedAt), it is closed first by
// setting its endedAt = effectiveAt. The new assignment becomes the active one.
// Audit: assignment.set (changes diff: roleId, level, levelSource).
export const assignPersonToRole = orgMutation({
  args: {
    personId: v.id("people"),
    roleId: v.id("roles"),
    level: v.string(),
    levelSource: v.union(v.literal("suggested"), v.literal("confirmed")),
    effectiveAt: v.optional(v.number()),
  },
  returns: v.id("personAssignments"),
  handler: async (ctx, args) => {
    // Assert both entities belong to the caller's org.
    await requireOwnPerson(ctx, args.personId)
    const role = await requireOwnRole(ctx, args.roleId)

    // Validate level against the role's track.
    if (!isValidLevelForTrack(role.trackKey, args.level)) {
      throw appError(ERROR_CODES.invalidLevel)
    }

    const effectiveAt = args.effectiveAt ?? Date.now()

    // Find and close the current open assignment, if any.
    // A person's assignment count is small so a collect + find is safe.
    const all = await loadPersonAssignments(ctx, ctx.orgId, args.personId)
    const openAssignment = all.find((a) => a.endedAt === undefined) ?? null

    // Guard: assignments must be strictly chronological. If the new effectiveAt
    // is <= the current open assignment's effectiveAt, closing the open row
    // would set its endedAt <= its own effectiveAt, producing a broken interval
    // (zero-length or inverted). Proper out-of-order timeline insertion
    // (inserting a past assignment into the middle of the history) is deferred
    // to V2-core; V1 assumes each new assignment is always the latest.
    if (openAssignment !== null && effectiveAt <= openAssignment.effectiveAt) {
      throw appError(ERROR_CODES.invalidEffectiveDate)
    }

    const prevSnapshot: Record<string, unknown> = {
      roleId: null,
      level: null,
      levelSource: null,
    }

    if (openAssignment !== null) {
      await ctx.db.patch(openAssignment._id, { endedAt: effectiveAt })
      prevSnapshot.roleId = openAssignment.roleId
      prevSnapshot.level = openAssignment.level
      prevSnapshot.levelSource = openAssignment.levelSource
    }

    const nextSnapshot: Record<string, unknown> = {
      roleId: args.roleId,
      level: args.level,
      levelSource: args.levelSource,
    }

    const assignmentId = await ctx.db.insert("personAssignments", {
      orgId: ctx.orgId,
      personId: args.personId,
      roleId: args.roleId,
      level: args.level,
      levelSource: args.levelSource,
      effectiveAt,
    })

    await ctx.audit.log({
      type: AUDIT_EVENTS.assignmentSet,
      payload: {
        personId: args.personId,
        roleId: args.roleId,
        changes: buildChanges(
          prevSnapshot,
          nextSnapshot,
          ASSIGNMENT_AUDIT_FIELDS
        ),
      },
    })

    return assignmentId
  },
})

// Returns the person's currently active assignment (no endedAt), or null.
// Returns null (not an error) when the person is not in this org, so the
// caller can distinguish "no assignment" from "not found" via null/throw.
export const getCurrentAssignment = orgQuery({
  args: { personId: v.id("people") },
  returns: v.union(assignmentShape, v.null()),
  handler: async (ctx, { personId }) => {
    const person = await ctx.db.get(personId)
    if (person === null || person.orgId !== ctx.orgId) return null

    const all = await loadPersonAssignments(ctx, ctx.orgId, personId)
    const open = all.find((a) => a.endedAt === undefined) ?? null
    return open !== null ? toAssignmentShape(open) : null
  },
})

// Returns all assignments for a person (current + historical), ordered by
// effectiveAt descending (most recent first). Returns an empty array when
// the person does not belong to this org.
export const listAssignmentsForPerson = orgQuery({
  args: { personId: v.id("people") },
  returns: v.array(assignmentShape),
  handler: async (ctx, { personId }) => {
    const person = await ctx.db.get(personId)
    if (person === null || person.orgId !== ctx.orgId) return []

    const all = await loadPersonAssignments(ctx, ctx.orgId, personId)
    // Sort most recent first.
    all.sort((a, b) => b.effectiveAt - a.effectiveAt)
    return all.map(toAssignmentShape)
  },
})
