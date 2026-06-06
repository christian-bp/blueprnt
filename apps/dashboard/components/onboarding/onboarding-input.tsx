"use client"

import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

// The one-question-per-screen text input: roomier and slightly larger type
// than the standard Input, matching the conversational scale of the screens.
// Dense editor forms elsewhere in onboarding keep the standard size.
export function OnboardingInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      className={cn("h-12 px-4 text-lg md:text-lg", className)}
      {...props}
    />
  )
}
