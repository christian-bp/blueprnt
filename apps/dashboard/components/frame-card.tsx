"use client"

import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@workspace/ui/components/frame"
import type { ReactNode } from "react"

// The app's card-in-card anatomy for content that is not a register: a muted
// frame as the ground, one white panel per section on it, and the surface's
// actions in the foot under the last panel. Same shape as FrameTable, which
// is the table-shaped member of the family (its header carries the register's
// title and count, its single panel the table, its foot the pager), and the
// same shape the settings pages compose row by row.
//
// A surface reaches for this instead of a Card when it has MORE THAN ONE
// section: the frame's ground is what separates them, and a Card would leave
// the sections floating on one white field with nothing but vertical space
// between them. One panel per genuine section, never one per element:
// uniform borders flatten the hierarchy they are meant to build.
export function FrameCard({
  title,
  titleLevel = "div",
  size = "sm",
  kicker,
  extra,
  description,
  toolbar,
  footer,
  children,
}: {
  // ReactNode so a loading surface can stand a skeleton bar in for a
  // data-driven title. Omitted where the surface's own heading already sits
  // above the frame (an analysis step names itself in its question): a
  // header repeating it would title the same thing twice.
  title?: ReactNode
  // The heading element the title renders as. "div" (the default) is the
  // frame's own small title; a surface that owns the page's heading order
  // passes the level that keeps it unbroken.
  titleLevel?: "div" | "h1" | "h2" | "h3" | "h4"
  // The title's weight, FrameTable's own two sizes: "sm" (the default) is the
  // frame's small title; "lg" is for a surface whose title is the reader's
  // question rather than a label, where the line is long enough to wrap and
  // balances rather than leaving one word on the second row.
  size?: "sm" | "lg"
  // A muted line ABOVE the title: where the reader is (a chapter line, a
  // parent's name). Not a description of what follows, which is framing
  // prose; the surface below says that itself.
  kicker?: ReactNode
  // Badges and the concept's help, on the title's own line: the state of the
  // thing the title names.
  extra?: ReactNode
  // One line under the title, on the frame ground.
  description?: ReactNode
  // Controls on the header's right (the surface's own actions or a menu).
  toolbar?: ReactNode
  // Under the last panel, on the frame ground: the surface's primary action,
  // its hint, its pager. Never inside a panel, so every surface in the app
  // keeps its actions in the same place.
  footer?: ReactNode
  // One FramePanel per section. Omit for a frame that is only its header and
  // its foot (a gate with nothing to show but its action): an empty white
  // panel under the title reads as a loading defect, so no children means no
  // panel, the same rule SettingsFrame keeps.
  children?: ReactNode
}) {
  const Title = titleLevel
  // text-balance on the large title: a question long enough to wrap breaks
  // evenly instead of leaving one word alone on the second row.
  const titleClass =
    size === "lg"
      ? "min-w-0 text-balance font-semibold text-lg"
      : "min-w-0 font-semibold text-sm"
  const hasHeader =
    title !== undefined ||
    kicker !== undefined ||
    description !== undefined ||
    toolbar !== undefined ||
    extra !== undefined
  return (
    // w-full: a frame is a block-level container, and some callers mount it
    // as a flex item of a start-aligned column, where it would otherwise
    // shrink to its own text.
    <Frame spacing="sm" className="w-full">
      {hasHeader && (
        <FrameHeader className="flex-row items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            {kicker !== undefined && (
              <div className="text-muted-foreground text-sm">{kicker}</div>
            )}
            {(title !== undefined || extra !== undefined) && (
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                {title !== undefined &&
                  (titleLevel === "div" ? (
                    <FrameTitle className={titleClass}>{title}</FrameTitle>
                  ) : (
                    <Title className={titleClass}>{title}</Title>
                  ))}
                {extra}
              </div>
            )}
            {description !== undefined && (
              <FrameDescription>{description}</FrameDescription>
            )}
          </div>
          {toolbar !== undefined && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {toolbar}
            </div>
          )}
        </FrameHeader>
      )}
      {children}
      {footer !== undefined && (
        <FrameFooter className="py-2">{footer}</FrameFooter>
      )}
    </Frame>
  )
}

// One section inside a FrameCard: a white panel with an optional title of
// its own. A section whose content already names itself (a chart with its
// own header, a table with its columns) passes no title; one that is a bare
// field or a set of controls carries one, because a panel with no name is
// an edge with nothing to say.
export function FrameCardSection({
  title,
  help,
  className,
  children,
}: {
  title?: ReactNode
  // The concept's HelpMorphButton, beside the title it explains.
  help?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <FramePanel className={className ?? "space-y-4"}>
      {title !== undefined && (
        <div className="flex items-center gap-1.5">
          <h4 className="font-medium text-sm">{title}</h4>
          {help}
        </div>
      )}
      {children}
    </FramePanel>
  )
}
