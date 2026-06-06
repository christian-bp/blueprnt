"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { OptionCard } from "@/components/option-card"

const INDUSTRIES = [
  "publicSector",
  "manufacturing",
  "consulting",
  "retail",
  "itTelecom",
  "healthcare",
  "finance",
  "realEstateConstruction",
  "other",
] as const

const INDUSTRY_KEYS = {
  publicSector: "industries.publicSector",
  manufacturing: "industries.manufacturing",
  consulting: "industries.consulting",
  retail: "industries.retail",
  itTelecom: "industries.itTelecom",
  healthcare: "industries.healthcare",
  finance: "industries.finance",
  realEstateConstruction: "industries.realEstateConstruction",
  other: "industries.other",
} as const satisfies Record<(typeof INDUSTRIES)[number], string>

// Screen 4: the organization's industry as option cards. The industry shapes
// the families starter set offered on the final onboarding screen.
export function IndustryScreen({
  orgId,
  saved,
  onDone,
}: {
  orgId: string
  saved: string | null
  onDone: () => void
}) {
  const t = useTranslations("dashboard.onboarding.organization")
  const tProfile = useTranslations("dashboard.onboarding.profile")
  const tScreens = useTranslations("dashboard.onboarding.screens")
  const updateSettings = useMutation(
    api.accounts.organization.updateOrganizationSettings
  )
  const [industry, setIndustry] = useState<string>(saved ?? "itTelecom")
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-center font-semibold text-2xl">
        {tScreens("industry.heading")}
      </h1>
      <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
        {INDUSTRIES.map((code) => (
          <OptionCard
            key={code}
            title={tProfile(INDUSTRY_KEYS[code])}
            selected={industry === code}
            onSelect={() => setIndustry(code)}
          />
        ))}
      </div>
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t("error")}
        </p>
      )}
      <Button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setFailed(false)
          try {
            await updateSettings({ orgId, industry })
            onDone()
          } catch {
            setFailed(true)
          } finally {
            setPending(false)
          }
        }}
      >
        {tScreens("continueCta")}
      </Button>
    </div>
  )
}
