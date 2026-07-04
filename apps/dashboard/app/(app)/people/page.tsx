"use client"

import { useTranslations } from "next-intl"
import { PeopleSection } from "@/components/people/people-section"
import { usePageTitle } from "@/hooks/use-page-title"

export default function PeoplePage() {
  const tNav = useTranslations("dashboard.nav")
  usePageTitle(tNav("people"))
  return <PeopleSection />
}
