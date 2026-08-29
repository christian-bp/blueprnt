import {
  computeResults,
  type CriterionWeight,
  isWomenDominated,
  LEVEL_RULES,
  type LevelThreshold,
  type RoleResult,
  type WeightPoints,
  ZONE_KEYS,
  ZONE_PROFILE_RULES,
  type ZoneKey,
  type ZoneProfileRule,
} from "@workspace/core"
import { v } from "convex/values"
import type { Doc } from "../_generated/dataModel"
import { readResultInputs, type ResultInputs } from "../assessment/compute"
import { orgQuery } from "../lib/functions"
import type { ModelEvidence } from "./tables"

// The masterdokument's section 18: before a method change is approved, show
// what approving it would DO to the organization's existing placements.
//
// The whole analysis is derived, never stored (ADR-0002). It compares two runs
// of the same pure engine over the SAME completed ratings: once under the live
// model, once under the method the last approval buffered
// (`lastApprovedModel`, ADR-0023 decision 11). Nothing here re-implements
// placement; the engine is the only authority on where a role lands.

// How many movers the wire carries. The panel names them, and a list of every
// role in a large organization is not a summary of a change, it is the change
// again: past this many the surface says how many more there are. The count
// itself is always exact, because it is what the reader actually needs.
export const MAX_LISTED_MOVERS = 12

export const GENDER_DOMINANCE_KEYS = [
  "women",
  "men",
  "mixed",
  // A role nobody is assigned to has no dominance to report. Its own bucket
  // rather than folded into "mixed", which would claim a balance that was
  // never measured.
  "unstaffed",
] as const

const genderDominanceValidator = v.union(
  v.literal("women"),
  v.literal("men"),
  v.literal("mixed"),
  v.literal("unstaffed")
)
export type GenderDominance = (typeof GENDER_DOMINANCE_KEYS)[number]

const distributionValidator = v.array(
  v.object({
    zone: v.union(...ZONE_KEYS.map((zone) => v.literal(zone))),
    now: v.number(),
    approved: v.number(),
  })
)

// Declared as FIELDS rather than a finished validator so the gender table can
// type its key as the four-class union while the family table keeps a free
// string (a family id). A shared v.string() left the class untyped on the wire
// and let the panel swallow an unknown value into "unstaffed".
const groupShiftFields = {
  label: v.union(v.string(), v.null()),
  // How many of the group's roles move at all, and the net direction in
  // LEVELS (negative is up, since level 1 is the highest).
  moved: v.number(),
  up: v.number(),
  down: v.number(),
  total: v.number(),
}

const familyShiftValidator = v.array(
  v.object({ key: v.string(), ...groupShiftFields })
)

