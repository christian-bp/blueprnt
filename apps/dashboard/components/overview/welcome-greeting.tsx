"use client"

import { Skeleton } from "@workspace/ui/components/skeleton"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { authClient } from "@/lib/auth-client"
import { greetingBucket } from "@/lib/greeting"

// The greeting is the overview's hero heading: larger than a standard page title
// (PageHeading is text-lg), still brand-colored.
const HEADING_CLASS = "font-semibold text-3xl text-brand"

// Personal welcome heading: a time-of-day greeting plus the user's first name.
// The hour is read AFTER mount (never during SSR) so the server clock cannot
// cause a hydration mismatch; a heading-sized skeleton holds the space until
// the hour and session are ready. Re-checked every 5 minutes to cross hour
// boundaries without a reload.
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
      <h1 className={HEADING_CLASS}>
        <Skeleton className="h-9 w-72" />
      </h1>
    )
  }

  const firstName = session?.user?.name?.split(" ")[0] ?? ""
  return (
    <h1 className={HEADING_CLASS}>
      {t(greetingBucket(hour), {
        hasName: firstName ? "yes" : "no",
        name: firstName,
      })}
    </h1>
  )
}
