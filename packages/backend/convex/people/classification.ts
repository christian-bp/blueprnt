import { v } from "convex/values"
import type { MutationCtx } from "../_generated/server"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"
import { orgMutation } from "../lib/functions"
import { writeAssignment } from "./assignments"
import { buildTitleGroups } from "./classificationShared"

// Shared classification routine. Computes and persists levelSource:"suggested"
// assignments for people whose title matched a role (Plan 1 engines, via the
// shared buildTitleGroups helper, no AI). Idempotent; never overwrites
// confirmed. Writes a PII-free audit summary. Callers: the public
// runClassificationSuggestions orgMutation and the import action's internal
// wrapper (classificationInternal.ts). `now` is passed so the caller controls
// the clock (the import action already has one).
export async function classifyOrg(
  ctx: MutationCtx,
  orgId: string,
  actorId: string,
  now: number
): Promise<{ suggested: number; skipped: number; unmatchedTitles: number }> {
  const people = (
    await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect()
  ).filter((p) => p.archivedAt === undefined)

  const roles = (
    await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect()
  ).filter((r) => r.archivedAt === undefined)

  // Single source of truth for grouping + engine output (shared with
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
      unmatchedTitles += 1
      skipped += group.people.length
      continue
    }

    for (const person of group.people) {
      const open =
        (
          await ctx.db
            .query("personAssignments")
            .withIndex("by_person", (q) =>
              q.eq("orgId", orgId).eq("personId", person._id)
            )
            .collect()
        ).find((a) => a.endedAt === undefined) ?? null

      // buildTitleGroups always populates suggestedLevelByPerson for every
      // person in a matched group (role is defined here). A miss means the
      // shared helper and this write path have diverged; fail loud rather than
      // silently recompute with different engine inputs (which would disagree
      // with listPeopleByTitle).
      const level = group.suggestedLevelByPerson.get(person._id as string)
      if (level === null || level === undefined) {
        throw new Error(
          `classifyOrg invariant: no suggested level for person ${person._id}`
        )
      }

      if (
        open !== null &&
        (open.levelSource === "confirmed" ||
          (open.roleId === role._id && open.level === level))
      ) {
        skipped += 1
        continue
      }

      await writeAssignment(ctx, {
        orgId,
        actorId,
        personId: person._id,
        roleId: role._id,
        level,
        levelSource: "suggested",
        effectiveAt:
          open !== null && now <= open.effectiveAt ? open.effectiveAt + 1 : now,
      })
      suggested += 1
    }
  }

  await logAudit(ctx, {
    orgId,
    actorId,
    type: AUDIT_EVENTS.classificationSuggested,
    payload: { suggested, skipped, unmatchedTitles },
  })

  return { suggested, skipped, unmatchedTitles }
}

// Computes and persists classification suggestions for the caller's org.
// Triggered on opening the Classify surface (spec §5). No AI (ADR-0003).
export const runClassificationSuggestions = orgMutation({
  args: {},
  returns: v.object({
    suggested: v.number(),
    skipped: v.number(),
    unmatchedTitles: v.number(),
  }),
  handler: async (ctx) =>
    classifyOrg(ctx, ctx.orgId, ctx.authUserId, Date.now()),
})
