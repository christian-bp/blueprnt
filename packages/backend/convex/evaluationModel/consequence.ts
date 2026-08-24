import {
  isWomenDominated,
  type LevelThreshold,
  type CriterionWeight,
  type RoleResult,
  type WeightPoints,
  type ZoneKey,
  type ZoneProfileRule,
  ZONE_KEYS,
  computeResults,
} from "@workspace/core"
import { v } from "convex/values"
import type { Doc } from "../_generated/dataModel"
import { readResultInputs, type ResultInputs } from "../assessment/compute"
import { orgQuery } from "../lib/functions"
import { LIBRARY_DIMENSION } from "./criteriaLibrary"
import type { ModelEvidence } from "./tables"

// The masterdokument's section 18: before a method change is approved, show
// what approving it would DO to the organization's existing placements.
//
// The whole analysis is derived, never stored (ADR-0002). It compares two runs
// of the same pure engine over the SAME locked ratings: once under the live
// model, once under the method the last approval buffered
// (`lastApprovedModel`, ADR-0023 decision 11). Nothing here re-implements
// placement; the engine is the only authority on where a role lands.

// How many movers the wire carries. The panel names them, and a list of every
// role in a large organization is not a summary of a change, it is the change
// again: past this many the surface says how many more there are. The count
// itself is always exact, because it is what the reader actually needs.
export const MAX_LISTED_MOVERS = 12

const genderDominanceValidator = v.union(
  v.literal("women"),
  v.literal("men"),
  v.literal("mixed"),
  // A role nobody is assigned to has no dominance to report. Its own bucket
  // rather than folded into "mixed", which would claim a balance that was
  // never measured.
  v.literal("unstaffed")
)
export type GenderDominance = "women" | "men" | "mixed" | "unstaffed"

const distributionValidator = v.array(
  v.object({
    zone: v.union(...ZONE_KEYS.map((zone) => v.literal(zone))),
    now: v.number(),
    approved: v.number(),
  })
)

const groupShiftValidator = v.array(
  v.object({
    key: v.string(),
    label: v.union(v.string(), v.null()),
    // How many of the group's roles move at all, and the net direction in
    // LEVELS (negative is up, since level 1 is the highest).
    moved: v.number(),
    up: v.number(),
    down: v.number(),
    total: v.number(),
  })
)

// Maps the buffer's criteria (identified by libraryKey, since ids are not part
// of the evidence) onto the live criterion ids the ratings are keyed on.
//
// Two asymmetries, both deliberate and both reported to the caller so the
// panel can say what it is comparing:
//   - a criterion ADDED since the approval has no place in the approved
//     method, so the approved run scores without it;
//   - a criterion REMOVED since the approval has no live id and therefore no
//     ratings, so it cannot contribute to either run.
// Neither is an error: the point of the analysis is precisely that the method
// changed.
function approvedCriteria(
  inputs: ResultInputs,
  buffer: ModelEvidence
): { criteria: CriterionWeight[]; added: number; removed: number } {
  const idByLibraryKey = new Map<string, string>()
  for (const [id, libraryKey] of inputs.libraryKeyById) {
    idByLibraryKey.set(libraryKey, id)
  }
  const criteria: CriterionWeight[] = []
  let removed = 0
  const matched = new Set<string>()
  for (const entry of buffer.criteria) {
    const libraryKey = entry.libraryKey
    const id =
      libraryKey === undefined ? undefined : idByLibraryKey.get(libraryKey)
    if (id === undefined || libraryKey === undefined) {
      removed += 1
      continue
    }
    matched.add(id)
    criteria.push({
      criterionId: id,
      dimensionKey: LIBRARY_DIMENSION[libraryKey as never],
      weightPoints: entry.weightPoints as WeightPoints,
    })
  }
  return {
    criteria,
    added: inputs.criteria.filter((entry) => !matched.has(entry.criterionId))
      .length,
    removed,
  }
}

