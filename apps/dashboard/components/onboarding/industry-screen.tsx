"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { INDUSTRY_KEYS, type IndustryKey } from "@workspace/constants"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { OptionCard } from "@/components/option-card"
import { ScreenShell } from "@/components/onboarding/screen-shell"
import { useAutoAdvance } from "@/hooks/use-auto-advance"

// The industry list lives in @workspace/constants; it also keys the starter
// sets in the backend, so the cards and the starters never drift apart.
const INDUSTRY_LABEL_KEYS = {
  publicSector: "industries.publicSector",
  manufacturing: "industries.manufacturing",
  consulting: "industries.consulting",
  retail: "industries.retail",
  itTelecom: "industries.itTelecom",
  healthcare: "industries.healthcare",
  finance: "industries.finance",
  realEstateConstruction: "industries.realEstateConstruction",
  other: "industries.other",
} as const satisfies Record<IndustryKey, string>

// Screen 4: the organization's industry as option cards. Picking one persists
// it and auto-advances once the other cards have faded. The industry shapes
// the families starter set offered on the final onboarding screen.
export function IndustryScreen({
  orgId,
  saved,
  onAdvance,
}: {
  orgId: string
  saved: string | null
  onAdvance: () => void
}) {
  const t = useTranslations("dashboard.onboarding.organization")
  const tProfile = useTranslations("dashboard.onboarding.profile")
  const tScreens = useTranslations("dashboard.onboarding.screens")
  const updateSettings = useMutation(
    api.accounts.organization.updateOrganizationSettings
  )
  const { chosen, picked, failed, choose } = useAutoAdvance({
    persist: (code) => updateSettings({ orgId, industry: code }),
    onAdvance,
  })
  // Fresh flow marks nothing; a revisit marks the saved industry. picked
  // survives a failed save so the choice stays marked next to the alert.
  const marked = picked ?? saved

  return (
    <ScreenShell heading={tScreens("industry.heading")}>
      <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
        {INDUSTRY_KEYS.map((code) => (
          <OptionCard
            key={code}
            title={tProfile(INDUSTRY_LABEL_KEYS[code])}
            selected={marked === code}
            faded={chosen !== null && chosen !== code}
            onSelect={() => choose(code)}
          />
        ))}
      </div>
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t("error")}
        </p>
      )}
    </ScreenShell>
  )
}
