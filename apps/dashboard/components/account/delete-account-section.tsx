"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@workspace/backend/convex/_generated/api"
import {
  Card,
  CardContent,
  CardDescription,
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
import { Label } from "@workspace/ui/components/label"
import { useAction, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { PasswordInput } from "@/components/password-input"
import { SubmitButton } from "@/components/submit-button"
import { authClient } from "@/lib/auth-client"
import type { ValidationT } from "@/lib/validation"

// Schema factory: password is required; confirm text is a type-to-confirm gate
// that closes over the runtime email. The confirm input is rendered outside
// FormControl (same as DeleteUserDialog) so the field never shows aria-invalid
// while partially typed.
// The refine also requires email !== "" so isValid stays false while the
// account query is still loading (email defaults to ""), preventing an empty
// confirm field from satisfying the gate.
function makeDeleteSchema(tv: ValidationT, email: string) {
  return z.object({
    confirmText: z
      .string()
      .refine(
        (v) => email !== "" && v.trim().toLowerCase() === email.toLowerCase()
      ),
    password: z.string().min(1, tv("required")),
  })
}

type DeleteValues = { confirmText: string; password: string }

type ErrorState = "wrongPassword" | "lastAdmin" | "generic" | null

function isLastAdminError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("errors.lastAdmin")
}

function isWrongPasswordError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("errors.invalidInput")
}

// Danger zone card: renders a type-to-confirm gate (type email) plus a password
// field. If the account is the sole admin of any org, only a support note is
// shown. On success, signs the user out and redirects to /.
export function DeleteAccountSection() {
  const t = useTranslations("dashboard.account.security.delete")
  const tv = useTranslations("dashboard.validation")

  const account = useQuery(api.accounts.account.getMyAccount, {})
  const deleteMyAccount = useAction(api.accounts.account.deleteMyAccount)
  const router = useRouter()

  const [errorState, setErrorState] = useState<ErrorState>(null)
  const confirmInputId = "delete-account-confirm"

  const email = account?.email ?? ""
  const lastAdminOrgs = account?.lastAdminOrgs ?? []

  const schema = useMemo(() => makeDeleteSchema(tv, email), [tv, email])
  const form = useForm<DeleteValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { confirmText: "", password: "" },
  })

  const { isValid, isSubmitting } = form.formState

  // If the user is the last admin of any org, show only the support note.
  if (lastAdminOrgs.length > 0) {
    const orgNames = lastAdminOrgs.map((o) => o.name).join(", ")
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {t("lastAdmin", { orgs: orgNames })}
          </p>
        </CardContent>
      </Card>
    )
  }

  async function onSubmit(values: DeleteValues) {
    setErrorState(null)
    try {
      await deleteMyAccount({ password: values.password })
      await authClient.signOut()
      router.push("/")
    } catch (error) {
      if (isLastAdminError(error)) {
        setErrorState("lastAdmin")
      } else if (isWrongPasswordError(error)) {
        setErrorState("wrongPassword")
      } else {
        setErrorState("generic")
      }
    }
  }

  // When the race condition produces a lastAdmin error on submit, show the note
  // inline in the card (no delete button visible state needed).
  // lastAdminOrgs may still be [] (reactive query hasn't refetched), so fall
  // back to a message without the org list when it is empty.
  if (errorState === "lastAdmin") {
    const orgNames = lastAdminOrgs.map((o) => o.name).join(", ")
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {orgNames
              ? t("lastAdmin", { orgs: orgNames })
              : t("lastAdminUnknown")}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            id="delete-account-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            {/* Type-to-confirm: plain Label + Input, no FormControl, so no
                aria-invalid while partially typed (confirm gate pattern). */}
            <div className="space-y-2">
              <Label htmlFor={confirmInputId}>
                {t("confirmLabel", { email })}
              </Label>
              <Input
                id={confirmInputId}
                autoComplete="off"
                {...form.register("confirmText")}
              />
            </div>
            {/* Password field: routed through FormControl for inline errors. */}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("passwordLabel")}</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <div>
          {(errorState === "wrongPassword" || errorState === "generic") && (
            <p role="alert" className="text-destructive text-sm">
              {t(errorState === "wrongPassword" ? "wrongPassword" : "error")}
            </p>
          )}
        </div>
        <SubmitButton
          type="submit"
          form="delete-account-form"
          variant="destructive"
          isSubmitting={isSubmitting}
          disabled={!isValid || !email}
        >
          {t("cta")}
        </SubmitButton>
      </CardFooter>
    </Card>
  )
}
