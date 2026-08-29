import { LEVEL_RULES } from "@workspace/core"
import { v } from "convex/values"
import type { Doc } from "../_generated/dataModel"
import {
  criteriaLibraryContent,
  LIBRARY_DIMENSION,
} from "../evaluationModel/criteriaLibrary"

import { clampLocale } from "../evaluationModel/localize"
import {
  dimensionKeyValidator,
  zoneKeyValidator,
} from "../evaluationModel/tables"
import { orgQuery } from "../lib/functions"
import { deriveResults } from "./compute"
import { familyNames, trackNames } from "./names"

// Completing is the reveal (ADR-0023, spec 2.4/6): while a role's assessment is
// a draft (roles.assessment absent), no result exists anywhere -- score,
// level, zone, and the profile outcome all read null here regardless of what
// the engine actually derived. `complete`/`ratedCount`/`totalCriteria` stay
// exposed always (completeness counters, never the outcome itself), so the
// "ready to complete" state has something to show. Method drift is derived here
// at read time and never stored, mirroring score/level/zone: it is always
// false for a role that is not completed (nothing has been revealed yet to
// drift), but a COMPLETED role whose model carries no CURRENT approval is
// itself drift, not the absence of it. A method-affecting edit reopens approval
// (reopenApprovalIfSet) without touching any role already completed under the
// prior approval, so a completed role next to an unapproved model means the
// method moved since that role was completed, exactly the case this marking
// exists to surface (ADR-0023 accepts this as visible-never-prevented).
//
// Exported so payMapping/runs.ts's precondition computation can reuse this
// EXACT predicate for its (non-blocking) drift warning, rather than
// re-deriving a second notion of "completed under an earlier method": the roles
// wire and the pay-mapping start dialog must never be able to name a
// different set of drifted roles.
export function deriveMethodDrift(
  assessment: Doc<"roles">["assessment"],
  model: Doc<"models"> | null
): boolean {
  if (assessment === undefined || model === undefined || model === null) {
    return false
  }
  if (model.approval === undefined) return true
  return assessment.completedAt < model.approval.approvedAt
}

const zoneWireValidator = v.union(zoneKeyValidator, v.null())
// A profile failure carries the criterion's NAME as well as its id, because
// the only surface that reads it (the calibration queue) has to say WHICH
// requirement held a role back, in words. Resolving it here costs one bounded
// indexed read of the model's own criteria (at most MODEL_MAX_CRITERIA rows)
// and saves every reader a second query plus its own copy of the libraryKey
// name lookup.
const profileFailuresWireValidator = v.union(
  v.array(
    v.object({
      criterionId: v.string(),
      name: v.string(),
      required: v.number(),
      actual: v.number(),
    })
  ),
  v.null()
)

// Criterion ids to their localized display names. Every criterion is a library
// selection (decision 8), so its name always resolves from the library by
// libraryKey and is never stored. One builder, because both queries here need
// the same map and a third hand-rolled copy of it was already drifting.
function criterionNameMap(
  rows: readonly Doc<"criteria">[],
  content: ReturnType<typeof criteriaLibraryContent>
): Map<string, string> {
  return new Map(
    rows.map((row) => [
      row._id as string,
      content.criteria[row.libraryKey].name,
    ])
  )
}

// Names each profile failure from the model's own criteria. The engine reports
// failures by criterion id (it knows nothing about display text); every
// criterion is a library selection (decision 8), so its name always localizes
// from the library by libraryKey and is never stored.
function nameFailures(
  failures: readonly {
    criterionId: string
    required: number
    actual: number
  }[],
  nameById: ReadonlyMap<string, string>
) {
  return failures.map((failure) => ({
    ...failure,
    name: nameById.get(failure.criterionId) ?? "",
  }))
}

