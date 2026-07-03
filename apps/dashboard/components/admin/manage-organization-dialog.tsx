"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { MoreVerticalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import {
  type CountryKey,
  countryForLanguage,
  LANGUAGE_BY_COUNTRY,
} from "@workspace/constants"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@workspace/ui/components/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useMutation, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { CountrySelect } from "@/components/country-select"
import { CurrencySelect } from "@/components/currency-select"
import { IndustrySelect } from "@/components/industry-select"
import { SubmitButton } from "@/components/submit-button"
import {
  type MembershipRole,
  type OrgSettingsValues,
  orgSettingsSchema,
} from "@/lib/admin-schemas"

interface AdminOrg {
  orgId: string
  name: string
  slug: string
  country: string | null
  currency: string | null
  language: string | null
  industry: string | null
}

const SETTINGS_FORM_ID = "org-settings-form"

export function ManageOrganizationDialog(props: {
  org: AdminOrg
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { org, open, onOpenChange } = props
  const t = useTranslations("dashboard.admin.orgs.manage")
  const tToast = useTranslations("dashboard.toast")
  const members = useQuery(
    api.platform.admin.listOrganizationMembers,
    open ? { orgId: org.orgId } : "skip"
  )
  const setRole = useMutation(api.platform.admin.setMembershipRole)
  const removeMembership = useMutation(api.platform.admin.removeMembership)
  const updateOrg = useMutation(api.platform.admin.updateOrganization)

  const [error, setError] = useState(false)

  // The settings fields are all optional (no per-field messages), so the form
  // exists for state + a single submit; the org settings schema stays a plain
  // static schema.
  const form = useForm<OrgSettingsValues>({
    resolver: zodResolver(orgSettingsSchema),
    mode: "onTouched",
    defaultValues: {
      country: org.country ?? "",
      currency: org.currency ?? "",
      language: org.language ?? "",
      industry: org.industry ?? "",
    },
  })
  // Destructure so isValid and isDirty are both READ every render (RHF's
  // formState proxy only tracks accessed fields; a short-circuiting
  // `!isValid || !isDirty` would never read isDirty).
  const { isValid, isDirty, isSubmitting } = form.formState

  async function handleRoleChange(authId: string, value: string) {
    setError(false)
    try {
      await setRole({
        authId,
        orgId: org.orgId,
        role: value as MembershipRole,
      })
      toast.success(tToast("membershipUpdated"))
    } catch {
      setError(true)
    }
  }

  async function handleRemove(authId: string) {
    setError(false)
    try {
      await removeMembership({ authId, orgId: org.orgId })
      toast.success(tToast("membershipRemoved"))
    } catch {
      setError(true)
    }
  }

  async function onSubmitSettings(values: OrgSettingsValues) {
    setError(false)
    try {
      await updateOrg({ orgId: org.orgId, ...values })
      toast.success(tToast("orgSaved"))
    } catch {
      setError(true)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title", { name: org.name })}</DialogTitle>
          <DialogDescription>{org.slug}</DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <h3 className="font-medium text-sm">{t("membersHeading")}</h3>
          {members !== undefined && members.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noMembers")}</p>
          ) : (
            <ul className="space-y-2">
              {(members ?? []).map((m) => (
                <li
                  key={m.authId}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="min-w-0 truncate text-sm">
                    {m.name}{" "}
                    <span className="text-muted-foreground">{m.email}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <Select
                      value={m.role}
                      onValueChange={(value) =>
                        handleRoleChange(m.authId, value)
                      }
                    >
                      <SelectTrigger
                        className="w-32"
                        aria-label={t("roleLabel")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">{t("roleAdmin")}</SelectItem>
                        <SelectItem value="editor">
                          {t("roleEditor")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t("memberActions", { name: m.name })}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <HugeiconsIcon
                            icon={MoreVerticalIcon}
                            strokeWidth={2}
                          />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => handleRemove(m.authId)}
                        >
                          {t("removeCta")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Form {...form}>
          <form
            id={SETTINGS_FORM_ID}
            onSubmit={form.handleSubmit(onSubmitSettings)}
            className="space-y-3 border-t pt-4"
          >
            <h3 className="font-medium text-sm">{t("settingsHeading")}</h3>
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
                        onValueChange={field.onChange}
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
                    <FormLabel>{t("currencyLabel")}</FormLabel>
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
                    <FormLabel>{t("languageLabel")}</FormLabel>
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
          </form>
        </Form>

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {t("error")}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("close")}
          </Button>
          <SubmitButton
            type="submit"
            form={SETTINGS_FORM_ID}
            isSubmitting={isSubmitting}
            // Pre-filled settings form: also require a change, so opening it and
            // pressing Save cannot fire a no-op updateOrganization (which would
            // still write an audit row).
            disabled={!isValid || !isDirty}
          >
            {t("saveSettings")}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
