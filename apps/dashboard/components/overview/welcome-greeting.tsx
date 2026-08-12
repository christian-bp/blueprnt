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
const HEADING_CLASS = "font-semibold text-3xl"

// Personal welcome heading: a time-of-day greeting plus the user's first name.
// The hour is read AFTER mount (never during SSR) so the server clock cannot
// cause a hydration mismatch; a heading-sized skeleton holds the space until
// the hour and session are ready. Re-checked every 5 minutes to cross hour
// boundaries without a reload.
//
// `centered` is additive: the overview hero renders this text-centered
// inside its own centered column, every other (hypothetical) caller keeps
// the left-aligned default, and the prop touches nothing existing callers
// already rely on.
export function WelcomeGreeting({
  centered = false,
}: {
  centered?: boolean
} = {}) {
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
      <h1 className={cn(HEADING_CLASS, centered && "text-center")}>
        <Skeleton className="h-9 w-72" />
      </h1>
    )
  }

  const firstName = session?.user?.name?.split(" ")[0] ?? ""
  return (
    <h1 className={cn(HEADING_CLASS, centered && "text-center")}>
      {t(greetingBucket(hour), {
        hasName: firstName ? "yes" : "no",
        name: firstName,
      })}
    </h1>
  )
}
