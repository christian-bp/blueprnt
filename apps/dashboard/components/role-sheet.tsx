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
import { DeviationBadge } from "@/components/deviation-badge"
import { useOrganization } from "@/components/org-context"
import { RoleCriterionBreakdown } from "@/components/roles/role-criterion-breakdown"
import { ResponsibilitiesList } from "@/components/roles/responsibilities-list"
import { TrackBadge } from "@/components/track-badge"

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
  const tAssessment = useTranslations("assessment")
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

  // Function and team join into the subtitle, dropping empties so an unset
  // pair never renders as a stray "·" separator.
  const subtitle = role
    ? [role.function, role.team]
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .join(" · ")
    : ""

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
            {/* Title and track sit on one line, matching the role detail
                header. The text-lg override is deliberate: the vendored
                SheetTitle inherits the content's text-sm, too small for the
                primary heading. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <SheetTitle className="text-lg">{role.title}</SheetTitle>
              <TrackBadge
                trackKey={role.trackKey}
                name={role.trackName}
                short
              />
              {/* Band sits with the title once the role is fully evaluated,
                  matching the role page result badge. */}
              {result?.complete && result.band !== null && (
                <Badge>{`${tAssessment("band")} ${result.band}`}</Badge>
              )}
            </div>
            {subtitle.length > 0 ? (
              <SheetDescription>{subtitle}</SheetDescription>
            ) : (
              // Keep a description node for accessibility even when function
              // and team are unset, but render nothing visible.
              <SheetDescription className="sr-only">
                {role.title}
              </SheetDescription>
            )}
            {role.anchorRole !== null && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 text-muted-foreground text-xs">
                  <HugeiconsIcon
                    icon={AnchorIcon}
                    size={12}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  {tBands("anchorLabel")}
                </span>
                {result !== undefined &&
                  result !== null &&
                  result.band !== null &&
                  result.band !== role.anchorRole.expectedBand && (
                    <DeviationBadge agreedBand={role.anchorRole.expectedBand} />
                  )}
              </div>
            )}
          </SheetHeader>

          <div className="flex-1 space-y-6 px-4 pb-4">
            {/* The job profile leads the sheet: it is what the reader came for;
                the evaluation result (band + breakdown) follows below. No
                heading: as the first section, the profile needs no label. */}
            <section className="space-y-4">
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

            {/* Result: weighting + band + breakdown when complete, else progress. */}
            <section className="space-y-3">
              {result === undefined ? (
                <div className="flex justify-center py-4">
                  <Spinner aria-label={t("loading")} />
                </div>
              ) : result?.complete ? (
                // Band now lives in the header; the body carries only the
                // per-criterion contribution breakdown.
                <RoleCriterionBreakdown criteria={result.criteria} />
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
          </div>

          <SheetFooter>
            <Button asChild onClick={onClose}>
              <Link href={`/roles/${role?.slug ?? ""}`}>{t("openRole")}</Link>
            </Button>
          </SheetFooter>
        </>
      )}
    </SheetContent>
  )
}
