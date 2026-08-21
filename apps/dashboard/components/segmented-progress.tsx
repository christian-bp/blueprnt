"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { CelebrationBurst } from "@/components/celebration-burst"

// One chapter's share of a journey: what it is called, how much work it holds,
// and how much of it is done.
export interface ProgressSegment {
  key: string
  // Already localized by the section that owns the message. Carried here for
  // the hover alone: the tab row under the instrument is what NAMES the
  // chapters on screen, and a pointer resting on a two-pixel sliver should not
  // have to count segments to find out which one it is on.
  name: string
  done: number
  total: number
}

// The one flex every segment carries. Constant because every chapter is the
// same width whatever it holds; the basis is what keeps a chapter with no work
// in it from collapsing to nothing.
const SEGMENT_STYLE = { flexGrow: 1, flexBasis: "0.5rem" }

// The journey instrument, shared by every guided section that has chapters
// (the kartläggning analysis, the model section). Geometry, the fill rule and
// the hover live here once, so two sections drawing "how far along is this"
// can never drift into two different instruments.
//
// It is an INSTRUMENT, not a banner: a fixed, compact width that sits on its
// section's title row rather than a full-width bar with a name over it and a
// figure under it. The full-width version annotated itself because it had the
// room to; at this size the annotations are what the surface around it already
// says. The chapters are named by the tab row directly under the title, the
// journey's own figures sit beside the instrument as the caller's counter, and
// a chapter's own standing is one hover away.
//
// What stays with the caller is everything that is section-specific: the title
// row it rides, the help beside that title, its overall counter, and the WORDS
// of a chapter's count (renderCount), because a message key belongs to the
// surface that owns the concept, not to a geometry primitive.
export function SegmentedProgress({
  barLabel,
  done,
  total,
  segments,
  activeSegment,
  renderCount,
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
  // A chapter's own status, as the caller's own localized message. Its one
  // consumer is the hover: at instrument size there is no room to print a
  // figure per chapter, and the journey's own figures sit beside the
  // instrument instead.
  renderCount: (segment: ProgressSegment) => ReactNode
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
    // Equally wide chapters: a guided section's chapters are its stations,
    // and a station's width is not a claim about the work behind it. What the
    // work is stays where it can be read rather than estimated from a shape:
    // each segment FILLS by its own done/total, each names itself and states
    // its own standing on hover, the caller's counter beside the instrument
    // carries the journey's own figures, and the announced percentage is
    // WORK-weighted, so a section whose chapters hold 21 and 1 steps can
    // never read as halfway on two of four.
    //
    // A FIXED, compact width: the instrument states where the journey stands,
    // it does not measure the page. w-52 leaves four segments wide enough that
    // a part-filled one still reads as part filled. It never shrinks below
    // that, so on a narrow viewport its title row wraps and the instrument
    // comes down whole rather than squeezing into slivers.
    <div
      role="progressbar"
      aria-label={barLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="flex h-2 w-52 shrink-0 gap-0.5 rounded-full"
    >
      {segments.map((segment) => {
        // The instrument's segments and the tab row can never line up: every
        // segment is the same width, a tab's comes from how long its name
        // is. Simultaneous highlighting is what links them instead. With no
        // active chapter the whole instrument reads at full strength.
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
        // The visible sliver, and its own padded hit area: the trigger box
        // above is the segment's full height while the track inside it is
        // two pixels, so the pointer catches a chapter without having to
        // land on the sliver itself.
        const strip = celebrateOnComplete ? (
          <CelebrationBurst
            // Keyed by the crossing count, not just the segment: a second
            // crossing (a chapter completed, reopened, completed again)
            // has to remount the burst, because the first one is already
            // parked at its finished, invisible end state and a prop
            // that stays `true` would not replay it.
            key={celebrations[segment.key] ?? 0}
            active={(celebrations[segment.key] ?? 0) > 0}
            className="h-2 w-full"
          >
            <div className="h-full overflow-hidden rounded-full bg-primary/12">
              {fill}
            </div>
          </CelebrationBurst>
        ) : (
          <div className="h-2 w-full overflow-hidden rounded-full bg-primary/12">
            {fill}
          </div>
        )
        return (
          // Its own provider, so the bar works wherever it is dropped (the
          // same self-contained idiom DeviationBadge uses).
          <TooltipProvider key={segment.key}>
            <Tooltip>
              {/* The segment itself is the hover target. A sliver two
                    pixels tall is not a shape anyone can read a chapter off,
                    so resting on one answers both questions at once: which
                    chapter this is, and where it stands. The tab row under
                    the bar is what NAMES them on screen; this is the same
                    fact where the pointer already is. */}
              <TooltipTrigger
                render={
                  <div
                    data-active={isActive}
                    style={SEGMENT_STYLE}
                    className="group/segment flex h-full items-center"
                  />
                }
              >
                {strip}
              </TooltipTrigger>
              <TooltipContent>
                {segment.name}
                {" · "}
                {renderCount(segment)}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      })}
    </div>
  )
}
