import { suggestLevelForPerson } from "@workspace/core"
import { v } from "convex/values"
import { AUDIT_EVENTS } from "../lib/audit"
import { orgMutation } from "../lib/functions"
import { writeAssignment } from "./assignments"
import { buildTitleGroups } from "./classificationShared"

// Computes and persists levelSource: "suggested" assignments for people whose
// imported title matched a role (Plan 1 engines, via the shared buildTitleGroups
// helper). No AI (ADR-0003): the engines are deterministic and HR confirms the
// result. Idempotent: re-running does not duplicate a matching suggestion and
// never overwrites a confirmed assignment. People with no title, or whose title
// matches no role, get no assignment.
export const runClassificationSuggestions = orgMutation({
  args: {},
  returns: v.object({
    suggested: v.number(),
    skipped: v.number(),
    unmatchedTitles: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now()

    // Load active people and their titles. Role != Person: we read no salary.
    const people = (
      await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
        .collect()
    ).filter((p) => p.archivedAt === undefined)

    // Load active roles (title + trackKey are all the title matcher needs).
    const roles = (
      await ctx.db
        .query("roles")
        .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
        .collect()
    ).filter((r) => r.archivedAt === undefined)

    // The single source of truth for grouping + engine output (shared with
    // listPeopleByTitle). The null-title group is emitted last.
    const groups = buildTitleGroups(people, roles, now)
    const roleById = new Map(roles.map((r) => [r._id as string, r]))

    let suggested = 0
    let skipped = 0
    let unmatchedTitles = 0

    for (const group of groups) {
      // The no-title group is not matchable: everyone in it is skipped.
      if (group.title === null) {
        skipped += group.people.length
        continue
      }
      const role =
        group.suggestedRoleId !== null
          ? roleById.get(group.suggestedRoleId)
          : undefined
      if (role === undefined) {
        // Unmatched title: nobody in the group gets an assignment.
        unmatchedTitles += 1
        skipped += group.people.length
        continue
      }

      for (const person of group.people) {
        // Read the person's current open assignment inline via by_person.
        const open =
          (
            await ctx.db
              .query("personAssignments")
              .withIndex("by_person", (q) =>
                q.eq("orgId", ctx.orgId).eq("personId", person._id)
              )
              .collect()
          ).find((a) => a.endedAt === undefined) ?? null

        // The shared helper already computed the per-person level for a matched
        // group; it is always a string here (role !== undefined). Fall back to
        // the engine's low level defensively so `level` is never null.
        const level =
          group.suggestedLevelByPerson.get(person._id as string) ??
          suggestLevelForPerson({ trackKey: role.trackKey, today: now })
            .suggestedLevel

        // Skip a person already confirmed (HR reviewed them). Skip a person
        // whose open suggestion already points at the same role AND level
        // (re-run idempotency: a no-op write is not performed).
        if (
          open !== null &&
          (open.levelSource === "confirmed" ||
            (open.roleId === role._id && open.level === level))
        ) {
          skipped += 1
          continue
        }

        await writeAssignment(ctx, {
          orgId: ctx.orgId,
          actorId: ctx.authUserId,
          personId: person._id,
          roleId: role._id,
          level,
          levelSource: "suggested",
          // Strictly after any existing open assignment's effectiveAt: an open
          // suggestion at `now` cannot exist yet (this run defines it), and a
          // prior suggestion from an earlier run was created at an earlier now.
          effectiveAt:
            open !== null && now <= open.effectiveAt
              ? open.effectiveAt + 1
              : now,
        })
        suggested += 1
      }
    }

    await ctx.audit.log({
      type: AUDIT_EVENTS.classificationSuggested,
      payload: { suggested, skipped, unmatchedTitles },
    })

    return { suggested, skipped, unmatchedTitles }
  },
})
