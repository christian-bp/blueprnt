"use client"

import { AnchorIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"
import { RoleCriterionBreakdown } from "@/components/roles/role-criterion-breakdown"
import { ResponsibilitiesList } from "@/components/roles/responsibilities-list"
import { TrackBadge } from "@/components/track-badge"
import { statusBadgeVariant } from "@/lib/role-status"

interface RoleSheetContextValue {
  openRole: (roleId: string) => void
}

const RoleSheetContext = createContext<RoleSheetContextValue | null>(null)

// Required reader: any surface that must open the sheet.
export function useRoleSheet(): RoleSheetContextValue {
  const value = useContext(RoleSheetContext)
  if (value === null) {
    throw new Error("useRoleSheet must be used inside RoleSheetProvider")
  }
  return value
}

// Optional reader: lets a component (RoleChip) work with or without a provider.
export function useRoleSheetOptional(): RoleSheetContextValue | null {
  return useContext(RoleSheetContext)
}

// Holds the open role and renders the single Sheet. `roleId` persists while the
// sheet animates closed (and after), so the body never blanks mid-slide and
// reopening the same role is instant; `open` alone drives visibility.
export function RoleSheetProvider({ children }: { children: ReactNode }) {
  const [roleId, setRoleId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const openRole = useCallback((id: string) => {
    setRoleId(id)
    setOpen(true)
  }, [])

  return (
    <RoleSheetContext value={{ openRole }}>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        {roleId !== null && (
          <RoleSheetContent roleId={roleId} onClose={() => setOpen(false)} />
        )}
      </Sheet>
    </RoleSheetContext>
  )
}

function RoleSheetContent({
  roleId,
  onClose,
}: {
  roleId: string
  onClose: () => void
}) {
  const t = useTranslations("dashboard.roleSheet")
  const tBands = useTranslations("dashboard.bands")
  const tRoles = useTranslations("dashboard.roles")
  const tDetail = useTranslations("dashboard.roles.detail")
  const tRole = useTranslations("assessment.role")
  const tStatus = useTranslations("assessment.status")
  const tAssessment = useTranslations("assessment")
  const tHelp = useTranslations("dashboard.help")
  const tFamily = useTranslations("dashboard.roles.family")
  const tModel = useTranslations("model")
  const { orgId } = useOrganization()
  const locale = useLocale()
  const role = useQuery(api.assessment.roles.getRole, { orgId, roleId, locale })
  const result = useQuery(api.assessment.results.getRoleResult, {
    orgId,
    roleId,
    locale,
  })

  return (
    <SheetContent className="gap-0 overflow-y-auto">
      {role === undefined ? (
        <>
          <SheetTitle className="sr-only">{t("loading")}</SheetTitle>
          <div className="flex flex-1 items-center justify-center p-6">
            <Spinner aria-label={t("loading")} />
          </div>
        </>
      ) : role === null ? (
        <SheetHeader>
          <SheetTitle>{tDetail("notFound")}</SheetTitle>
        </SheetHeader>
      ) : (
        <>
          <SheetHeader>
            <SheetTitle>{role.title}</SheetTitle>
            <SheetDescription>{`${role.function} · ${role.team}`}</SheetDescription>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant={statusBadgeVariant(role.status)}>
                {tStatus(role.status as "draft" | "inReview" | "approved")}
              </Badge>
              <TrackBadge
                trackKey={role.trackKey}
                name={role.trackName}
                short
              />
              {role.anchorRole !== null && (
                <span className="flex items-center gap-1 text-muted-foreground text-xs">
                  <HugeiconsIcon
                    icon={AnchorIcon}
                    size={12}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  {tBands("anchorLabel")}
                </span>
              )}
              {role.anchorRole !== null &&
                result !== undefined &&
                result !== null &&
                result.band !== null &&
                result.band !== role.anchorRole.expectedBand && (
                  <Badge
                    variant="destructive"
                    title={tBands("deviationLabel", {
                      band: role.anchorRole.expectedBand,
                    })}
                  >
                    {tBands("deviation", {
                      band: role.anchorRole.expectedBand,
                    })}
                  </Badge>
                )}
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-4 pb-4">
            {/* Result: weighting + band + breakdown when complete, else progress. */}
            <section className="space-y-3">
              {result === undefined ? (
                <div className="flex justify-center py-4">
                  <Spinner aria-label={t("loading")} />
                </div>
              ) : result?.complete ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-lg">
                      {`${tAssessment("band")} ${result.band}`}
                    </span>
                    <HelpMorphButton label={tHelp("scoreLabel")}>
                      {tHelp("scoreBody")}
                    </HelpMorphButton>
                  </div>
                  <RoleCriterionBreakdown
                    criteria={result.criteria}
                    variant="compact"
                  />
                </>
              ) : (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">
                    {tRoles("notEvaluated")}
                  </p>
                  <p className="text-muted-foreground text-sm tabular-nums">
                    {t("progress", {
                      rated: role.ratedCount,
                      total: role.totalCriteria,
                    })}
                  </p>
                </div>
              )}
            </section>

            {/* Profile (read-only). */}
            <section className="space-y-4">
              <h3 className="font-medium text-sm">
                {tDetail("profileHeading")}
              </h3>
              {role.purpose.trim().length > 0 && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">
                    {tRole("purpose")}
                  </p>
                  <p className="whitespace-pre-line text-sm">{role.purpose}</p>
                </div>
              )}
              {role.responsibilities.trim().length > 0 && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">
                    {tRole("responsibilities")}
                  </p>
                  <ResponsibilitiesList value={role.responsibilities} />
                </div>
              )}
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">
                  {tModel("roleFamily")}
                </p>
                <p className="text-sm">{role.familyName ?? tFamily("none")}</p>
              </div>
            </section>
          </div>

          <SheetFooter>
            <Button asChild onClick={onClose}>
              <Link href={`/roles/${roleId}`}>{t("openRole")}</Link>
            </Button>
          </SheetFooter>
        </>
      )}
    </SheetContent>
  )
}
