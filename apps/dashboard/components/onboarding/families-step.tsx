"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { ScreenShell } from "@/components/onboarding/screen-shell"
import { isDuplicateFamilyError } from "@/lib/family-error"

interface DraftRole {
  id: number
  title: string
  trackKey: string
  levelKey: string
}

interface DraftFamily {
  id: number
  name: string
  roles: DraftRole[]
}

// Screen 6: rollfamiljer and roller, pre-filled from the industry starter
// (founder decision 2026-06-06). Everything is local state until "create and
// continue"; skip creates nothing. Both paths complete onboarding.
export function FamiliesStep({
  orgId,
  onFinished,
}: {
  orgId: string
  onFinished: () => void
}) {
  const t = useTranslations("dashboard.onboarding.families")
  const tFamily = useTranslations("dashboard.roles.family")
  const tCreate = useTranslations("dashboard.roles.create")
  const tEditor = useTranslations("dashboard.model.editor")
  const tReview = useTranslations("dashboard.model.review")
  const tErrors = useTranslations("errors")
  const locale = useLocale()
  const starter = useQuery(api.assessment.starters.getIndustryStarter, {
    orgId,
    locale,
  })
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  const createStarterSet = useMutation(api.assessment.starters.createStarterSet)
  const completeOnboarding = useMutation(
    api.accounts.organization.completeOnboarding
  )

  const [families, setFamilies] = useState<DraftFamily[] | null>(null)
  const [nextId, setNextId] = useState(0)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<"duplicate" | "generic" | null>(null)

  // Seed the editable list from the starter exactly once (adjust-state-
  // during-render, the established pattern).
  if (families === null && starter !== undefined) {
    let id = 0
    setFamilies(
      starter.families.map((family) => ({
        id: id++,
        name: family.name,
        roles: family.roles.map((role) => ({ id: id++, ...role })),
      }))
    )
    setNextId(id)
  }

  if (families === null || model === undefined || model === null) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={t("heading")} />
      </main>
    )
  }

  const levelOptions = model.tracks.flatMap((track) =>
    track.levels.map((level) => ({
      trackKey: track.key,
      levelKey: level.key,
      label: `${track.key} ${level.name}`,
    }))
  )

  function claimId(): number {
    const id = nextId
    setNextId(id + 1)
    return id
  }

  function updateFamily(familyId: number, patch: Partial<DraftFamily>) {
    setFamilies((current) =>
      (current ?? []).map((family) =>
        family.id === familyId ? { ...family, ...patch } : family
      )
    )
  }

  async function finish() {
    setPending(true)
    setFailure(null)
    try {
      const cleaned = (families ?? [])
        .map((family) => ({
          name: family.name.trim(),
          roles: family.roles
            .map((role) => ({
              title: role.title.trim(),
              trackKey: role.trackKey,
              levelKey: role.levelKey,
            }))
            .filter((role) => role.title !== ""),
        }))
        .filter((family) => family.name !== "")
      if (cleaned.length > 0) {
        await createStarterSet({ orgId, families: cleaned })
      }
      await completeOnboarding({ orgId })
      onFinished()
    } catch (error) {
      setFailure(isDuplicateFamilyError(error) ? "duplicate" : "generic")
      setPending(false)
    }
  }

  return (
    <ScreenShell heading={t("heading")} description={t("description")}>
      <div className="w-full space-y-4">
        {families.map((family) => (
          <Card key={family.id}>
            <CardHeader className="flex flex-row items-center gap-2">
              <Input
                aria-label={tFamily("nameLabel")}
                value={family.name}
                className="max-w-xs font-medium"
                onChange={(event) =>
                  updateFamily(family.id, { name: event.target.value })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto"
                aria-label={t("removeFamilyLabel", { name: family.name })}
                onClick={() =>
                  setFamilies((current) =>
                    (current ?? []).filter((item) => item.id !== family.id)
                  )
                }
              >
                {tEditor("removeCta")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {family.roles.map((role) => (
                <div key={role.id} className="flex items-center gap-2">
                  <Input
                    aria-label={tCreate("titleLabel")}
                    value={role.title}
                    onChange={(event) =>
                      updateFamily(family.id, {
                        roles: family.roles.map((item) =>
                          item.id === role.id
                            ? { ...item, title: event.target.value }
                            : item
                        ),
                      })
                    }
                  />
                  <Select
                    value={role.levelKey}
                    onValueChange={(levelKey) => {
                      const option = levelOptions.find(
                        (item) => item.levelKey === levelKey
                      )
                      if (option === undefined) return
                      updateFamily(family.id, {
                        roles: family.roles.map((item) =>
                          item.id === role.id
                            ? {
                                ...item,
                                levelKey: option.levelKey,
                                trackKey: option.trackKey,
                              }
                            : item
                        ),
                      })
                    }}
                  >
                    <SelectTrigger size="sm" className="w-36 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {levelOptions.map((option) => (
                        <SelectItem
                          key={option.levelKey}
                          value={option.levelKey}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={t("removeRoleLabel", { title: role.title })}
                    onClick={() =>
                      updateFamily(family.id, {
                        roles: family.roles.filter(
                          (item) => item.id !== role.id
                        ),
                      })
                    }
                  >
                    {tEditor("removeCta")}
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  updateFamily(family.id, {
                    roles: [
                      ...family.roles,
                      {
                        id: claimId(),
                        title: "",
                        trackKey: "IC",
                        levelKey: "IC1",
                      },
                    ],
                  })
                }
              >
                {t("addRoleCta")}
              </Button>
            </CardContent>
          </Card>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setFamilies((current) => [
              ...(current ?? []),
              { id: claimId(), name: "", roles: [] },
            ])
          }
        >
          {t("addFamilyCta")}
        </Button>
      </div>
      {failure !== null && (
        <p role="alert" className="text-destructive text-sm">
          {failure === "duplicate" ? tErrors("roleFamilyExists") : t("error")}
        </p>
      )}
      {/* The final step cannot be skipped: emptying the list and finishing
          is the explicit way to start without families. */}
      <div className="flex w-full items-center justify-end">
        <Button type="button" disabled={pending} onClick={() => finish()}>
          {families.length === 0 ? tReview("cta") : t("createCta")}
          <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} aria-hidden="true" />
        </Button>
      </div>
    </ScreenShell>
  )
}
