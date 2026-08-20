"use client"

import { AnimatePresence, motion } from "motion/react"
import type { ReactNode } from "react"
import { SPRING } from "@/lib/motion"

// One chapter's share of a journey: how much work it holds, and how much of
// it is done.
export interface ProgressSegment {
  key: string
  done: number
  total: number
}

// The segmented journey bar, shared by every guided section that has
// chapters (the kartläggning analysis, the model section). Geometry, the
// weighting rule and the count row live here once, so two sections drawing
// "how far along is this" can never drift into two different bars.
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
}) {
  const pct = total <= 0 ? 0 : Math.round((done / total) * 100)

  return (
    // One bar, split into the chapters and weighted by how much work each one
    // holds. A single undivided bar left the shape of the work invisible: in a
    // real run one chapter carries 21 of the 29 steps, so its segment is most
    // of the bar and that is the honest picture. Equal-width segments would
    // read "2 of 4 chapters done" as halfway when it is a sixth of the work.
    <div className="space-y-1">
      {/* The active chapter's name, over its own segment. The mirror of the
          count row below the bar, and built the same way: the same flex
          weights so the name sits over the part of the bar it names, a
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
              style={{
                flexGrow: Math.max(segment.total, 0),
                flexBasis: "0.75rem",
              }}
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
        {segments.map((segment) => (
          <div
            key={segment.key}
            // The bar's segments and the tab row can never line up: segments
            // are weighted by how much work a chapter holds, tabs by how long
            // their names are. Simultaneous highlighting is what links them
            // instead. With no active chapter the whole bar reads at full
            // strength.
            data-active={
              activeSegment === undefined || activeSegment === segment.key
            }
            style={{
              flexGrow: Math.max(segment.total, 0),
              flexBasis: "0.75rem",
            }}
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
            className="group/segment h-full overflow-hidden rounded-full bg-primary/12"
          >
            <div
              className="h-full rounded-full bg-primary opacity-45 transition-[width,opacity] duration-500 group-data-[active=true]/segment:opacity-100"
              style={{
                width:
                  segment.total <= 0
                    ? "0%"
                    : `${Math.round((segment.done / segment.total) * 100)}%`,
              }}
            />
          </div>
        ))}
      </div>
      {/* The open chapter's own count, under its own segment. Mirrors the
          bar's flex weights so the figure sits beneath the part of the bar it
          describes, which is what makes "1 of 3" mean this chapter rather than
          the whole journey. The only count on this surface: it is the one the
          reader is working in. Reserved height, so lighting up a chapter never
          reflows the page (the no-layout-shift rule). */}
      <div aria-hidden="true" className="flex h-4 w-full gap-0.5">
        {segments.map((segment) => (
          <div
            key={segment.key}
            style={{
              flexGrow: Math.max(segment.total, 0),
              flexBasis: "0.75rem",
            }}
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
