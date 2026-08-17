"use client"

import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { authClient } from "@/lib/auth-client"
import { greetingBucket } from "@/lib/greeting"

// The greeting is the overview's hero heading: larger than a standard page
// title (PageHeading is text-lg), in the same regular ink as every other
// heading. Brand rose is a data-viz colour too, so it stays off headings
// and lands on the accents instead (links, CTAs, the widget icon chips).
// The one serif surface in the app: the display serif carries the hero's
// warmth while everything else stays on the sans. Single-weight family:
// never add a bold utility, the browser would synthesize a faux bold; size
// alone carries the hero scale.
const HEADING_CLASS = "font-serif text-4xl"

// Personal welcome heading: a time-of-day greeting plus the user's first name.
// The hour is read AFTER mount (never during SSR) so the server clock cannot
// cause a hydration mismatch; a heading-sized skeleton holds the space until
// the hour and session are ready. Re-checked every 5 minutes to cross hour
// boundaries without a reload.
//
// Always centered: the overview hero is its only caller, and the hero's own
// column is centered.
export function WelcomeGreeting() {
  const t = useTranslations("dashboard.overview.greeting")
  const { data: session } = authClient.useSession()
  const [hour, setHour] = useState<number | null>(null)

  useEffect(() => {
    setHour(new Date().getHours())
    const id = setInterval(() => setHour(new Date().getHours()), 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  if (hour === null || session === undefined) {
    return (
      <h1 className={cn(HEADING_CLASS, "text-center")}>
        {/* h-10 is not a guess: it is text-4xl's own line box (2.5rem), so the
            heading measures the same whether it holds this bar or the
            greeting. Deliberately a BLOCK child, the Skeleton's default: as an
            inline-block it would sit on the text baseline and the line box
            would grow by the font's descender (measured: 43px against the
            text's 40px), which is the exact class of skeleton-to-data shift
            this is here to avoid. */}
        <Skeleton className="h-10 w-80" />
      </h1>
    )
  }

  const firstName = session?.user?.name?.split(" ")[0] ?? ""
  return (
    <h1 className={cn(HEADING_CLASS, "text-center")}>
      {/* The name renders in muted ink (the reference hero's treatment:
          the greeting carries the weight, the name recedes). The tag is
          named muted, not name, because next-intl resolves tags and string
          arguments from the same values object. */}
      {t.rich(greetingBucket(hour), {
        hasName: firstName ? "yes" : "no",
        name: firstName,
        muted: (chunks) => (
          <span className="text-muted-foreground">{chunks}</span>
        ),
      })}
    </h1>
  )
}
