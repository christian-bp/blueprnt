"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { TRACK_LEVELS } from "@workspace/constants"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { TableSkeleton } from "@/components/table-skeleton"

// ---------------------------------------------------------------------------
// Types (structural subsets of the Convex return shapes; Convex ids are
// strings at the JS layer so we use string throughout to keep this component
// fixture-testable without importing generated Convex types).
// ---------------------------------------------------------------------------

export interface ClassifyPersonRow {
  personId: string
  displayName: string
  externalRef: string | null
  employmentStartDate: string | null
  isManager: boolean | null
  suggestedLevel: string | null
  currentAssignment: {
    roleId: string
    level: string
    levelSource: "suggested" | "confirmed"
  } | null
}

export interface ClassifyTitleGroup {
  title: string | null
  personCount: number
  suggestedRoleId: string | null
  confidence: "high" | "medium" | "unmatched"
  people: ClassifyPersonRow[]
}

export interface ClassifyRole {
  roleId: string
  title: string
  trackKey: string
}

export interface ClassifyTrack {
  key: string
  name: string
  order: number
}

// ---------------------------------------------------------------------------
// Pure helper: exported so tests can exercise it without DOM.
// ---------------------------------------------------------------------------

// Derives the classification state for a group of people from their current
// assignments. Confirmed iff every person has a confirmed assignment; unclassified
// iff no person has any assignment; pending otherwise (mixed or all suggested).
export function classificationStateForPeople(
  people: Array<{
    currentAssignment: { levelSource: "suggested" | "confirmed" } | null
  }>
): "confirmed" | "pending" | "unclassified" {
  if (people.length === 0) return "unclassified"
  const hasAny = people.some((p) => p.currentAssignment !== null)
  if (!hasAny) return "unclassified"
  const allConfirmed = people.every(
    (p) => p.currentAssignment?.levelSource === "confirmed"
  )
  return allConfirmed ? "confirmed" : "pending"
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// Stable row key: never use the possibly-null title as a Map/React key.
function rowKey(group: ClassifyTitleGroup): string {
  return group.title ?? "__no_title__"
}

// The first (lowest) valid level for a role's track, used as a fallback when
// the engine gave no per-person level. Guarantees a level that passes the
// backend's isValidLevelForTrack check.
function defaultLevelFor(
  roleId: string,
  roleById: Map<string, ClassifyRole>
): string {
  const role = roleById.get(roleId)
  if (role === undefined) return ""
  const levels = TRACK_LEVELS[role.trackKey as keyof typeof TRACK_LEVELS] ?? []
  return levels[0] ?? ""
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClassifyTitleTable({
  orgId,
  groups,
  roles,
  // pseudonymize will be used in Task 7 when per-person rows are expanded
  pseudonymize: _pseudonymize,
}: {
  orgId: string
  groups: ClassifyTitleGroup[]
  roles: ClassifyRole[]
  tracks: ClassifyTrack[]
  pseudonymize: boolean
}) {
  const t = useTranslations("dashboard.classify")
  const tToast = useTranslations("dashboard.toast")

  // Per-row selected role: keyed by rowKey(group) (never null)
  const [selectedRole, setSelectedRole] = useState<Map<string, string | null>>(
    () => new Map()
  )

  const confirm = useMutation(api.people.assignments.assignPersonToRole)

  const roleById = new Map<string, ClassifyRole>(
    roles.map((r) => [r.roleId, r])
  )

  async function onConfirm(group: ClassifyTitleGroup) {
    const key = rowKey(group)
    const roleId = selectedRole.get(key) ?? group.suggestedRoleId
    if (roleId === null) return

    for (const p of group.people) {
      await confirm({
        orgId,
        personId: p.personId as Parameters<typeof confirm>[0]["personId"],
        roleId: roleId as Parameters<typeof confirm>[0]["roleId"],
        level: p.suggestedLevel ?? defaultLevelFor(roleId, roleById),
        levelSource: "confirmed",
      })
    }
    toast.success(tToast("classificationConfirmed"))
  }

  function confidenceVariant(
    confidence: ClassifyTitleGroup["confidence"]
  ): "default" | "secondary" | "outline" {
    if (confidence === "high") return "default"
    if (confidence === "medium") return "secondary"
    return "outline"
  }

  function stateVariant(
    state: "confirmed" | "pending" | "unclassified"
  ): "default" | "secondary" | "outline" {
    if (state === "confirmed") return "default"
    if (state === "pending") return "secondary"
    return "outline"
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("columns.title")}</TableHead>
          <TableHead>{t("columns.people")}</TableHead>
          <TableHead>{t("columns.suggestedRole")}</TableHead>
          <TableHead>{t("columns.confidence")}</TableHead>
          <TableHead>{t("columns.state")}</TableHead>
          <TableHead>{t("columns.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => {
          const key = rowKey(group)
          const state = classificationStateForPeople(group.people)
          const currentRoleId = selectedRole.get(key) ?? group.suggestedRoleId

          return (
            <TableRow key={key}>
              <TableCell className="font-medium">
                {group.title !== null ? group.title : t("noTitle")}
              </TableCell>
              <TableCell>{group.personCount}</TableCell>
              <TableCell>
                <Select
                  value={currentRoleId ?? ""}
                  onValueChange={(value) =>
                    setSelectedRole((prev) => {
                      const next = new Map(prev)
                      next.set(key, value || null)
                      return next
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectRolePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.roleId} value={r.roleId}>
                        {r.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Badge variant={confidenceVariant(group.confidence)}>
                  {t(`confidence.${group.confidence}`)}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={stateVariant(state)}>
                  {t(`state.${state}`)}
                </Badge>
              </TableCell>
              <TableCell>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void onConfirm(group)}
                >
                  {t("assignCta")}
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

// Re-export for use in page.tsx (avoids an extra import path)
export { TableSkeleton }
