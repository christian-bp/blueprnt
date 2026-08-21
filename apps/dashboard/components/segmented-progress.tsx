"use client"

import { AnimatePresence, motion } from "motion/react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { CelebrationBurst } from "@/components/celebration-burst"
import { SPRING } from "@/lib/motion"

// One chapter's share of a journey: how much work it holds, and how much of
// it is done.
export interface ProgressSegment {
  key: string
  done: number
  total: number
}

// The one flex every segment carries, in all three rows (the name above, the
// bar, the count below), so a name and a figure always sit over and under the
// segment they belong to. Constant because every chapter is the same width;
// the basis is what keeps a chapter with no work in it from collapsing to
// nothing.
const SEGMENT_STYLE = { flexGrow: 1, flexBasis: "0.75rem" }

// The segmented journey bar, shared by every guided section that has
// chapters (the kartläggning analysis, the model section). Geometry, the fill
// rule and the count row live here once, so two sections drawing "how far
// along is this" can never drift into two different bars.
//
// What stays with the caller is everything that is section-specific: the
// heading above it, the help beside that heading, and the WORDS of the count
// (renderCount), because a message key belongs to the surface that owns the
// concept, not to a geometry primitive.
export function SegmentedProgress({
  barLabel,
  done,
  total,
  segments,
  activeSegment,
  renderCount,
  renderTitle,
  celebrateOnComplete,
}: {
  // The bar always shows the WHOLE journey, whichever page it is on, so its
  // accessible name says so rather than borrowing the heading's.
  barLabel: string
  // The journey's overall done/total, for the bar's announced percentage.
  done: number
  total: number
  // Each chapter's own done/total, in chapter order.
  segments: readonly ProgressSegment[]
  // The chapter whose page is open. Its segment is held at full strength
  // while the rest recede, which is what ties the bar to the tab row
  // underneath it. Optional only for the moment before a path resolves to a
  // chapter; every real page has one.
  activeSegment?: string
  // The open chapter's own count, as the caller's own localized message.
  renderCount: (segment: ProgressSegment) => ReactNode
  // The open chapter's own NAME, above its segment, mirroring the count
  // below it. Optional and absent by default: a section that does not pass
  // it renders exactly the DOM it rendered before, which is how the
  // kartläggning's spine keeps its own layout, distinct from the model's.
  renderTitle?: (segment: ProgressSegment) => ReactNode
  // Plays the same celebration the overview to-do row throws when a work
  // card arrives (CelebrationBurst), over a segment the moment it crosses
  // from incomplete to complete while mounted. Off by default, so a caller
  // that does not pass it renders exactly the DOM it rendered before: the
  // kartläggning's analysis spine stays as it was, and only a section that
  // opts in (the model spine) gets the burst.
  celebrateOnComplete?: boolean
}) {
  const pct = total <= 0 ? 0 : Math.round((done / total) * 100)

  // Remembers each segment's own completeness across renders, so a fresh
  // crossing can be told apart from a segment that simply arrived finished.
  // Keyed by segment key, the same identity the caller already keys its own
  // list by.
  const wasCompleteRef = useRef<Record<string, boolean>>({})
  // How many times each segment has been SEEN completing, not just whether
  // it has: a chapter here can move backward (a criterion removed, an
  // approval reopened) and forward again, and each forward crossing earns
  // its own burst. The count doubles as the celebration's React key below,
  // so a second crossing of the same segment remounts the burst instead of
  // reusing one already parked at its finished, invisible end state.
  const [celebrations, setCelebrations] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!celebrateOnComplete) return
    const wasComplete = wasCompleteRef.current
    const justCompleted: string[] = []
    for (const segment of segments) {
      const isComplete = segment.total > 0 && segment.done >= segment.total
      // Strictly `false`, never `undefined`: a segment seen for the first
      // time this mount has no prior state to have crossed FROM, so an
      // already-complete segment on arrival is not a completion, it is just
      // where the journey started.
      if (wasComplete[segment.key] === false && isComplete) {
        justCompleted.push(segment.key)
      }
      wasComplete[segment.key] = isComplete
    }
    if (justCompleted.length > 0) {
      setCelebrations((current) => {
        const next = { ...current }
        for (const key of justCompleted) {
          next[key] = (next[key] ?? 0) + 1
        }
        return next
      })
    }
  }, [celebrateOnComplete, segments])

  return (
    // One bar, split into equally wide chapters: a guided section's chapters
    // are its stations, and a station's width is not a claim about the work
    // behind it. What the work is stays on the surface where it can be read
    // rather than estimated from a shape: each segment FILLS by its own
    // done/total, the open chapter's count sits under its own segment, and the
    // bar announces the whole journey's WORK-weighted percentage, so a section
    // whose chapters hold 21 and 1 steps can never read as halfway on two of
    // four.
    <div className="space-y-1">
      {/* The active chapter's name, over its own segment. The mirror of the
          count row below the bar, and built the same way: the bar's own flex
          so the name sits over the part of the bar it names, a
          RESERVED height so a name appearing never pushes the bar down,
          nowrap so a long name overflows its segment rather than wrapping
          and changing the row's height, and the enter/exit mirrored (it
          rises INTO place from the bar, where the count falls away from
          it). Not rendered at all without renderTitle. */}
      {renderTitle !== undefined && (
        <div aria-hidden="true" className="flex h-5 w-full gap-0.5">
          {segments.map((segment) => (
            <div
              key={segment.key}
              style={SEGMENT_STYLE}
              className="relative h-full"
            >
              <AnimatePresence>
                {activeSegment === segment.key && (
                  <motion.span
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={SPRING}
                    className="absolute bottom-0 left-0 whitespace-nowrap font-medium text-foreground text-xs"
                  >
                    {renderTitle(segment)}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
      <div
        role="progressbar"
        aria-label={barLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="flex h-2 w-full gap-0.5 rounded-full"
      >
        {segments.map((segment) => {
          // The bar's segments and the tab row can never line up: every
          // segment is the same width, a tab's comes from how long its name
          // is. Simultaneous highlighting is what links them instead. With no
          // active chapter the whole bar reads at full strength.
          const isActive =
            activeSegment === undefined || activeSegment === segment.key
          // The dimming rides on the FILL, never on the track: the track is
          // "work not yet done" and that reads the same in every chapter, so
          // fading it made the open chapter's remainder a different colour
          // from everyone else's for no reason. Only the done part recedes.
          // The track sits at 12% and a receded fill at 45%, so "done" reads
          // as done even in a chapter you are not on. At 20/35 the two were
          // only 1.75x apart and a finished chapter looked untouched. The
          // track still has to be visible: it is the only hint of how big a
          // chapter is before you start it, so it stays a wash rather than
          // disappearing into the card.
          const fill = (
            <div
              className="h-full rounded-full bg-primary opacity-45 transition-[width,opacity] duration-500 group-data-[active=true]/segment:opacity-100"
              style={{
                width:
                  segment.total <= 0
                    ? "0%"
                    : `${Math.round((segment.done / segment.total) * 100)}%`,
              }}
            />
          )
          // Off by default: the exact two-node shape this bar has always
          // rendered, track clipping fill to a pill. On, the fill moves
          // inside CelebrationBurst's own unclipped box instead, because
          // "overflow-hidden" on the segment's own sliver would clip the
          // burst the instant a piece crosses the edge it is thrown from.
          if (!celebrateOnComplete) {
            return (
              <div
                key={segment.key}
                data-active={isActive}
                style={SEGMENT_STYLE}
                className="group/segment h-full overflow-hidden rounded-full bg-primary/12"
              >
                {fill}
              </div>
            )
          }
          return (
            <div
              key={segment.key}
              data-active={isActive}
              style={SEGMENT_STYLE}
              className="group/segment h-full"
            >
              <CelebrationBurst
                // Keyed by the crossing count, not just the segment: a second
                // crossing (a chapter completed, reopened, completed again)
                // has to remount the burst, because the first one is already
                // parked at its finished, invisible end state and a prop
                // that stays `true` would not replay it.
                key={celebrations[segment.key] ?? 0}
                active={(celebrations[segment.key] ?? 0) > 0}
                className="h-full"
              >
                <div className="h-full overflow-hidden rounded-full bg-primary/12">
                  {fill}
                </div>
              </CelebrationBurst>
            </div>
          )
        })}
      </div>
      {/* The open chapter's own count, under its own segment. Mirrors the
          bar's own flex so the figure sits beneath the part of the bar it
          describes, which is what makes "1 of 3" mean this chapter rather than
          the whole journey. The only count on this surface: it is the one the
          reader is working in. Reserved height, so lighting up a chapter never
          reflows the page (the no-layout-shift rule). */}
      <div aria-hidden="true" className="flex h-4 w-full gap-0.5">
        {segments.map((segment) => (
          <div
            key={segment.key}
            style={SEGMENT_STYLE}
            className="relative h-full"
          >
            <AnimatePresence>
              {activeSegment === segment.key && (
                <motion.span
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={SPRING}
                  className="absolute top-0 left-0 whitespace-nowrap text-muted-foreground text-xs tabular-nums"
                >
                  {renderCount(segment)}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  )
}
