"use client"

import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"

// The shared forward CTA for onboarding screens that still need a button
// (text inputs and review screens; pure choice screens auto-advance instead).
// "Next" with an arrow that nudges right on hover and keyboard focus. The
// nudge is a non-essential micro-interaction, so it is disabled under
// reduced motion.
export function NextButton({
  className,
  label,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "children"> & {
  // Override the default "Next" label (e.g. "Continue to weighting" for the
  // first phase of the model builder). The hover-nudge arrow is unchanged.
  label?: string
}) {
  const t = useTranslations("dashboard.onboarding.screens")
  return (
    <Button {...props} className={cn("group/next", className)}>
      {label ?? t("nextCta")}
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        aria-hidden="true"
        className="transition-transform group-hover/next:translate-x-0.5 group-focus-visible/next:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover/next:translate-x-0"
      />
    </Button>
  )
}
