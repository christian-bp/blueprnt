import type { ReviewQueue } from "./review-queue"

// The chapters, in the checklist's own order, so a caller never counts them
// itself. They live here, with the rest of the chapter model, rather than
// in a component that happened to need them first.
export const ANALYSIS_CHAPTERS = [
  "start",
  "praxis",
  "equalWork",
  "equivalentWork",
] as const

export type AnalysisChapter = (typeof ANALYSIS_CHAPTERS)[number]

// The four chapters are their own pages (Iteration 4), so every surface that
// links to one, resolves one from the URL, or advances across a chapter
// boundary needs the same key-to-segment mapping. It lives here, once,
// keyed by AnalysisChapter so a new chapter cannot compile without its
// segment.
//
// Segments are English like every other route in the app (analysis, actions,
// report); the visible chapter names come from i18n.
const CHAPTER_SEGMENTS: Record<AnalysisChapter, string> = {
  start: "start",
  praxis: "praxis",
  equalWork: "equal-work",
  equivalentWork: "equivalent-work",
}

export function chapterSegment(chapter: AnalysisChapter): string {
  return CHAPTER_SEGMENTS[chapter]
}

// The chapter a route segment names, or undefined for the Läget index (no
// segment) and for anything unrecognised.
export function chapterForSegment(
  segment: string | undefined
): AnalysisChapter | undefined {
  if (segment === undefined) return undefined
  return ANALYSIS_CHAPTERS.find(
    (chapter) => CHAPTER_SEGMENTS[chapter] === segment
  )
}

// A run's analysis base path, parsed from the current pathname:
// /pay-mappings/<slug>/analysis[/<segment>]. Returned without a trailing
// slash so chapterHref can append its own segment. Not exported: the
// section has no page of its own at that path, only a redirect into the
// first chapter.
function analysisBasePath(pathname: string): string {
  const [, slug] = pathname.split("/").filter(Boolean)
  return `/pay-mappings/${slug ?? ""}/analysis`
}

// Where a chapter's page lives for the run in the current path.
export function chapterHref(
  pathname: string,
  chapter: AnalysisChapter
): string {
  return `${analysisBasePath(pathname)}/${chapterSegment(chapter)}`
}

// The chapter the current path is on, or undefined on Läget.
export function currentChapter(pathname: string): AnalysisChapter | undefined {
  // /pay-mappings/<slug>/analysis[/<segment>]
  const segments = pathname.split("/").filter(Boolean)
  return chapterForSegment(segments[3])
}

// One chapter's done/total, normalised across a shape that does not have
// one. The queue carries `progress.praxis/equalWork/equivalentWork` as
// counts but the start chapter as a single `collaborationDone` boolean,
// because it is one step. Every surface that shows per-chapter progress
// (the chapter tab row, a chapter page) needs the same normalisation, so it
// lives here rather than as a conditional at each call site.
export function chapterProgress(
  queue: ReviewQueue,
  chapter: AnalysisChapter
): { done: number; total: number } {
  if (chapter === "start")
    return { done: queue.progress.collaborationDone ? 1 : 0, total: 1 }
  return queue.progress[chapter]
}

// Whether the analysis section ends this chapter with a link on to the next
// one: the chapter's own work is finished and a next chapter exists.
//
// Shared, because a step's primary action has to disappear exactly when that
// link appears. Two controls for one destination read as two decisions, and
// the two used to be derived in two places from the same state, which is how
// they drifted apart.
export function chapterContinuationShown(
  queue: ReviewQueue | null | undefined,
  chapter: AnalysisChapter | undefined
): boolean {
  if (queue === null || queue === undefined || chapter === undefined)
    return false
  const index = ANALYSIS_CHAPTERS.indexOf(chapter)
  // The last chapter has nowhere to continue to, so its steps keep their
  // own primary action to the end.
  if (index === -1 || ANALYSIS_CHAPTERS[index + 1] === undefined) return false
  const { done, total } = chapterProgress(queue, chapter)
  return total > 0 && done === total
}
