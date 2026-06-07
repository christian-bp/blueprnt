"use client"

import { TextEffect } from "@workspace/ui/text-effect"
import { motion } from "motion/react"
import { type ReactNode, useState } from "react"

// The conversational frame every onboarding question screen shares: the
// heading reveals word by word (blur preset), and once it has finished the
// content below fades in (the polyform onboarding pattern). The content is
// mounted from the start at opacity 0, so the reveal never shifts layout;
// pointer events are disabled until it is visible so nothing invisible is
// clickable.
export function ScreenShell({
  heading,
  description,
  children,
}: {
  heading: string
  // Optional subtitle rendered as the first line of the revealed content,
  // so the last steps share one shape: heading, muted description, content.
  description?: string
  children: ReactNode
}) {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="flex flex-col items-center gap-6">
      <TextEffect
        as="h1"
        preset="blur"
        per="word"
        className="text-center font-semibold text-2xl"
        onAnimationComplete={() => setRevealed(true)}
      >
        {heading}
      </TextEffect>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: revealed ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        style={{ pointerEvents: revealed ? undefined : "none" }}
        className="flex w-full flex-col items-center gap-6"
      >
        {description !== undefined && (
          <p className="text-center text-muted-foreground text-sm">
            {description}
          </p>
        )}
        {children}
      </motion.div>
    </div>
  )
}
