"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@workspace/backend/convex/_generated/api"
import {
  defaultCurrencyFor,
  defaultFullTimeHoursFor,
  defaultLanguageFor,
  FULL_TIME_HOURS_MAX,
} from "@workspace/constants"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "@/lib/toast"
import { newGestureId } from "@/lib/gesture"
import { CountrySelect } from "@/components/country-select"
import { CurrencySelect } from "@/components/currency-select"
import { HelpMorphButton } from "@/components/help-morph-button"
import { IndustrySelect } from "@/components/industry-select"
import { NumberInput } from "@/components/number-input"
import { useOrganization } from "@/components/org-context"
import { SubmitButton } from "@/components/submit-button"
import { LanguageSelect } from "@/components/language-select"
import { numberInputField } from "@/lib/number-field"
import { SettingsFrame, SettingsRow } from "@/components/settings-frame"
import {
  makeOrganizationProfileSchema,
  type OrganizationProfileValues,
} from "@/lib/organization-schemas"

// The org profile edit form: name (Better Auth org record) + the mirror
// settings (country/currency/language/industry). Pre-filled and gated on
// isValid && isDirty so an unchanged save cannot fire a no-op (which would still
// write an audit row). Name and settings persist through separate mutations,
// called only when their slice actually changed.
export function OrganizationProfileForm(props: {
  initial: {
    country: string | null
    currency: string | null
    language: string | null
    industry: string | null
    fullTimeHoursPerMonth: number
  }
}) {
  const t = useTranslations("dashboard.organization.general")
  const tv = useTranslations("dashboard.validation")
  const tHelp = useTranslations("dashboard.help")
  const tToast = useTranslations("dashboard.toast")
  const { orgId, name } = useOrganization()
  const updateName = useMutation(
    api.accounts.organization.updateOrganizationName
  )
  const updateSettings = useMutation(
    api.accounts.organization.updateOrganizationSettings
  )

  const [error, setError] = useState(false)

  const schema = useMemo(() => makeOrganizationProfileSchema(tv), [tv])
  const form = useForm<OrganizationProfileValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      name,
      country: props.initial.country ?? "",
      currency: props.initial.currency ?? "",
      language: props.initial.language ?? "",
      industry: props.initial.industry ?? "",
      fullTimeHoursPerMonth: props.initial.fullTimeHoursPerMonth,
    },
  })
  // Destructure so isValid and isDirty are both READ every render (RHF's
  // formState proxy only tracks accessed fields).
  const { isValid, isDirty, isSubmitting } = form.formState

  async function onSubmit(values: OrganizationProfileValues) {
    setError(false)
    // One Save can change the name and the settings, which are two mutations
    // and therefore two audit rows; one gesture id keeps them one story.
    const gestureId = newGestureId()
    try {
      if (values.name !== name) {
        await updateName({ orgId, gestureId, name: values.name })
      }
      const settingsChanged =
        (values.country ?? "") !== (props.initial.country ?? "") ||
        (values.currency ?? "") !== (props.initial.currency ?? "") ||
        (values.language ?? "") !== (props.initial.language ?? "") ||
        (values.industry ?? "") !== (props.initial.industry ?? "") ||
        values.fullTimeHoursPerMonth !== props.initial.fullTimeHoursPerMonth
      if (settingsChanged) {
        await updateSettings({
          orgId,
          gestureId,
          country: values.country || undefined,
          currency: values.currency || undefined,
          language: values.language || undefined,
          industry: values.industry || undefined,
          fullTimeHoursPerMonth: values.fullTimeHoursPerMonth,
        })
      }
      form.reset(values)
      toast.success(tToast("orgSaved"))
    } catch {
      setError(true)
    }
  }

  return (
    <SettingsFrame
      title={t("title")}
      footer={
        <SubmitButton
          type="submit"
          form="organization-profile-form"
          isSubmitting={isSubmitting}
          disabled={!isValid || !isDirty}
        >
          {t("save")}
        </SubmitButton>
      }
    >
      <Form {...form}>
        <form
          id="organization-profile-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col divide-y divide-border"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <SettingsRow label={<FormLabel>{t("nameLabel")}</FormLabel>}>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </SettingsRow>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <SettingsRow
                  align="center"
                  label={<FormLabel>{t("countryLabel")}</FormLabel>}
                >
                  <FormControl>
                    <CountrySelect
                      value={field.value ?? ""}
                      onValueChange={(code) => {
                        // Deriving currency, language, and full-time hours
                        // from the country mirrors onboarding's country
                        // screen; the hours stay editable afterward.
                        field.onChange(code)
                        form.setValue("currency", defaultCurrencyFor(code), {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                        form.setValue("language", defaultLanguageFor(code), {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                        form.setValue(
                          "fullTimeHoursPerMonth",
                          defaultFullTimeHoursFor(code),
                          { shouldDirty: true, shouldValidate: true }
                        )
                      }}
                      placeholder={t("countryPlaceholder")}
                      aria-label={t("countryLabel")}
                    />
                  </FormControl>
                </SettingsRow>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <SettingsRow
                  align="center"
                  label={
                    <span className="flex items-center gap-1">
                      <FormLabel>{t("currencyLabel")}</FormLabel>
                      <HelpMorphButton label={tHelp("orgCurrencyLabel")}>
                        {tHelp("orgCurrencyBody")}
                      </HelpMorphButton>
                    </span>
                  }
                >
                  <FormControl>
                    <CurrencySelect
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      placeholder={t("currencyPlaceholder")}
                      aria-label={t("currencyLabel")}
                    />
                  </FormControl>
                </SettingsRow>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fullTimeHoursPerMonth"
            render={({ field }) => (
              <FormItem>
                <SettingsRow
                  align="center"
                  label={
                    <span className="flex items-center gap-1">
                      <FormLabel>{t("fullTimeHoursLabel")}</FormLabel>
                      <HelpMorphButton label={tHelp("fullTimeHoursLabel")}>
                        {tHelp("fullTimeHoursBody")}
                      </HelpMorphButton>
                    </span>
                  }
                >
                  <FormControl>
                    <NumberInput
                      step="0.01"
                      min={0}
                      max={FULL_TIME_HOURS_MAX}
                      aria-label={t("fullTimeHoursLabel")}
                      {...numberInputField(field)}
                    />
                  </FormControl>
                  <FormMessage />
                </SettingsRow>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="language"
            render={({ field }) => (
              <FormItem>
                <SettingsRow
                  align="center"
                  label={
                    <span className="flex items-center gap-1">
                      <FormLabel>{t("languageLabel")}</FormLabel>
                      <HelpMorphButton label={tHelp("orgLanguageLabel")}>
                        {tHelp("orgLanguageBody")}
                      </HelpMorphButton>
                    </span>
                  }
                >
                  <FormControl>
                    <LanguageSelect
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      placeholder={t("languagePlaceholder")}
                      ariaLabel={t("languageLabel")}
                      className="w-full"
                    />
                  </FormControl>
                </SettingsRow>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="industry"
            render={({ field }) => (
              <FormItem>
                <SettingsRow
                  align="center"
                  label={<FormLabel>{t("industryLabel")}</FormLabel>}
                >
                  <FormControl>
                    <IndustrySelect
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      placeholder={t("industryPlaceholder")}
                      aria-label={t("industryLabel")}
                    />
                  </FormControl>
                </SettingsRow>
              </FormItem>
            )}
          />
          {error && (
            <p role="alert" className="px-5 py-3 text-destructive text-sm">
              {t("error")}
            </p>
          )}
        </form>
      </Form>
    </SettingsFrame>
  )
}
