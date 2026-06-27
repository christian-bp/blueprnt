"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { SubmitButton } from "@/components/submit-button"
import { authClient } from "@/lib/auth-client"
import {
  makeProfileNameSchema,
  type ProfileNameValues,
} from "@/lib/account-schemas"

export function ProfileNameForm() {
  const t = useTranslations("dashboard.account.profile")
  const tv = useTranslations("dashboard.validation")
  const session = authClient.useSession()
  const currentName = session.data?.user.name ?? ""

  const [error, setError] = useState(false)
  const [saved, setSaved] = useState(false)

  const schema = useMemo(() => makeProfileNameSchema(tv), [tv])
  const form = useForm<ProfileNameValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { name: currentName },
  })

  async function onSubmit(values: ProfileNameValues) {
    setError(false)
    setSaved(false)
    try {
      const { error: updateError } = await authClient.updateUser({
        name: values.name,
      })
      if (updateError) {
        setError(true)
        return
      }
      form.reset({ name: values.name })
      setSaved(true)
    } catch {
      setError(true)
    }
  }

  const { isValid, isDirty, isSubmitting } = form.formState

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("nameLabel")}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <SubmitButton
          type="submit"
          isSubmitting={isSubmitting}
          disabled={!isValid || !isDirty}
        >
          {t("saveName")}
        </SubmitButton>
        {saved && (
          <p className="text-muted-foreground text-sm">{t("nameSaved")}</p>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {t("error")}
          </p>
        )}
      </form>
    </Form>
  )
}
