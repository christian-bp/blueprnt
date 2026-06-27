"use client"

import { TextEffect } from "@workspace/ui/text-effect"
import type { ReactNode } from "react"

// The shared auth heading: the title reveals word by word with the same blur
// TextEffect the onboarding screens use, centered, with an optional muted
// description beneath. Used by the sign-in, password, and forgot screens so
// every auth surface reads like the onboarding wizard.
export function AuthHeading({
  title,
  description,
}: {
  title: string
  description?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <TextEffect
        as="h1"
        preset="blur"
        per="word"
        className="text-center font-semibold text-2xl"
      >
        {title}
      </TextEffect>
      {description !== undefined ? (
        <p className="text-center text-muted-foreground text-sm">
          {description}
        </p>
      ) : null}
    </div>
  )
}