// The gender make-up of a role, as the pay-mapping convention reads it: the
// 60 % threshold is the engine's own WOMEN_DOMINANCE_THRESHOLD via
// isWomenDominated, never a second literal here.
//
// COUNTS ONLY. This function receives assignment rows and returns a class per
// ROLE; no person id, no name and no per-person row leaves it, which is what
// keeps the analysis inside the Role != Person rule.
function dominanceByRole(
  assignments: readonly Doc<"personAssignments">[],
  genderByPerson: ReadonlyMap<string, string>
): Map<string, GenderDominance> {
  const counts = new Map<string, { women: number; men: number }>()
  for (const assignment of assignments) {
    if (assignment.endedAt !== undefined) continue
    const gender = genderByPerson.get(assignment.personId as string)
    if (gender === undefined) continue
    const key = assignment.roleId as string
    const entry = counts.get(key) ?? { women: 0, men: 0 }
    if (gender === "Kvinna") entry.women += 1
    else if (gender === "Man") entry.men += 1
    counts.set(key, entry)
  }
  const dominance = new Map<string, GenderDominance>()
  for (const [roleId, entry] of counts) {
    if (entry.women + entry.men === 0) continue
    dominance.set(
      roleId,
      isWomenDominated(entry.women, entry.men)
        ? "women"
        : isWomenDominated(entry.men, entry.women)
          ? "men"
          : "mixed"
    )
  }
  return dominance
}

function levelByRole(results: readonly RoleResult[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const result of results) {
    if (result.level !== null) map.set(result.roleId, result.level)
  }
  return map
}

function zoneCounts(results: readonly RoleResult[]): Record<ZoneKey, number> {
  const counts: Record<ZoneKey, number> = { A: 0, B: 0, C: 0, D: 0 }
  for (const result of results) {
    if (result.zone !== null) counts[result.zone] += 1
  }
  return counts
}

