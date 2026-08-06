"use client"

import { useTranslations } from "next-intl"
import { PeopleSection } from "@/components/people/people-section"
import { usePageTitle } from "@/hooks/use-page-title"

export default function PeoplePage() {
  // The browser title is the page's own name (the Directory sub-page), not
  // the section's, matching the sidebar sub-menu and the header tab.
  const tTabs = useTranslations("dashboard.people.tabs")
  usePageTitle(tTabs("people"))
  return <PeopleSection />
}
