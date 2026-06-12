import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import type { Locale } from "@workspace/i18n/routing"

import { ContactCta } from "@/components/contact-cta"
import { HowSteps } from "@/components/how-steps"
import { buildPageMetadata } from "@/lib/page-metadata"

type Props = Readonly<{ params: Promise<{ locale: Locale }> }>

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "web.meta" })
  return buildPageMetadata({
    title: t("howTitle"),
    description: t("howDescription"),
    locale,
    href: "/how-it-works",
  })
}

export default async function HowItWorksPage({ params }: Props) {
  const { locale } = await params
  // Enables static rendering; must run before any translation renders.
  setRequestLocale(locale)

  return (
    <>
      <HowSteps />
      <ContactCta />
    </>
  )
}