// The results view: live-derived rows for every non-archived role plus the
// model's level list. Score/level are computed at read time and never stored
// (ADR-0002). Sorted level-first (Level 1 on top), score desc within a level,
// incomplete and uncompleted roles last by title -- which is also what makes
// "only
// completed roles place" fall out of the existing sort for free on the levels
// surfaces (their level is null until completed).
export const getResults = orgQuery({
  args: { locale: v.optional(v.string()) },
  returns: v.object({
    rows: v.array(
      v.object({
        roleId: v.id("roles"),
        title: v.string(),
        slug: v.string(),
        trackKey: v.string(),
        trackName: v.string(),
        complete: v.boolean(),
        ratedCount: v.number(),
        totalCriteria: v.number(),
        completed: v.boolean(),
        calibrated: v.boolean(),
        readyToComplete: v.boolean(),
        methodDrift: v.boolean(),
        score: v.union(v.number(), v.null()),
        level: v.union(v.number(), v.null()),
        zone: zoneWireValidator,
        profileLimited: v.union(v.boolean(), v.null()),
        profileFailures: profileFailuresWireValidator,
        familyId: v.union(v.id("roleFamilies"), v.null()),
        familyName: v.union(v.string(), v.null()),
        anchor: v.union(
          v.null(),
          v.object({
            expectedLevel: v.number(),
            status: v.union(v.literal("active"), v.literal("underReview")),
          })
        ),
      })
    ),
    levels: v.array(v.object({ level: v.number(), minScore: v.number() })),
    // Whether the method is approved (ADR-0023). On this wire rather than a
    // second query because the handler already reads the model, and the one
    // surface that needs it (the calibration queue) is rendered from these very
    // rows: two subscriptions could disagree for a frame and show a queue
    // beside a "not approved yet" message.
    approved: v.boolean(),
  }),
  handler: async (ctx, { locale }) => {
    const derived = await deriveResults(ctx, ctx.orgId)
    const resultByRole = new Map(
      derived.results.map((result) => [result.roleId, result])
    )

    const names = trackNames(locale)
    const families = await familyNames(ctx, ctx.orgId)
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    const criteriaRows =
      model === null
        ? []
        : await ctx.db
            .query("criteria")
            .withIndex("by_model", (q) => q.eq("modelId", model._id))
            .collect()
    const content = criteriaLibraryContent(clampLocale(locale))
    const criterionNames = criterionNameMap(criteriaRows, content)
    // The ladder is method law (ADR-0024), so it is the same for every
    // organization and does not depend on the model existing. It stays on the
    // wire because every level surface draws its bands from it and would
    // otherwise re-derive the architecture client-side.
    const levels = [...LEVEL_RULES]
      .sort((a, b) => a.level - b.level)
      .map((rule) => ({ level: rule.level, minScore: rule.minScore }))

    const roleRows = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const active = roleRows.filter((role) => role.archivedAt === undefined)

    const rows = []
    for (const role of active) {
      const result = resultByRole.get(role._id as string)
      const track = names.get(role.trackKey)
      const anchorRole = role.anchorRole
      const anchor =
        anchorRole === undefined || anchorRole.status === "replaced"
          ? null
          : {
              expectedLevel: anchorRole.expectedLevel,
              status: anchorRole.status,
            }
      const completed = role.assessment !== undefined
      const complete = result?.complete ?? false
      rows.push({
        roleId: role._id,
        title: role.title,
        slug: role.slug,
        trackKey: role.trackKey,
        trackName: track?.name ?? role.trackKey,
        complete,
        ratedCount: result?.ratedCount ?? 0,
        totalCriteria: derived.totalCriteria,
        completed,
        calibrated: role.assessment?.calibratedAt !== undefined,
        readyToComplete: complete && !completed,
        methodDrift: deriveMethodDrift(role.assessment, model),
        score: completed ? (result?.score ?? null) : null,
        level: completed ? (result?.level ?? null) : null,
        zone: completed ? (result?.zone ?? null) : null,
        profileLimited: completed ? (result?.profileLimited ?? null) : null,
        profileFailures: completed
          ? nameFailures(result?.profileFailures ?? [], criterionNames)
          : null,
        familyId: role.familyId ?? null,
        familyName:
          role.familyId !== undefined
            ? (families.get(role.familyId as string)?.name ?? null)
            : null,
        anchor,
      })
    }
    const sortLocale = clampLocale(locale)
    rows.sort((a, b) => {
      if (a.level !== null && b.level !== null) {
        return (
          a.level - b.level ||
          (b.score ?? 0) - (a.score ?? 0) ||
          a.title.localeCompare(b.title, sortLocale)
        )
      }
      if (a.level !== null) return -1
      if (b.level !== null) return 1
      return a.title.localeCompare(b.title, sortLocale)
    })
    return { rows, levels, approved: model?.approval !== undefined }
  },
})

