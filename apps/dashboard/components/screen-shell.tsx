"use client"

import { cn } from "@workspace/ui/lib/utils"
import { TextEffect } from "@workspace/ui/text-effect"
import { motion } from "motion/react"
import { type ReactNode, useState } from "react"

// The conversational frame every onboarding-style question screen shares:
// the heading reveals word by word (blur preset), and once it has finished
// the content below fades in (the polyform onboarding pattern). The content
// is mounted from the start at opacity 0, so the reveal never shifts layout;
// pointer events are disabled until it is visible so nothing invisible is
// clickable. Shared app primitive (onboarding, the people import wizard, and
// the pay-mapping review journey all mount steps through it), so it lives at
// the components root rather than under any one surface's folder.
export function ScreenShell({
  heading,
  description,
  highlight,
  animated = true,
  align = "center",
  headingLevel = "h1",
  headingExtra,
  children,
}: {
  heading: string
  // Optional subtitle rendered as the first line of the revealed content,
  // so the last steps share one shape: heading, muted description, content.
  description?: string
  // Optional derived-value highlight forwarded to the heading's TextEffect:
  // the first case-insensitive match (e.g. the company name) is brand-colored.
  highlight?: string
  // Whether the heading reveals word by word and the content fades in once
  // that reveal completes (the wizard pattern above). Set false for a
  // surface where content swaps are driven by something else already (e.g.
  // a master-detail pane's own crossfade) and rapid clicks must swap content
  // instantly: a plain heading, content immediately visible and interactive,
  // no fade gate and no pointer-events suppression.
  animated?: boolean
  // "center" is the onboarding/import look (short celebratory headings).
  // "start" left-aligns the heading and description: a long heading, like a
  // praxis review question wrapping over two lines, reads ragged when
  // centered.
  align?: "center" | "start"
  // The rendered heading element. Defaults to h1 (onboarding/import/wizard
  // surfaces mount at the top of their own page). A surface that mounts
  // ScreenShell under an ancestor heading (e.g. the analysis summary's pane,
  // which sits under the page's h2 and the summary's own h3) passes the
  // level that keeps the document's heading order unbroken.
  headingLevel?: "h1" | "h2" | "h3" | "h4"
  // Rendered right of the heading on the same row (badges, chips), wrapping
  // below it when space runs out. Meant for align="start" surfaces; a
  // centered heading has no "right side" for it to attach to.
  headingExtra?: ReactNode
  children: ReactNode
}) {
  const [revealed, setRevealed] = useState(false)

  const centered = align === "center"
  const headingClass = cn(
    "font-semibold text-2xl",
    centered ? "text-center" : "text-left"
  )

  const headingNode = animated ? (
    <TextEffect
      as={headingLevel}
      preset="blur"
      per="word"
      highlight={highlight}
      className={headingClass}
      onAnimationComplete={() => setRevealed(true)}
    >
      {heading}
    </TextEffect>
  ) : (
    (() => {
      const HeadingTag = headingLevel
      return <HeadingTag className={headingClass}>{heading}</HeadingTag>
    })()
  )

  const content = (
    <>
      {description !== undefined && (
        <p
          className={cn(
            "text-base text-muted-foreground",
            centered ? "text-center" : "w-full text-left"
          )}
        >
          {description}
        </p>
      )}
      {children}
    </>
  )

  const contentClass = cn(
    "flex w-full flex-col gap-6",
    centered ? "items-center" : "items-start"
  )

  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        centered ? "items-center" : "items-start"
      )}
    >
      {headingExtra !== undefined ? (
        <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {headingNode}
          <div className="flex shrink-0 items-center gap-2">{headingExtra}</div>
        </div>
      ) : (
        headingNode
      )}
      {animated ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: revealed ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          style={{ pointerEvents: revealed ? undefined : "none" }}
          className={contentClass}
        >
          {content}
        </motion.div>
      ) : (
        <div className={contentClass}>{content}</div>
      )}
    </div>
  )
}
