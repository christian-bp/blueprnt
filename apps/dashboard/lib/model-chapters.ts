import { type MethodCheckKey, MODEL_MIN_CRITERIA } from "@workspace/core"

// The model section's four chapters, in the order the work is done, so a
// caller never counts them itself. They live here, with the rest of the
// chapter model, rather than in the component that happened to need them
// first.
export const MODEL_CHAPTERS = [
  "criteria",
  "weighting",
  "method",
  "approval",
] as const

export type ModelChapter = (typeof MODEL_CHAPTERS)[number]

// Every chapter is its own page, so every surface that links to one or
// resolves one from the URL needs the same key-to-segment mapping. It lives
// here, once, keyed by ModelChapter so a new chapter cannot compile without
// its segment.
//
// Segments are English like every other route in the app; the visible chapter
// names come from i18n.
const CHAPTER_SEGMENTS: Record<ModelChapter, string> = {
  criteria: "criteria",
  weighting: "weighting",
  method: "method",
  approval: "approval",
}

// Not exported: unlike the analysis registry's twin (whose segment a
// kartläggning's header tabs and actions overview build hrefs from), nothing
// outside this module needs a model chapter's segment on its own. chapterHref
// is the way in.
function chapterSegment(chapter: ModelChapter): string {
  return CHAPTER_SEGMENTS[chapter]
}

// The chapter a route segment names, or undefined for the section's own path
// (no segment, a redirect into the first chapter) and for anything
// unrecognised. Not exported: currentChapter is the way in.
function chapterForSegment(
  segment: string | undefined
): ModelChapter | undefined {
  if (segment === undefined) return undefined
  return MODEL_CHAPTERS.find((chapter) => CHAPTER_SEGMENTS[chapter] === segment)
}

// Where a chapter's page lives. Unlike the kartläggning's chapters these
// paths carry no run slug, so the href needs nothing from the current
// pathname.
export function chapterHref(chapter: ModelChapter): string {
  return `/model/${chapterSegment(chapter)}`
}

// The chapter the current path is on, or undefined on /model itself.
export function currentChapter(pathname: string): ModelChapter | undefined {
  // /model[/<segment>]
  const segments = pathname.split("/").filter(Boolean)
  return chapterForSegment(segments[1])
}

// Where a failing check is FIXED: the chapter whose own controls satisfy it.
// The approval checklist reports the ten verdicts but owns none of the work,
// so a row that fails has to be able to say where the work is, and a reader who
// has to guess which of four chapters a verdict belongs to is being told they
// are wrong without being told what to do.
//
// A total Record over MethodCheckKey, not a lookup with a default: an eleventh
// check must not compile until someone decides where its remedy lives, the same
// guard idiom AUDIT_SUBJECTS uses in the backend.
//
// `null` stays available as the reviewed decision that a check has NO in-app
// remedy, and nothing claims it today. A check whose remedy exists must never
// say it does not: that line is read at exactly the moment the surface below it
// would fix the problem.
export const CHECK_CHAPTER: Record<MethodCheckKey, ModelChapter | null> = {
  dimensionCoverage: "criteria",
  // The materiality decision is asked on the Kriterier chapter's fourth column.
  workingConditionsTested: "criteria",
  criterionCount: "criteria",
  dimensionCaps: "criteria",
  // Anchors are library-guaranteed, so this can only fail for a criterion whose
  // library entry is gone; re-choosing it is a Kriterier gesture.
  anchorsComplete: "criteria",
  documentationComplete: "method",
  weightBudget: "weighting",
  dimensionWeightBalance: "weighting",
  peopleLeadershipWeight: "weighting",
  overlapPairs: "method",
}

// The two warning checks whose satisfaction IS a weight motivation, and so
// belong to the Viktning chapter's own work. The third warning (overlapPairs)
// is satisfied by the overlap protokoll, which is Metod's.
//
// They differ in whether the obligation always EXISTS, and the difference is
// the point of the list rather than an accident of it:
//
// dimensionWeightBalance is unconditional. Every weighted model can have a
// dimension run away with the allocation, so "dominance is motivated where
// there is dominance" is live from the moment there is a weighting. It is a
// unit whether or not any dimension is currently over its share, which is
// what keeps the chapter's TOTAL still while the reader drags weights: only
// the fulfilment moves.
//
// peopleLeadershipWeight is conditional. A model that selected no
// people-leadership criterion has nothing to ask, and counting a unit for
// work that cannot be started is exactly the born-done dishonesty the
// chapter had to unlearn. The engine reports its own applicability rather
// than this file re-deriving it from a library key.
const WEIGHT_MOTIVATION_CHECKS: readonly MethodCheckKey[] = [
  "dimensionWeightBalance",
  "peopleLeadershipWeight",
]

// The obligations a weighting carries on THIS model: every one the engine
// reports, minus any whose subject the model does not contain.
function weightObligations(
  input: ModelProgressInput
): readonly ModelProgressCheck[] {
  return WEIGHT_MOTIVATION_CHECKS.flatMap((key) => {
    const check = checkOf(input, key)
    return check === undefined || check.applies === false ? [] : [check]
  })
}

// The checks that decide whether the criteria selection itself is finished:
// the right number of criteria, no dimension over its cap, and the three
// mandatory dimensions covered. Weighting and documentation are other
// chapters' work and never hold this one open.
const CRITERIA_STATION_CHECKS: readonly MethodCheckKey[] = [
  "criterionCount",
  "dimensionCaps",
  "dimensionCoverage",
]

