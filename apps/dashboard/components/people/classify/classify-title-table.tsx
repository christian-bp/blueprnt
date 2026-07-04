"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { TRACK_LEVELS, isValidLevelForTrack } from "@workspace/constants"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
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
import { cn } from "@workspace/ui/lib/utils"
import { useMutation } from "convex/react"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SPRING } from "@/lib/motion"
import { ClassifyPersonRows } from "./classify-person-rows"

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

// Build a fresh per-person level Map for a group using the new track's
// default, resetting any stale levels from a previous track.
function buildDefaultLevels(
  people: ClassifyPersonRow[],
  trackKey: string
): Map<string, string> {
  const levels = TRACK_LEVELS[trackKey as keyof typeof TRACK_LEVELS] ?? []
  const first = levels[0] ?? ""
  const result = new Map<string, string>()
  for (const p of people) {
    const level =
      p.suggestedLevel !== null &&
      isValidLevelForTrack(trackKey, p.suggestedLevel)
        ? p.suggestedLevel
        : first
    result.set(p.personId, level)
  }
  return result
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClassifyTitleTable({
  orgId,
  groups,
  roles,
  tracks,
  pseudonymize,
}: {
  orgId: string
  groups: ClassifyTitleGroup[]
  roles: ClassifyRole[]
  tracks: ClassifyTrack[]
  pseudonymize: boolean
}) {
  const t = useTranslations("dashboard.classify")
  const tToast = useTranslations("dashboard.toast")
  const tHelp = useTranslations("dashboard.help")

  // Per-row selected role: keyed by rowKey(group) (never null)
  const [selectedRole, setSelectedRole] = useState<Map<string, string | null>>(
    () => new Map()
  )

  // Which groups have their per-person rows expanded
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  // Per-person selected levels: outer key = rowKey(group), inner key = personId
  const [selectedLevel, setSelectedLevel] = useState<
    Map<string, Map<string, string>>
  >(() => new Map())

  const confirm = useMutation(api.people.assignments.assignPersonToRole)

  const roleById = new Map<string, ClassifyRole>(
    roles.map((r) => [r.roleId, r])
  )

  // Track reference is used to look up track names if needed in future.
  // Currently tracks is consumed by the parent to populate the track filter;
  // here we need it for correctness checks when track changes (via roleById).
  void tracks

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function handleLevelChange(
    groupKey: string,
    personId: string,
    level: string
  ) {
    setSelectedLevel((prev) => {
      const next = new Map(prev)
      const groupLevels = new Map(prev.get(groupKey) ?? new Map())
      groupLevels.set(personId, level)
      next.set(groupKey, groupLevels)
      return next
    })
  }

  function handleRoleChange(
    groupKey: string,
    value: string,
    group: ClassifyTitleGroup
  ) {
    // null is reserved for the unmatched-row handling (no role assigned)
    const newRoleId = value || null
    setSelectedRole((prev) => {
      const next = new Map(prev)
      next.set(groupKey, newRoleId)
      return next
    })

    // When the role changes to one on a different track, reset per-person
    // levels so an out-of-track level can never be submitted (ADR-0005:
    // level must be valid for the track; the server re-validates via
    // isValidLevelForTrack, but the UI must not offer or submit an invalid one).
    if (newRoleId !== null) {
      const newRole = roleById.get(newRoleId)
      const prevRoleId = selectedRole.get(groupKey) ?? group.suggestedRoleId
      const prevRole =
        prevRoleId !== null && prevRoleId !== undefined
          ? roleById.get(prevRoleId)
          : undefined

      const trackChanged =
        newRole !== undefined &&
        (prevRole === undefined || prevRole.trackKey !== newRole.trackKey)

      if (trackChanged && newRole !== undefined) {
        setSelectedLevel((prev) => {
          const next = new Map(prev)
          next.set(groupKey, buildDefaultLevels(group.people, newRole.trackKey))
          return next
        })
      }
    }
  }

  async function onConfirm(group: ClassifyTitleGroup) {
    const key = rowKey(group)
    const roleId = selectedRole.get(key) ?? group.suggestedRoleId
    if (roleId === null) return

    const groupLevels = selectedLevel.get(key)

    for (const p of group.people) {
      // Use the per-person selected level when present; fall back to
      // suggestedLevel if it is valid for the role's track, then to the
      // track's first level. This guarantees a valid level is always submitted.
      const role = roleById.get(roleId)
      const trackKey = role?.trackKey ?? ""
      let level = groupLevels?.get(p.personId)
      if (level === undefined) {
        level =
          p.suggestedLevel !== null &&
          isValidLevelForTrack(trackKey, p.suggestedLevel)
            ? p.suggestedLevel
            : defaultLevelFor(roleId, roleById)
      }
      await confirm({
        orgId,
        personId: p.personId as Parameters<typeof confirm>[0]["personId"],
        roleId: roleId as Parameters<typeof confirm>[0]["roleId"],
        level,
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
          {/* Reserved slot for the expand/collapse control (fixed width avoids layout shift) */}
          <TableHead className="w-8" />
          <TableHead>{t("columns.title")}</TableHead>
          <TableHead>{t("columns.people")}</TableHead>
          <TableHead>{t("columns.suggestedRole")}</TableHead>
          <TableHead>{t("columns.confidence")}</TableHead>
          <TableHead>{t("columns.state")}</TableHead>
          <TableHead>
            <span className="flex items-center gap-1.5">
              {t("levelLabel")}
              {/* ONE HelpMorphButton per concept, placed where the concept is
                  first introduced: the level column header. */}
              <HelpMorphButton label={tHelp("classifyLevelLabel")}>
                {tHelp("classifyLevelBody")}
              </HelpMorphButton>
            </span>
          </TableHead>
          <TableHead>{t("columns.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => {
          const key = rowKey(group)
          const state = classificationStateForPeople(group.people)
          const currentRoleId = selectedRole.get(key) ?? group.suggestedRoleId
          const isExpanded = expanded.has(key)
          const currentRole =
            currentRoleId !== null && currentRoleId !== undefined
              ? roleById.get(currentRoleId)
              : undefined
          const trackKey = currentRole?.trackKey ?? ""
          const groupLevels =
            selectedLevel.get(key) ?? new Map<string, string>()

          return (
            <>
              <TableRow key={key}>
                {/* Expand/collapse control in a pre-reserved slot so toggling
                    never causes the other cells to reflow. */}
                <TableCell className="w-8 pr-0">
                  <button
                    type="button"
                    aria-label={
                      isExpanded ? t("collapseLabel") : t("expandLabel")
                    }
                    aria-expanded={isExpanded}
                    onClick={() => toggleExpanded(key)}
                    className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <HugeiconsIcon
                      icon={ArrowDown01Icon}
                      size={14}
                      strokeWidth={2}
                      aria-hidden="true"
                      className={cn(
                        "transition-transform motion-reduce:transition-none",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </button>
                </TableCell>
                <TableCell className="font-medium">
                  {group.title !== null ? group.title : t("noTitle")}
                </TableCell>
                <TableCell>{group.personCount}</TableCell>
                <TableCell>
                  <Select
                    value={currentRoleId ?? ""}
                    onValueChange={(value) =>
                      handleRoleChange(key, value, group)
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
                {/* Level column on the title row is intentionally empty: the
                    per-person level selects appear in the expanded rows. */}
                <TableCell />
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

              {/* Expandable per-person rows. Animation follows docs/ui-animation.md:
                  - The outer motion element carries ONLY geometry (height + opacity),
                    no visual box styles, so height:0 truly reaches zero (rule 2).
                  - overflow-hidden lives on the outer element only while animating;
                    corner controls are inside the inner div and are not clipped at
                    rest (rule 4 is not needed here as there are no floating corners).
                  - AnimatePresence mode="popLayout" is not needed: these rows are
                    beneath the title row and their removal does not reflow siblings
                    above (rule 6 does not apply to a simple below-row expansion). */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.tr
                    key={`${key}-people`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={SPRING}
                    // The outer tr carries ONLY geometry so height:0 is true zero.
                    style={{ display: "table-row" }}
                  >
                    <td colSpan={8} style={{ padding: 0 }}>
                      {/* Inner div carries visual styles; the outer tr has none. */}
                      <div className="overflow-hidden">
                        <Table>
                          <TableBody>
                            <ClassifyPersonRows
                              people={group.people}
                              trackKey={trackKey}
                              selectedLevel={groupLevels}
                              onLevelChange={(personId, level) =>
                                handleLevelChange(key, personId, level)
                              }
                              pseudonymize={pseudonymize}
                            />
                          </TableBody>
                        </Table>
                      </div>
                    </td>
                  </motion.tr>
                )}
              </AnimatePresence>
            </>
          )
        })}
      </TableBody>
    </Table>
  )
}