// Per-role result: score (normalized 0-100), level outcome, and the
// per-criterion breakdown (localized criterion name, weight points, rating
// value, motivation). The role view derives each criterion's contribution
// share from value * weightPoints client-side (packages/core criterionShares,
// which validates each rating against its own dimension), so dimensionKey
// travels alongside weightPoints and value.
//
// NOTE on `criteria`: the per-criterion value/motivation are NOT gated on
// `completed` at this wire (unlike score/level/zone below) -- they are the same
// per-criterion rows the blind rating flow already writes and re-reads while
// rating. Blindness for the AGGREGATE outcome (the reveal this whole task is
// about) is enforced by the four dashboard consumers of this query, which
// only ever render the breakdown once `completed` is true (rating-result.tsx,
// role-evaluation-card.tsx, role-sheet.tsx, rate/page.tsx); a future fifth
// consumer must keep that same rule.
export const getRoleResult = orgQuery({
  args: { roleId: v.string(), locale: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({
      roleId: v.id("roles"),
      title: v.string(),
      complete: v.boolean(),
      ratedCount: v.number(),
      totalCriteria: v.number(),
      completed: v.boolean(),
      calibrated: v.boolean(),
      readyToComplete: v.boolean(),
      methodDrift: v.boolean(),
      score: v.union(v.number(), v.null()),
      level: v.union(v.number(), v.null()),
      zone: zoneWireValidator,
      profileLimited: v.union(v.boolean(), v.null()),
      profileFailures: profileFailuresWireValidator,
      criteria: v.array(
        v.object({
          criterionId: v.id("criteria"),
          name: v.string(),
          dimensionKey: dimensionKeyValidator,
          weightPoints: v.number(),
          value: v.union(v.number(), v.null()),
          motivation: v.union(v.string(), v.null()),
        })
      ),
    })
  ),
  handler: async (ctx, { roleId, locale }) => {
    const docId = ctx.db.normalizeId("roles", roleId)
    if (docId === null) return null
    const role = await ctx.db.get(docId)
    if (role === null || role.orgId !== ctx.orgId) return null

    const derived = await deriveResults(ctx, ctx.orgId)
    const result = derived.results.find(
      (row) => row.roleId === (docId as string)
    )

    const content = criteriaLibraryContent(clampLocale(locale))
    const model = await ctx.db
      .query("models")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (model === null) return null
    const criteriaRows = await ctx.db
      .query("criteria")
      .withIndex("by_model", (q) => q.eq("modelId", model._id))
      .collect()
    criteriaRows.sort((a, b) => a.order - b.order)

    const ratingRows = await ctx.db
      .query("ratings")
      .withIndex("by_role_criterion", (q) => q.eq("roleId", docId))
      .collect()
    const ratingByCriterion = new Map(
      ratingRows.map((rating) => [rating.criterionId as string, rating])
    )

    const names = criterionNameMap(criteriaRows, content)
    const completed = role.assessment !== undefined
    const complete = result?.complete ?? false
    return {
      roleId: role._id,
      title: role.title,
      complete,
      ratedCount: result?.ratedCount ?? 0,
      totalCriteria: derived.totalCriteria,
      completed,
      calibrated: role.assessment?.calibratedAt !== undefined,
      readyToComplete: complete && !completed,
      methodDrift: deriveMethodDrift(role.assessment, model),
      score: completed ? (result?.score ?? null) : null,
      level: completed ? (result?.level ?? null) : null,
      zone: completed ? (result?.zone ?? null) : null,
      profileLimited: completed ? (result?.profileLimited ?? null) : null,
      profileFailures: completed
        ? nameFailures(result?.profileFailures ?? [], names)
        : null,
      criteria: criteriaRows.map((row) => {
        const rating = ratingByCriterion.get(row._id as string)
        return {
          criterionId: row._id,
          name: names.get(row._id as string) ?? "",
          dimensionKey: LIBRARY_DIMENSION[row.libraryKey],
          weightPoints: row.weightPoints,
          value: rating?.value ?? null,
          motivation: rating?.motivation ?? null,
        }
      }),
    }
  },
})
