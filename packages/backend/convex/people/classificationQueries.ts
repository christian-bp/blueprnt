import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import { orgQuery } from "../lib/functions"
import { buildTitleGroups } from "./classificationShared"

// One person's row within a title group. Tenure signals (employmentStartDate,
// isManager) let the Classify surface show why a level was suggested;
// suggestedLevel is the engine's per-person level (null when the group matched
// no role); currentAssignment carries the persisted suggestion/confirmation
// state.
const personRowShape = v.object({
  personId: v.id("people"),
  displayName: v.string(),
  externalRef: v.union(v.string(), v.null()),
  employmentStartDate: v.union(v.string(), v.null()),
  isManager: v.union(v.boolean(), v.null()),
  suggestedLevel: v.union(v.string(), v.null()),
  currentAssignment: v.union(
    v.object({
      roleId: v.id("roles"),
      level: v.string(),
      levelSource: v.union(v.literal("suggested"), v.literal("confirmed")),
    }),
    v.null()
  ),
})

// Distinct titles across an org's active people, each with the people sharing
// it, their current open assignment, and the deterministic engine suggestion
// (matched role + confidence + per-person level) computed via the shared
// buildTitleGroups helper (the SAME grouping/engine path classifyOrg persists
// from, so what HR sees equals what gets written). Groups over a by_org collect
// (distinct titles are bounded by headcount, so the collect is safe; spec 5).
// The "no title" group is emitted with title: null and sorted last. Read-only:
// deriving the suggestion on read is allowed (ADR-0002); nothing is written.
export const listPeopleByTitle = orgQuery({
  args: {},
  returns: v.array(
    v.object({
      title: v.union(v.string(), v.null()),
      personCount: v.number(),
      suggestedRoleId: v.union(v.id("roles"), v.null()),
      confidence: v.union(
        v.literal("high"),
        v.literal("medium"),
        v.literal("unmatched")
      ),
      people: v.array(personRowShape),
    })
  ),
  handler: async (ctx) => {
    const people = (
      await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
        .collect()
    ).filter((p) => p.archivedAt === undefined)

    const roles = (
      await ctx.db
        .query("roles")
        .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
        .collect()
    ).filter((r) => r.archivedAt === undefined)

    // Build each person's current-open-assignment lookup up front.
    const openByPerson = new Map<string, Doc<"personAssignments">>()
    for (const person of people) {
      const open =
        (
          await ctx.db
            .query("personAssignments")
            .withIndex("by_person", (q) =>
              q.eq("orgId", ctx.orgId).eq("personId", person._id)
            )
            .collect()
        ).find((a) => a.endedAt === undefined) ?? null
      if (open !== null) openByPerson.set(person._id as string, open)
    }

    // The single source of truth for grouping + engine output (shared with
    // classifyOrg). Date.now() is fine here: an orgQuery is not in the pure
    // packages/core layer, and the tenure band only shifts on year boundaries.
    const groups = buildTitleGroups(people, roles, Date.now())

    return groups.map((group) => ({
      title: group.title,
      personCount: group.people.length,
      suggestedRoleId:
        group.suggestedRoleId !== null
          ? (group.suggestedRoleId as Id<"roles">)
          : null,
      confidence: group.confidence,
      people: group.people.map((person) => {
        const open = openByPerson.get(person._id as string) ?? null
        return {
          personId: person._id,
          displayName: person.displayName,
          externalRef: person.externalRef ?? null,
          employmentStartDate: person.employmentStartDate ?? null,
          isManager: person.isManager ?? null,
          suggestedLevel:
            group.suggestedLevelByPerson.get(person._id as string) ?? null,
          currentAssignment:
            open !== null
              ? {
                  roleId: open.roleId as Id<"roles">,
                  level: open.level,
                  levelSource: open.levelSource,
                }
              : null,
        }
      }),
    }))
  },
})
