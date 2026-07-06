import { isValidLevelForTrack } from "@workspace/constants"
import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { AUDIT_EVENTS, buildChanges, logAudit } from "../lib/audit"
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

// The assignment that was active at a point in time: effectiveAt <= at, and
// still open or ended after `at`. Pure interval lookup over a person's
// assignment timeline, exported so the pay history can join each salary
// record to the role + level it was earned under (derived, never stored:
// a later or corrected classification re-joins history automatically).
export function assignmentActiveAt(
  assignments: readonly Doc<"personAssignments">[],
  at: number
): Doc<"personAssignments"> | null {
  return (
    assignments.find(
      (a) => a.effectiveAt <= at && (a.endedAt === undefined || at < a.endedAt)
    ) ?? null
  )
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

// Shared assignment write. Validates the level against the role's track,
// enforces the strictly-chronological guard against the current open
// assignment, closes that open assignment, inserts the new row, and writes the
// assignment.set audit row. Callers MUST have already asserted that personId
// and roleId belong to orgId (requireOwnPerson / requireOwnRole). Both the
// public assignPersonToRole mutation and runClassificationSuggestions
// (people/classification.ts) write through this one code path (DRY).
export async function writeAssignment(
  ctx: MutationCtx,
  args: {
    orgId: string
    actorId: string
    personId: Id<"people">
    roleId: Id<"roles">
    level: string
    levelSource: "suggested" | "confirmed"
    effectiveAt: number
  }
): Promise<Id<"personAssignments">> {
  const role = await ctx.db.get(args.roleId)
  // Caller asserted ownership; this is a defensive re-read for the trackKey.
  if (role === null || role.orgId !== args.orgId) {
    throw appError(ERROR_CODES.notFound)
  }

  // Validate level against the role's track.
  if (!isValidLevelForTrack(role.trackKey, args.level)) {
    throw appError(ERROR_CODES.invalidLevel)
  }

  // Find and close the current open assignment, if any.
  // A person's assignment count is small so a collect + find is safe.
  const all = await loadPersonAssignments(ctx, args.orgId, args.personId)
  const openAssignment = all.find((a) => a.endedAt === undefined) ?? null

  // Guard: assignments must be strictly chronological. If the new effectiveAt
  // is <= the current open assignment's effectiveAt, closing the open row
  // would set its endedAt <= its own effectiveAt, producing a broken interval
  // (zero-length or inverted). Proper out-of-order timeline insertion is
  // deferred to V2-core; V1 assumes each new assignment is always the latest.
  if (
    openAssignment !== null &&
    args.effectiveAt <= openAssignment.effectiveAt
  ) {
    throw appError(ERROR_CODES.invalidEffectiveDate)
  }

  const prevSnapshot: Record<string, unknown> = {
    roleId: null,
    level: null,
    levelSource: null,
  }

  if (openAssignment !== null) {
    await ctx.db.patch(openAssignment._id, { endedAt: args.effectiveAt })
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
    orgId: args.orgId,
    personId: args.personId,
    roleId: args.roleId,
    level: args.level,
    levelSource: args.levelSource,
    effectiveAt: args.effectiveAt,
  })

  await logAudit(ctx, {
    orgId: args.orgId,
    actorId: args.actorId,
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
    await requireOwnRole(ctx, args.roleId)

    return await writeAssignment(ctx, {
      orgId: ctx.orgId,
      actorId: ctx.authUserId,
      personId: args.personId,
      roleId: args.roleId,
      level: args.level,
      levelSource: args.levelSource,
      effectiveAt: args.effectiveAt ?? Date.now(),
    })
  },
})

// Assign many people in ONE transaction (the classify surface's confirm and
// bulk-confirm actions). A single mutation means the reactive queries update
// once for the whole batch instead of ticking per person, and the batch is
// all-or-nothing. Each assignment still writes its own assignment.set audit
// row through writeAssignment.
export const assignPeopleToRole = orgMutation({
  args: {
    assignments: v.array(
      v.object({
        personId: v.id("people"),
        roleId: v.id("roles"),
        level: v.string(),
      })
    ),
    levelSource: v.union(v.literal("suggested"), v.literal("confirmed")),
    effectiveAt: v.optional(v.number()),
  },
  returns: v.array(v.id("personAssignments")),
  handler: async (ctx, args) => {
    const effectiveAt = args.effectiveAt ?? Date.now()
    const ids: Id<"personAssignments">[] = []
    for (const a of args.assignments) {
      // Assert both entities belong to the caller's org.
      await requireOwnPerson(ctx, a.personId)
      await requireOwnRole(ctx, a.roleId)
      ids.push(
        await writeAssignment(ctx, {
          orgId: ctx.orgId,
          actorId: ctx.authUserId,
          personId: a.personId,
          roleId: a.roleId,
          level: a.level,
          levelSource: args.levelSource,
          effectiveAt,
        })
      )
    }
    return ids
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
