"use client"

import { Skeleton } from "@workspace/ui/components/skeleton"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { PageHeading } from "@/components/page-heading"
import { authClient } from "@/lib/auth-client"
import { greetingBucket } from "@/lib/greeting"

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
      <PageHeading>
        <Skeleton className="h-8 w-64" />
      </PageHeading>
    )
  }

  const firstName = session?.user?.name?.split(" ")[0] ?? ""
  return (
    <PageHeading>
      {t(greetingBucket(hour), {
        hasName: firstName ? "yes" : "no",
        name: firstName,
      })}
    </PageHeading>
  )
}