// What approving the live method would do to the placements the organization
// already has.
//
// Silent by contract: `moved` is 0 and every list is empty when there is no
// buffer or nothing shifts, and the panel renders nothing on that. The query
// still answers rather than throwing, because "nothing would change" is itself
// the answer the approver needs.
export const getConsequenceAnalysis = orgQuery({
  args: {},
  returns: v.object({
    // False when the model has never been approved: there is no earlier method
    // to compare against, so the analysis has nothing to say rather than
    // nothing to report.
    comparable: v.boolean(),
    moved: v.number(),
    // Every locked, placed role, counted once, so the panel can say "8 of 42".
    placed: v.number(),
    criteriaAdded: v.number(),
    criteriaRemoved: v.number(),
    distribution: distributionValidator,
    movers: v.array(
      v.object({
        roleId: v.id("roles"),
        title: v.string(),
        slug: v.string(),
        from: v.number(),
        to: v.number(),
      })
    ),
    families: groupShiftValidator,
    genders: groupShiftValidator,
  }),
  handler: async (ctx) => {
    const empty = {
      comparable: false,
      moved: 0,
      placed: 0,
      criteriaAdded: 0,
      criteriaRemoved: 0,
      distribution: [],
      movers: [],
      families: [],
      genders: [],
    }
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    const buffer = model?.lastApprovedModel
    if (model === null || buffer === undefined) return empty

    // ONE set of reads for BOTH runs: the ratings and the roles are the same
    // on either side of the comparison by definition, and only the method
    // differs.
    const inputs = await readResultInputs(ctx, ctx.orgId)
    if (inputs === null) return empty

    const nowResults = computeResults(inputs)
    const { criteria, added, removed } = approvedCriteria(inputs, buffer)
    const thresholds: LevelThreshold[] = (buffer.levelRules ?? []).map(
      (rule) => ({ level: rule.level, minScore: rule.minScore })
    )
    const zoneProfileRules: ZoneProfileRule[] = (
      buffer.zoneProfileRules ?? []
    ).map((rule) => ({ zone: rule.zone, minStep: rule.minStep }))
    // A buffer written before the level rules joined the evidence has no
    // thresholds to score against; there is nothing to compare rather than a
    // comparison against an empty ladder.
    if (criteria.length === 0 || thresholds.length === 0) return empty
    const approvedResults = computeResults({
      criteria,
      thresholds,
      zoneProfileRules,
      roles: inputs.roles,
    })

    // Only LOCKED roles carry a placement anyone has seen (lock-as-reveal), so
    // only they can move in the reader's terms. An unlocked role's numbers
    // exist in the engine and nowhere else.
    const roleRows = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const lockedRoles = roleRows.filter(
      (role) => role.archivedAt === undefined && role.assessment !== undefined
    )
    const nowLevel = levelByRole(nowResults)
    const approvedLevel = levelByRole(approvedResults)

    const families = await ctx.db
      .query("roleFamilies")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const familyName = new Map(
      families.map((family) => [family._id as string, family.name])
    )

    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const genderByPerson = new Map(
      people.map((person) => [person._id as string, person.gender])
    )
    const assignments = await ctx.db
      .query("personAssignments")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const dominance = dominanceByRole(assignments, genderByPerson)

    type Bucket = { moved: number; up: number; down: number; total: number }
    const familyBuckets = new Map<string, Bucket>()
    const genderBuckets = new Map<string, Bucket>()
    const bump = (
      buckets: Map<string, Bucket>,
      key: string,
      delta: number | null
    ) => {
      const bucket = buckets.get(key) ?? { moved: 0, up: 0, down: 0, total: 0 }
      bucket.total += 1
      if (delta !== null && delta !== 0) {
        bucket.moved += 1
        // Level 1 is the HIGHEST, so a smaller number is up.
        if (delta < 0) bucket.up += 1
        else bucket.down += 1
      }
      buckets.set(key, bucket)
    }

    const movers: {
      roleId: Doc<"roles">["_id"]
      title: string
      slug: string
      from: number
      to: number
    }[] = []
    let placed = 0
    for (const role of lockedRoles) {
      const id = role._id as string
      const to = nowLevel.get(id)
      const from = approvedLevel.get(id)
      if (to === undefined || from === undefined) continue
      placed += 1
      const delta = to - from
      if (delta !== 0) {
        movers.push({
          roleId: role._id,
          title: role.title,
          slug: role.slug,
          from,
          to,
        })
      }
      bump(
        familyBuckets,
        role.familyId === undefined ? "" : (role.familyId as string),
        delta
      )
      bump(genderBuckets, dominance.get(id) ?? "unstaffed", delta)
    }

    // Biggest movement first, then by title, so the capped list shows the
    // changes worth reading rather than the alphabetically luckiest.
    movers.sort(
      (a, b) =>
        Math.abs(b.to - b.from) - Math.abs(a.to - a.from) ||
        a.title.localeCompare(b.title)
    )

    const nowZones = zoneCounts(nowResults)
    const approvedZones = zoneCounts(approvedResults)

    return {
      comparable: true,
      moved: movers.length,
      placed,
      criteriaAdded: added,
      criteriaRemoved: removed,
      distribution: ZONE_KEYS.map((zone) => ({
        zone,
        now: nowZones[zone],
        approved: approvedZones[zone],
      })),
      movers: movers.slice(0, MAX_LISTED_MOVERS),
      families: [...familyBuckets.entries()].map(([key, bucket]) => ({
        key,
        label: key === "" ? null : (familyName.get(key) ?? null),
        ...bucket,
      })),
      // A fixed order, so the table does not reorder itself as counts change.
      genders: (["women", "men", "mixed", "unstaffed"] as const).flatMap(
        (key) => {
          const bucket = genderBuckets.get(key)
          return bucket === undefined ? [] : [{ key, label: null, ...bucket }]
        }
      ),
    }
  },
})

export { genderDominanceValidator }
