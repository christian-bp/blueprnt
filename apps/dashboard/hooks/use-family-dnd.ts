"use client"

import {
  type Announcements,
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  type ScreenReaderInstructions,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { useTranslations } from "next-intl"
import { useRef, useState } from "react"
import {
  type DraftFamily,
  type DraftRole,
  familyIdOf,
  findFamilyIdByRole,
  moveRoleToFamily,
  reorderRoleWithinFamily,
  roleIdOf,
} from "@/lib/family-dnd"

type FamiliesUpdater = (current: DraftFamily[]) => DraftFamily[]

// The whole drag-and-drop controller for an editable list of role families,
// used by components/family-review-table.tsx, which both onboarding and the
// in-app role import render.
//
// Separate from the markup because the INTERACTION is its own concern: which
// sensors, when a cross-family move applies, what a cancelled drag restores,
// what a screen reader is told.
//
// It once existed twice, byte for byte, in two components that have since been
// merged into one. That copy is how the narration drifted: the same English
// sentence had been machine-translated separately into each surface's
// namespace, so a Swedish reader was told a role was "lyft" on one screen and
// "plockad upp" on the next. The messages now live in ONE dashboard.dnd
// namespace for the same reason this controller lives in one hook.
//
// What stays with the caller is the markup and the id prefixes' rendering
// (SortableContext, useDroppable, the DragOverlay body).
export function useFamilyDnd(options: {
  families: DraftFamily[]
  onFamiliesChange: (updater: FamiliesUpdater) => void
}) {
  const { families, onFamiliesChange } = options
  const t = useTranslations("dashboard.dnd")

  const [activeRoleId, setActiveRoleId] = useState<number | null>(null)
  // Cross-family moves apply live during onDragOver; a cancelled drag (escape)
  // must restore the layout from when the drag started.
  const dragSnapshot = useRef<DraftFamily[] | null>(null)

  const sensors = useSensors(
    // The distance constraint keeps plain clicks on the handle from starting
    // a drag, so focus and click behavior in the row stays untouched.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function roleById(roleId: number): DraftRole | null {
    for (const family of families) {
      const role = family.roles.find((item) => item.id === roleId)
      if (role !== undefined) return role
    }
    return null
  }

  function familyNameAt(overId: UniqueIdentifier): string | null {
    const overRoleId = roleIdOf(overId)
    const familyId =
      overRoleId !== null
        ? findFamilyIdByRole(families, overRoleId)
        : familyIdOf(overId)
    return families.find((family) => family.id === familyId)?.name ?? null
  }

  function handleDragStart({ active }: DragStartEvent) {
    dragSnapshot.current = families
    setActiveRoleId(roleIdOf(active.id))
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (over === null) return
    const roleId = roleIdOf(active.id)
    if (roleId === null) return
    const overRoleId = roleIdOf(over.id)
    const overFamilyId = overRoleId === null ? familyIdOf(over.id) : null
    onFamiliesChange((current) => {
      const sourceFamilyId = findFamilyIdByRole(current, roleId)
      const targetFamilyId =
        overRoleId !== null
          ? findFamilyIdByRole(current, overRoleId)
          : overFamilyId
      if (
        sourceFamilyId === null ||
        targetFamilyId === null ||
        sourceFamilyId === targetFamilyId
      ) {
        return current
      }
      return moveRoleToFamily(
        current,
        roleId,
        targetFamilyId,
        overRoleId ?? undefined
      )
    })
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    dragSnapshot.current = null
    setActiveRoleId(null)
    if (over === null) return
    const roleId = roleIdOf(active.id)
    const overRoleId = roleIdOf(over.id)
    if (roleId === null || overRoleId === null) return
    onFamiliesChange((current) =>
      reorderRoleWithinFamily(current, roleId, overRoleId)
    )
  }

  function handleDragCancel() {
    const snapshot = dragSnapshot.current
    dragSnapshot.current = null
    setActiveRoleId(null)
    if (snapshot !== null) onFamiliesChange(() => snapshot)
  }

  // Screen-reader narration for the drag interaction; all user-facing text
  // goes through i18n, including these.
  const announcements: Announcements = {
    onDragStart({ active }) {
      const role = roleById(roleIdOf(active.id) ?? -1)
      return role === null ? undefined : t("pickedUp", { title: role.title })
    },
    onDragOver({ active, over }) {
      const role = roleById(roleIdOf(active.id) ?? -1)
      const family = over === null ? null : familyNameAt(over.id)
      return role === null || family === null
        ? undefined
        : t("over", { title: role.title, family })
    },
    onDragEnd({ active, over }) {
      const role = roleById(roleIdOf(active.id) ?? -1)
      if (role === null) return undefined
      const family = over === null ? null : familyNameAt(over.id)
      return family === null
        ? t("cancelled", { title: role.title })
        : t("dropped", { title: role.title, family })
    },
    onDragCancel({ active }) {
      const role = roleById(roleIdOf(active.id) ?? -1)
      return role === null ? undefined : t("cancelled", { title: role.title })
    },
  }
  const screenReaderInstructions: ScreenReaderInstructions = {
    draggable: t("instructions"),
  }

  return {
    // Spread straight onto DndContext, so a surface cannot forget one handler
    // and lose (say) the cancel restore while everything else keeps working.
    dndContextProps: {
      sensors,
      collisionDetection: closestCorners,
      accessibility: { announcements, screenReaderInstructions },
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDragEnd: handleDragEnd,
      onDragCancel: handleDragCancel,
    },
    // The row being dragged, for the caller's DragOverlay.
    activeRole: activeRoleId === null ? null : roleById(activeRoleId),
  }
}