const genderShiftValidator = v.array(
  v.object({ key: genderDominanceValidator, ...groupShiftFields })
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
    const live = inputs.criteria.find((entry) => entry.criterionId === id)
    if (live === undefined) {
      // Unreachable: `id` came out of inputs.libraryKeyById, and both that map
      // and inputs.criteria are built from the same criteriaRows read. Counting
      // it as "removed" would quietly mis-report a criterion the model still
      // has, so this fails loudly instead, like startPayMappingRun's own
      // gate-divergence throw. A plain Error: it guards a programming mistake,
      // not anything a user can cause.
      throw new Error(
        `consequence analysis invariant: criterion ${id} is in libraryKeyById but not in criteria`
      )
    }
    criteria.push({
      criterionId: id,
      // From the LIVE criterion, which already carries it: the buffer's own
      // dimensionKey is an optional legacy-tolerant string, and reading it
      // through LIBRARY_DIMENSION needed a cast to silence the index type.
      dimensionKey: live.dimensionKey,
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

// ONE population for the whole panel: only COMPLETED assessments, the same set
// `placed`, `movers`, `families` and `genders` speak about. Counting every
// active role here instead put a zone table about N roles beside a summary
// about the M completed ones, with nothing saying they were different sets.
function zoneCounts(
  results: readonly RoleResult[],
  completedIds: ReadonlySet<string>
): Record<ZoneKey, number> {
  const counts: Record<ZoneKey, number> = { A: 0, B: 0, C: 0, D: 0 }
  for (const result of results) {
    if (result.zone !== null && completedIds.has(result.roleId)) {
      counts[result.zone] += 1
    }
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
    // A placement that DISAPPEARS is the largest consequence there is, and it
    // used to be the one the panel could not see. Approving a method that
    // added a criterion leaves every already-completed role unrated on it, so
    // engine returns no level and the role falls off the ladder until someone
    // rates it. Counted here as its own class rather than folded into `moved`,
    // because "moved to another level" and "has no level any more" are
    // different things to tell an approver. `gaining` is the mirror: a role
    // that could not place under the approved method and can now.
    losing: v.number(),
    gaining: v.number(),
    // Every completed, placed role, counted once, so the panel can say "8 of 42".
    placed: v.number(),
    criteriaAdded: v.number(),
    criteriaRemoved: v.number(),
    distribution: distributionValidator,
    movers: v.array(
      v.object({
        roleId: v.id("roles"),
        title: v.string(),
        slug: v.string(),
        // Null on the side where the role has no placement: `to: null` is a
        // role that loses its level, `from: null` one that gains one.
        from: v.union(v.number(), v.null()),
        to: v.union(v.number(), v.null()),
      })
    ),
    families: familyShiftValidator,
    genders: genderShiftValidator,
  }),
  handler: async (ctx) => {
    const empty = {
      comparable: false,
      moved: 0,
      losing: 0,
      gaining: 0,
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
    // Both runs place against the same ladder and the same zone gates, because
    // both are method law (ADR-0024). What the diff compares is therefore the
    // CRITERIA and the WEIGHTS, which is all approving can actually move.
    const thresholds: LevelThreshold[] = LEVEL_RULES.map((rule) => ({
      level: rule.level,
      minScore: rule.minScore,
    }))
    const zoneProfileRules: ZoneProfileRule[] = ZONE_PROFILE_RULES.map(
      (rule) => ({ zone: rule.zone, minStep: rule.minStep })
    )
    if (criteria.length === 0) return empty
    const approvedResults = computeResults({
      criteria,
      thresholds,
      zoneProfileRules,
      roles: inputs.roles,
    })

    // Only COMPLETED assessments carry a placement anyone has seen (completion
    // is the reveal), so only they can move in the reader's terms. The numbers
    // of an assessment still open exist in the engine and nowhere else.
    //
    // Read off readResultInputs rather than collected again: this query runs on
    // every render of the approval chapter, on top of two whole-org engine
    // passes and three more org-wide collects, and it was paying for the roles
    // table twice in one transaction. readResultInputs already holds the active
    // rows and used to throw them away after building its RoleRatings.
    const completedRoles = inputs.activeRoles.filter(
      (role) => role.assessment !== undefined
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
      // NaN is "moved, but in no direction": a role that gained or lost its
      // placement altogether counts as changed without claiming it went up or
      // down a ladder it was not on.
      if (Number.isNaN(delta)) {
        bucket.moved += 1
      } else if (delta !== null && delta !== 0) {
        bucket.moved += 1
        // Level 1 is the HIGHEST, so a smaller number is up.
        if (delta < 0) bucket.up += 1
        else bucket.down += 1
      }
      buckets.set(key, bucket)
    }

    // `from`/`to` are null when the role has no placement on that side. A
    // moving role has both; a role that loses its placement has a `from` and
    // no `to`, which is the case the panel used to be blind to.
    const movers: {
      roleId: Doc<"roles">["_id"]
      title: string
      slug: string
      from: number | null
      to: number | null
    }[] = []
    let placed = 0
    let losing = 0
    let gaining = 0
    for (const role of completedRoles) {
      const id = role._id as string
      const to = nowLevel.get(id) ?? null
      const from = approvedLevel.get(id) ?? null
      // Placeable on neither side: nothing to say about it either way.
      if (to === null && from === null) continue
      placed += 1
      if (from !== null && to === null) losing += 1
      if (from === null && to !== null) gaining += 1
      const changed = from !== to
      if (changed) {
        movers.push({
          roleId: role._id,
          title: role.title,
          slug: role.slug,
          from,
          to,
        })
      }
      // The group tables count a role that gains or loses its placement as
      // MOVED, without a direction: it did not go up or down the ladder, it
      // left it or joined it. `delta` stays null for those, which `bump`
      // already reads as "no direction".
      const delta = from !== null && to !== null ? to - from : null
      const bucketDelta = changed && delta === null ? Number.NaN : delta
      bump(
        familyBuckets,
        role.familyId === undefined ? "" : (role.familyId as string),
        bucketDelta
      )
      bump(genderBuckets, dominance.get(id) ?? "unstaffed", bucketDelta)
    }

    // Biggest movement first, then by title, so the capped list shows the
    // changes worth reading rather than the alphabetically luckiest.
    // Losing or gaining a placement outranks any distance moved: a role that
    // fell off the ladder is the thing an approver most needs to see, and a
    // capped list must never spend its twelve rows on level shifts while a
    // role disappears below the fold.
    const magnitude = (mover: { from: number | null; to: number | null }) =>
      mover.from === null || mover.to === null
        ? Number.POSITIVE_INFINITY
        : Math.abs(mover.to - mover.from)
    movers.sort((a, b) => {
      const left = magnitude(a)
      const right = magnitude(b)
      // Two null-sided movers are both Infinity, and Infinity - Infinity is
      // NaN. Comparing them explicitly rather than leaning on NaN being falsy:
      // that works today only by accident, and one `??`-for-`||` edit away it
      // becomes an inconsistent comparator with an unspecified sort.
      if (left !== right) return right - left
      return a.title.localeCompare(b.title)
    })

    const completedIds = new Set(
      completedRoles.map((role) => role._id as string)
    )
    const nowZones = zoneCounts(nowResults, completedIds)
    const approvedZones = zoneCounts(approvedResults, completedIds)

    return {
      comparable: true,
      moved: movers.length,
      losing,
      gaining,
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
