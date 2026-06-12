import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Locale } from "@workspace/i18n/routing"

import { AboutHero } from "@/components/about-hero"
import { AboutStory } from "@/components/about-story"
import { AboutTeam } from "@/components/about-team"
import { AboutCta } from "@/components/about-cta"
import { buildPageMetadata } from "@/lib/page-metadata"

type Props = Readonly<{ params: Promise<{ locale: Locale }> }>

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "web.meta" })
  return buildPageMetadata({
    title: t("aboutTitle"),
    description: t("aboutDescription"),
    locale,
    href: "/about",
  })
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params
  // Enables static rendering; must run before any translation renders.
  setRequestLocale(locale)

  return (
    <>
      <AboutHero />
      <AboutStory />
      <AboutTeam />
      <AboutCta />
    </>
  )
}
