"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  type CountryKey,
  LANGUAGE_BY_COUNTRY,
  countryForLanguage,
} from "@workspace/constants"
import { useMutation, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { CountrySelect } from "@/components/country-select"
import { CurrencySelect } from "@/components/currency-select"
import { IndustrySelect } from "@/components/industry-select"
import { type MembershipRole, orgSettingsSchema } from "@/lib/admin-schemas"

interface AdminUser {
  authId: string
  name: string
  email: string
}

interface AdminOrg {
  orgId: string
  name: string
  slug: string
  country: string | null
  currency: string | null
  language: string | null
  industry: string | null
}

export function ManageOrganizationDialog(props: {
  org: AdminOrg
  users: AdminUser[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { org, users, open, onOpenChange } = props
  const t = useTranslations("dashboard.admin.orgs.manage")
  const members = useQuery(
    api.platform.admin.listOrganizationMembers,
    open ? { orgId: org.orgId } : "skip"
  )
  const addMembership = useMutation(api.platform.admin.addMembership)
  const setRole = useMutation(api.platform.admin.setMembershipRole)
  const removeMembership = useMutation(api.platform.admin.removeMembership)
  const updateOrg = useMutation(api.platform.admin.updateOrganization)

  const [addUserId, setAddUserId] = useState("")
  const [addRole, setAddRole] = useState<MembershipRole>("editor")
  const [country, setCountry] = useState(org.country ?? "")
  const [currency, setCurrency] = useState(org.currency ?? "")
  const [language, setLanguage] = useState(org.language ?? "")
  const [industry, setIndustry] = useState(org.industry ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const memberIds = new Set((members ?? []).map((m) => m.authId))
  const addableUsers = users.filter((u) => !memberIds.has(u.authId))

  async function handleRoleChange(authId: string, value: string) {
    setError(false)
    try {
      await setRole({
        authId,
        orgId: org.orgId,
        role: value as MembershipRole,
      })
    } catch {
      setError(true)
    }
  }

  async function handleRemove(authId: string) {
    setError(false)
    try {
      await removeMembership({ authId, orgId: org.orgId })
    } catch {
      setError(true)
    }
  }

  async function handleAdd() {
    if (addUserId === "") return
    setError(false)
    setBusy(true)
    try {
      await addMembership({
        authId: addUserId,
        orgId: org.orgId,
        role: addRole,
      })
      setAddUserId("")
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveSettings() {
    setError(false)
    const parsed = orgSettingsSchema.safeParse({
      country,
      currency,
      language,
      industry,
    })
    if (!parsed.success) {
      setError(true)
      return
    }
    setBusy(true)
    try {
      await updateOrg({ orgId: org.orgId, ...parsed.data })
    } catch {
      setError(true)
    } finally {
      setBusy(false)
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(m.authId)}
                    >
                      {t("removeCta")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 border-t pt-4">
          <h3 className="font-medium text-sm">{t("addMemberHeading")}</h3>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1 space-y-2">
              <Label>{t("userLabel")}</Label>
              <Select value={addUserId} onValueChange={setAddUserId}>
                <SelectTrigger aria-label={t("userLabel")}>
                  <SelectValue placeholder={t("userPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {addableUsers.map((u) => (
                    <SelectItem key={u.authId} value={u.authId}>
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36 space-y-2">
              <Label>{t("roleLabel")}</Label>
              <Select
                value={addRole}
                onValueChange={(value) => setAddRole(value as MembershipRole)}
              >
                <SelectTrigger aria-label={t("roleLabel")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t("roleAdmin")}</SelectItem>
                  <SelectItem value="editor">{t("roleEditor")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              onClick={handleAdd}
              disabled={addUserId === "" || busy}
            >
              {t("addCta")}
            </Button>
          </div>
        </section>

        <section className="space-y-3 border-t pt-4">
          <h3 className="font-medium text-sm">{t("settingsHeading")}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="org-country">{t("countryLabel")}</Label>
              <CountrySelect
                id="org-country"
                value={country}
                onValueChange={setCountry}
                placeholder={t("countryPlaceholder")}
                aria-label={t("countryLabel")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-currency">{t("currencyLabel")}</Label>
              <CurrencySelect
                id="org-currency"
                value={currency}
                onValueChange={setCurrency}
                placeholder={t("currencyPlaceholder")}
                aria-label={t("currencyLabel")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-language">{t("languageLabel")}</Label>
              <CountrySelect
                id="org-language"
                value={countryForLanguage(language) ?? ""}
                onValueChange={(code) =>
                  setLanguage(LANGUAGE_BY_COUNTRY[code as CountryKey])
                }
                placeholder={t("languagePlaceholder")}
                aria-label={t("languageLabel")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-industry">{t("industryLabel")}</Label>
              <IndustrySelect
                id="org-industry"
                value={industry}
                onValueChange={setIndustry}
                placeholder={t("industryPlaceholder")}
                aria-label={t("industryLabel")}
              />
            </div>
          </div>
        </section>

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
          <Button type="button" onClick={handleSaveSettings} disabled={busy}>
            {t("saveSettings")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
