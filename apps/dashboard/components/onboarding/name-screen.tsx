"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@workspace/ui/components/form"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { NextButton } from "@/components/onboarding/next-button"
import { OnboardingInput } from "@/components/onboarding/onboarding-input"
import { ScreenShell } from "@/components/screen-shell"
import { authClient } from "@/lib/auth-client"
import { makeOrgNameSchema, type OrgNameValues } from "@/lib/onboarding-schemas"
import { organizationSlug } from "@/lib/slug"

// Screen 1: the organization name. Create mode (existing null) creates the
// Better Auth organization on continue (creator becomes admin; the
// onOrganizationCreate trigger seeds the settings row). The UI language
// already follows the browser (LocaleProvider falls back to it), and the
// organization's persisted language derives from the country pick on the
// next screen. Revisit mode prefills and renames only when the name
// actually changed.
export function NameScreen({
  existing,
  onAdvance,
}: {
  existing: { orgId: string; name: string } | null
  onAdvance: () => void
}) {
  const t = useTranslations("dashboard.onboarding.organization")
  const tScreens = useTranslations("dashboard.onboarding.screens")
  const tv = useTranslations("dashboard.validation")
  const [failed, setFailed] = useState(false)

  const schema = useMemo(() => makeOrgNameSchema(tv), [tv])
  const form = useForm<OrgNameValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { name: existing?.name ?? "" },
  })

  async function onValid(values: OrgNameValues) {
    // The schema already trimmed the name.
    const name = values.name
    setFailed(false)
    try {
      if (existing) {
        if (name !== existing.name) {
          const { error } = await authClient.organization.update({
            organizationId: existing.orgId,
            data: { name },
          })
          if (error) {
            setFailed(true)
            return
          }
        }
        onAdvance()
        return
      }
      const { data, error } = await authClient.organization.create({
        name,
        slug: organizationSlug(name),
      })
      if (error || !data) {
        setFailed(true)
        return
      }
      onAdvance()
    } catch {
      setFailed(true)
    }
  }

  return (
    <ScreenShell heading={tScreens("name.heading")}>
      <Form {...form}>
        <form
          className="flex w-full flex-col items-center gap-6"
          onSubmit={form.handleSubmit(onValid)}
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="flex w-full max-w-sm flex-col">
                <FormControl>
                  <OnboardingInput
                    aria-label={t("nameLabel")}
                    placeholder={t("namePlaceholder")}
                    className="text-center"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-center" />
              </FormItem>
            )}
          />
          <NextButton
            type="submit"
            disabled={!form.formState.isValid || form.formState.isSubmitting}
          />
          {failed && (
            <p role="alert" className="text-destructive text-sm">
              {t("error")}
            </p>
          )}
        </form>
      </Form>
    </ScreenShell>
  )
}
