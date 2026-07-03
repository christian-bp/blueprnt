"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@workspace/backend/convex/_generated/api"
import {
  type CountryKey,
  countryForLanguage,
  defaultCurrencyFor,
  defaultLanguageFor,
  LANGUAGE_BY_COUNTRY,
} from "@workspace/constants"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
import { toast } from "sonner"
import { CountrySelect } from "@/components/country-select"
import { CurrencySelect } from "@/components/currency-select"
import { HelpMorphButton } from "@/components/help-morph-button"
import { IndustrySelect } from "@/components/industry-select"
import { useOrganization } from "@/components/org-context"
import { SubmitButton } from "@/components/submit-button"
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
    },
  })
  // Destructure so isValid and isDirty are both READ every render (RHF's
  // formState proxy only tracks accessed fields).
  const { isValid, isDirty, isSubmitting } = form.formState

  async function onSubmit(values: OrganizationProfileValues) {
    setError(false)
    try {
      if (values.name !== name) {
        await updateName({ orgId, name: values.name })
      }
      const settingsChanged =
        (values.country ?? "") !== (props.initial.country ?? "") ||
        (values.currency ?? "") !== (props.initial.currency ?? "") ||
        (values.language ?? "") !== (props.initial.language ?? "") ||
        (values.industry ?? "") !== (props.initial.industry ?? "")
      if (settingsChanged) {
        await updateSettings({
          orgId,
          country: values.country || undefined,
          currency: values.currency || undefined,
          language: values.language || undefined,
          industry: values.industry || undefined,
        })
      }
      form.reset(values)
      toast.success(tToast("orgSaved"))
    } catch {
      setError(true)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            id="organization-profile-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("nameLabel")}</FormLabel>
                  <FormControl>
                    <Input className="max-w-sm" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("countryLabel")}</FormLabel>
                    <FormControl>
                      <CountrySelect
                        value={field.value ?? ""}
                        onValueChange={(code) => {
                          // Deriving currency + language from the country mirrors
                          // onboarding's country screen.
                          field.onChange(code)
                          form.setValue("currency", defaultCurrencyFor(code), {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                          form.setValue("language", defaultLanguageFor(code), {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }}
                        placeholder={t("countryPlaceholder")}
                        aria-label={t("countryLabel")}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1">
                      <FormLabel>{t("currencyLabel")}</FormLabel>
                      <HelpMorphButton label={tHelp("orgCurrencyLabel")}>
                        {tHelp("orgCurrencyBody")}
                      </HelpMorphButton>
                    </div>
                    <FormControl>
                      <CurrencySelect
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        placeholder={t("currencyPlaceholder")}
                        aria-label={t("currencyLabel")}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1">
                      <FormLabel>{t("languageLabel")}</FormLabel>
                      <HelpMorphButton label={tHelp("orgLanguageLabel")}>
                        {tHelp("orgLanguageBody")}
                      </HelpMorphButton>
                    </div>
                    <FormControl>
                      <CountrySelect
                        value={countryForLanguage(field.value ?? "") ?? ""}
                        onValueChange={(code) =>
                          field.onChange(
                            LANGUAGE_BY_COUNTRY[code as CountryKey]
                          )
                        }
                        placeholder={t("languagePlaceholder")}
                        aria-label={t("languageLabel")}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("industryLabel")}</FormLabel>
                    <FormControl>
                      <IndustrySelect
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        placeholder={t("industryPlaceholder")}
                        aria-label={t("industryLabel")}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {t("error")}
              </p>
            )}
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-end">
        <SubmitButton
          type="submit"
          form="organization-profile-form"
          isSubmitting={isSubmitting}
          disabled={!isValid || !isDirty}
        >
          {t("save")}
        </SubmitButton>
      </CardFooter>
    </Card>
  )
}
