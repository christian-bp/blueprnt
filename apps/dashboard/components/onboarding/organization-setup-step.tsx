"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { useSetPreviewLocale } from "@/components/locale-provider"
import { authClient } from "@/lib/auth-client"
import { type SupportedLocale, detectBrowserLocale } from "@/lib/locale"
import { organizationSlug } from "@/lib/slug"

const LANGUAGES = ["sv", "en", "nb", "da", "fi"] as const
const COUNTRIES = ["se", "no", "dk", "fi", "other"] as const
const CURRENCIES = ["SEK", "NOK", "DKK", "EUR"] as const
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

// Literal-keyed maps for typed i18n: template strings like t(`languages.${code}`)
// do not satisfy the typed key union. Use these maps with t(LANGUAGE_KEYS[code]).
const LANGUAGE_KEYS = {
  sv: "languages.sv",
  en: "languages.en",
  nb: "languages.nb",
  da: "languages.da",
  fi: "languages.fi",
} as const satisfies Record<(typeof LANGUAGES)[number], string>

const COUNTRY_KEYS = {
  se: "countries.se",
  no: "countries.no",
  dk: "countries.dk",
  fi: "countries.fi",
  other: "countries.other",
} as const satisfies Record<(typeof COUNTRIES)[number], string>

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