// The fourth dimension's materiality decision, which the Kriterier chapter now
// asks for in the working-conditions column itself. Its own unit rather than a
// station check: the selection can be finished while the decision is not, and
// the reader should see one of seven outstanding rather than a chapter that
// silently refuses to complete.
//
// The ENGINE's check, never a re-derivation: it is ok for a documented
// "tested, not material" with no criterion, and for exactly one active
// working-conditions criterion under a recorded decision. Reading the same
// check the approval gate reads is what keeps the spine and the gate from
// disagreeing about a chapter the reader is looking at.
const CRITERIA_MATERIALITY_CHECK: MethodCheckKey = "workingConditionsTested"

// The slice of getMethodChecks a progress reading needs. Structural rather
// than the wire type itself, so the derivation can be exercised with a
// handful of checks instead of a whole model.
export interface ModelProgressCheck {
  key: MethodCheckKey
  ok: boolean
  // Whether the check's obligation EXISTS for this model at all, as opposed
  // to being satisfied. Only the checks whose subject can be absent carry it
  // (packages/core MethodCheck.applies); absent means the obligation is
  // unconditional.
  applies?: boolean
  // The criteria a check names as failing it (documentationComplete lists the
  // ones not yet documented and approved).
  criterionIds?: readonly string[]
  // criterionCount carries the model's criteria total.
  count?: number
}

export interface ModelProgressInput {
  checks: readonly ModelProgressCheck[]
  // The model carries an approval right now.
  approved: boolean
  // A human has SAVED a weighting at least once (models.weightsSavedAt).
  weightsSaved: boolean
}

interface ChapterProgress {
  done: number
  total: number
}

function checkOf(
  input: ModelProgressInput,
  key: MethodCheckKey
): ModelProgressCheck | undefined {
  return input.checks.find((check) => check.key === key)
}

function passes(input: ModelProgressInput, key: MethodCheckKey): boolean {
  return checkOf(input, key)?.ok === true
}

// How many criteria the model holds, read from the check that counts them
// rather than from a second query.
function criteriaCount(input: ModelProgressInput): number {
  return checkOf(input, "criterionCount")?.count ?? 0
}

// One chapter's done/total, derived on every render and never stored: there
// is no visit tracking here, only the state of the model itself, so a chapter
// re-opens the moment its work stops being true.
//
// The totals are the chapters' real work, which is what makes the spine's
// segments honest: Metod carries one step per criterion and is therefore the
// wide segment, exactly as the kartläggning bar's biggest chapter is.
export function modelChapterProgress(
  input: ModelProgressInput,
  chapter: ModelChapter
): ChapterProgress {
  switch (chapter) {
    case "criteria": {
      // The model needs at least six criteria, so six is the work; the
      // maximum of eight is a ceiling, not a target, and counting against it
      // would leave a finished selection reading as three quarters done. The
      // seventh unit is the working-conditions materiality decision, which the
      // fourth column asks for on this chapter.
      const selected = Math.min(criteriaCount(input), MODEL_MIN_CRITERIA)
      const stationOk = CRITERIA_STATION_CHECKS.every((key) =>
        passes(input, key)
      )
      return {
        // A selection of six that breaks a dimension cap or leaves a
        // mandatory dimension uncovered is not a finished chapter, so it
        // never reads as one.
        done:
          (stationOk ? selected : Math.min(selected, MODEL_MIN_CRITERIA - 1)) +
          (passes(input, CRITERIA_MATERIALITY_CHECK) ? 1 : 0),
        total: MODEL_MIN_CRITERIA + 1,
      }
    }
    case "weighting": {
      // The save act, plus one unit per motivation obligation this model
      // actually carries. Every unit is an ACT the user performed, which is
      // the rule this chapter had to learn twice.
      //
      // The first unit is the SAVE, not the budget check. Criteria enter at 3
      // points and the budget is the criteria count times 3, so a selection is
      // already balanced the moment it exists: the check passes on a model
      // nobody has opened, and on an empty one it passes vacuously (0 = 0).
      // models.weightsSavedAt records the act instead.
      //
      // And no neighbour zeroes it. This chapter used to return 0 whenever
      // Kriterier was incomplete, which meant deactivating a criterion after a
      // real save reported nothing done against a saved weighting and a
      // written motivation still on screen. A unit is the user's own act;
      // another chapter's state cannot un-perform it.
      const obligations = weightObligations(input)
      // Gated on the save, all of them: both warnings report ok when they
      // simply do not FIRE, so on an untouched selection they would be born
      // true and the chapter would open most of the way done. Once the
      // weighting has been saved the chapter has been used, and from then on
      // each unit reads its own real state, including falling back to false
      // if a later edit reopens the warning.
      return {
        done: input.weightsSaved
          ? 1 + obligations.filter((check) => check.ok).length
          : 0,
        total: 1 + obligations.length,
      }
    }
    case "method": {
      // One protokoll per criterion, and nothing else: the materiality
      // decision moved to the Kriterier chapter with the column that asks for
      // it, so counting it here would count one decision on two chapters.
      const count = criteriaCount(input)
      const undocumented =
        checkOf(input, "documentationComplete")?.criterionIds?.length ?? 0
      return { done: Math.max(count - undocumented, 0), total: count }
    }
    case "approval":
      return { done: input.approved ? 1 : 0, total: 1 }
  }
}

// The whole section's progress, summed over its chapters, for the spine's
// announced percentage.
export function modelProgress(input: ModelProgressInput): ChapterProgress {
  return MODEL_CHAPTERS.reduce<ChapterProgress>(
    (sum, chapter) => {
      const progress = modelChapterProgress(input, chapter)
      return {
        done: sum.done + progress.done,
        total: sum.total + progress.total,
      }
    },
    { done: 0, total: 0 }
  )
}