// Merged onboarding step 1: organization + company profile on one screen. Five
// fields: organization name, default language, country, currency, and industry.
// Country and industry shape the defaults of the evaluation model; employee
// count is no longer asked (derived automatically in V2 from imported
// employees, decided 2026-06-05). Stored country codes are lowercase ISO-3166
// alpha-2 ("se", "no", ...).
//
// Create mode (existing is null): create the Better Auth organization, then
// write the full settings in one updateOrganizationSettings call. The creator
// becomes admin (creatorRole in auth.ts) and the onOrganizationCreate trigger
// seeds the empty organization settings row. updateOrganizationSettings is an
// upsert, so the settings write is race-safe even before the trigger commits.
// On success the reactive status query flips settingsComplete and the wizard
// advances to the model step. If the org is created but the settings write
// throws, the error is shown; on the next render the wizard passes a non-null
// existing (the org now resolves in status.organization), landing the user in
// existing-mode update.
//
// Existing mode (existing set): an organization already exists (fresh-create retry,
// or a revisit from the model step). The name input is prefilled with the
// current org name and the language and settings selects are seeded from the
// saved settings. Saving renames the org only when the name changed, writes the
// full settings, then calls onDone to hand control back to the wizard.
export function OrganizationSetupStep({
  existing,
  onDone,
}: {
  existing: { orgId: string; name: string } | null
  onDone?: () => void
}) {
  const t = useTranslations("dashboard.onboarding.organization")
  const tProfile = useTranslations("dashboard.onboarding.profile")
  const setPreviewLocale = useSetPreviewLocale()
  const updateSettings = useMutation(
    api.accounts.organization.updateOrganizationSettings
  )
  // Prefill from the saved settings in existing mode; skip the query in create
  // mode (no org exists yet).
  const settings = useQuery(
    api.accounts.organization.getOrganizationSettings,
    existing ? { orgId: existing.orgId } : "skip"
  )
  const [name, setName] = useState(existing?.name ?? "")

  // In create mode, derive the initial language from the browser locale so the
  // select and the rendered page always agree on first paint. The active UI
  // locale (from NextIntlClientProvider) is the fallback when the browser
  // language is unsupported.
  const activeLocale = useLocale()
  const [language, setLanguage] = useState<string>(() =>
    existing ? "sv" : detectBrowserLocale(activeLocale as SupportedLocale)
  )
  const [country, setCountry] = useState<string>("se")
  const [currency, setCurrency] = useState<string>("SEK")
  const [industry, setIndustry] = useState<string>("itTelecom")

  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  // Seed the language and settings selects from the saved settings the first
  // render it arrives, adjusting state during render rather than in an effect.
  // Keyed on data arrival so a user change is never overwritten. Null fields
  // keep the current defaults; language falls back to "sv".
  const [seededFor, setSeededFor] = useState<string | null>(null)
  if (existing && settings !== undefined && seededFor !== existing.orgId) {
    setSeededFor(existing.orgId)
    setLanguage(settings?.language ?? "sv")
    if (settings?.country) setCountry(settings.country)
    if (settings?.currency) setCurrency(settings.currency)
    if (settings?.industry) setIndustry(settings.industry)
  }

  // In create mode only: if the detected browser locale differs from the active
  // UI locale, call setPreviewLocale so the page immediately renders in the
  // same language the select shows. The select and the page must never disagree
  // from the first paint of step 1. Empty dependency array is intentional: this
  // must fire exactly once on mount. The select's onValueChange keeps the page
  // and the select in sync after any user interaction.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    if (existing) return
    if (language !== activeLocale) {
      setPreviewLocale(language)
    }
  }, [])

  return (
    <form
      className="space-y-6"
      onSubmit={async (event) => {
        event.preventDefault()
        setPending(true)
        setFailed(false)
        if (existing) {
          // Existing mode: rename the org only if the name actually changed,
          // then persist the full settings, then hand control back to the
          // wizard.
          try {
            const trimmed = name.trim()
            if (trimmed !== existing.name) {
              const { error } = await authClient.organization.update({
                organizationId: existing.orgId,
                data: { name: trimmed },
              })
              if (error) {
                setFailed(true)
                setPending(false)
                return
              }
            }
            await updateSettings({
              orgId: existing.orgId,
              language,
              country,
              currency,
              industry,
            })
            onDone?.()
          } catch {
            setFailed(true)
            setPending(false)
          }
          return
        }
        try {
          const { data, error } = await authClient.organization.create({
            name: name.trim(),
            slug: organizationSlug(name),
          })
          if (error || !data) {
            setFailed(true)
            setPending(false)
            return
          }
          // Write the full settings immediately after create. The upsert in
          // updateOrganizationSettings makes this race-safe.
          try {
            await updateSettings({
              orgId: data.id,
              language,
              country,
              currency,
              industry,
            })
          } catch {
            // The org exists at this point. Surface the error; on retry the
            // wizard re-renders this step with a non-null existing (the org now
            // resolves in status.organization), landing in existing-mode update.
            setFailed(true)
            setPending(false)
          }
          // On success the status query flips reactively; no navigation needed.
        } catch {
          setFailed(true)
          setPending(false)
        }
      }}
    >
      <div className="space-y-2">
        <h2 className="font-medium text-lg">{t("heading")}</h2>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>

      {/* Name and language share the first row; country and currency share the
          second; industry spans the full third row to balance the layout. */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="organization-name">{t("nameLabel")}</Label>
          <Input
            id="organization-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("namePlaceholder")}
            required
            minLength={2}
          />
        </div>
        <div className="space-y-2">
          <Label id="organization-language-label">{t("languageLabel")}</Label>
          <Select
            value={language}
            onValueChange={(value) => {
              setLanguage(value)
              setPreviewLocale(value)
            }}
          >
            <SelectTrigger aria-labelledby="organization-language-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((code) => (
                <SelectItem key={code} value={code}>
                  {t(LANGUAGE_KEYS[code])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label id="country-label">{tProfile("country")}</Label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger aria-labelledby="country-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((code) => (
                <SelectItem key={code} value={code}>
                  {tProfile(COUNTRY_KEYS[code])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label id="currency-label">{tProfile("currency")}</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger aria-labelledby="currency-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label id="industry-label">{tProfile("industry")}</Label>
          <Select value={industry} onValueChange={setIndustry}>
            <SelectTrigger aria-labelledby="industry-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((code) => (
                <SelectItem key={code} value={code}>
                  {tProfile(INDUSTRY_KEYS[code])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t("error")}
        </p>
      )}
      <Button type="submit" disabled={pending || name.trim().length < 2}>
        {existing ? t("saveCta") : t("cta")}
      </Button>
    </form>
  )
}
