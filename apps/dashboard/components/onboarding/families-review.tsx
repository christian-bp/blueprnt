"use client"

import {
  type Announcements,
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  type ScreenReaderInstructions,
  type UniqueIdentifier,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Delete02Icon, DragDropVerticalIcon } from "@hugeicons/core-free-icons"
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
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import { useRef, useState } from "react"
import {
  type DraftFamily,
  type DraftRole,
  findFamilyIdByRole,
  moveRoleToFamily,
  reorderRoleWithinFamily,
} from "@/lib/family-dnd"

interface TrackOption {
  trackKey: string
  label: string
}

type FamiliesUpdater = (current: DraftFamily[]) => DraftFamily[]

// dnd-kit ids are shared between sortable roles and droppable family
// containers, so they carry a type prefix.
function roleIdOf(id: UniqueIdentifier): number | null {
  const match = /^role-(\d+)$/.exec(String(id))
  return match === null ? null : Number(match[1])
}

function familyIdOf(id: UniqueIdentifier): number | null {
  const match = /^family-(\d+)$/.exec(String(id))
  return match === null ? null : Number(match[1])
}

// The editable review list of role families, with dnd-kit drag and drop:
// roles reorder within a family and move between families (including empty
// ones) via the dedicated drag handle, so the row's inputs stay clickable.
// The actual list operations live in lib/family-dnd (unit-tested there).
export function FamiliesReview({
  families,
  onFamiliesChange,
  claimId,
  trackOptions,
}: {
  families: DraftFamily[]
  onFamiliesChange: (updater: FamiliesUpdater) => void
  claimId: () => number
  trackOptions: TrackOption[]
}) {
  const t = useTranslations("dashboard.onboarding.families")
  const tFamily = useTranslations("dashboard.roles.family")

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

  function updateFamily(familyId: number, patch: Partial<DraftFamily>) {
    onFamiliesChange((current) =>
      current.map((family) =>
        family.id === familyId ? { ...family, ...patch } : family
      )
    )
  }

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
      return role === null ? undefined : t("dndPickedUp", { title: role.title })
    },
    onDragOver({ active, over }) {
      const role = roleById(roleIdOf(active.id) ?? -1)
      const family = over === null ? null : familyNameAt(over.id)
      return role === null || family === null
        ? undefined
        : t("dndOver", { title: role.title, family })
    },
    onDragEnd({ active, over }) {
      const role = roleById(roleIdOf(active.id) ?? -1)
      if (role === null) return undefined
      const family = over === null ? null : familyNameAt(over.id)
      return family === null
        ? t("dndCancelled", { title: role.title })
        : t("dndDropped", { title: role.title, family })
    },
    onDragCancel({ active }) {
      const role = roleById(roleIdOf(active.id) ?? -1)
      return role === null
        ? undefined
        : t("dndCancelled", { title: role.title })
    },
  }
  const screenReaderInstructions: ScreenReaderInstructions = {
    draggable: t("dndInstructions"),
  }

  const activeRole = activeRoleId === null ? null : roleById(activeRoleId)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={{ announcements, screenReaderInstructions }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
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
                size="icon-sm"
                className="ml-auto shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={t("removeFamilyLabel", { name: family.name })}
                onClick={() =>
                  onFamiliesChange((current) =>
                    current.filter((item) => item.id !== family.id)
                  )
                }
              >
                <HugeiconsIcon icon={Delete02Icon} aria-hidden="true" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              <SortableContext
                items={family.roles.map((role) => `role-${role.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <FamilyRolesArea
                  familyId={family.id}
                  empty={family.roles.length === 0}
                >
                  {family.roles.map((role) => (
                    <SortableRoleRow
                      key={role.id}
                      role={role}
                      trackOptions={trackOptions}
                      onTitleChange={(title) =>
                        updateFamily(family.id, {
                          roles: family.roles.map((item) =>
                            item.id === role.id ? { ...item, title } : item
                          ),
                        })
                      }
                      onTrackChange={(trackKey) =>
                        updateFamily(family.id, {
                          roles: family.roles.map((item) =>
                            item.id === role.id ? { ...item, trackKey } : item
                          ),
                        })
                      }
                      onRemove={() =>
                        updateFamily(family.id, {
                          roles: family.roles.filter(
                            (item) => item.id !== role.id
                          ),
                        })
                      }
                    />
                  ))}
                </FamilyRolesArea>
              </SortableContext>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  updateFamily(family.id, {
                    roles: [
                      ...family.roles,
                      { id: claimId(), title: "", trackKey: "IC" },
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
            onFamiliesChange((current) => [
              ...current,
              { id: claimId(), name: "", roles: [] },
            ])
          }
        >
          {t("addFamilyCta")}
        </Button>
      </div>
      <DragOverlay>
        {activeRole !== null && (
          <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md">
            {activeRole.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

// The roles list is the droppable surface so a role can be dropped into a
// family that has no roles yet; the dashed outline marks the empty target.
function FamilyRolesArea({
  familyId,
  empty,
  children,
}: {
  familyId: number
  empty: boolean
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `family-${familyId}` })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "space-y-2 rounded-md",
        empty && "min-h-9 border border-dashed",
        isOver && "bg-muted/50"
      )}
    >
      {children}
    </div>
  )
}

function SortableRoleRow({
  role,
  trackOptions,
  onTitleChange,
  onTrackChange,
  onRemove,
}: {
  role: DraftRole
  trackOptions: TrackOption[]
  onTitleChange: (title: string) => void
  onTrackChange: (trackKey: string) => void
  onRemove: () => void
}) {
  const t = useTranslations("dashboard.onboarding.families")
  const tCreate = useTranslations("dashboard.roles.create")
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `role-${role.id}` })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-2", isDragging && "opacity-40")}
    >
      <Button
        type="button"
        ref={setActivatorNodeRef}
        variant="ghost"
        size="icon-sm"
        className="shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        aria-label={t("dragHandleLabel", { title: role.title })}
        {...attributes}
        {...listeners}
      >
        <HugeiconsIcon icon={DragDropVerticalIcon} aria-hidden="true" />
      </Button>
      <Input
        aria-label={tCreate("titleLabel")}
        value={role.title}
        onChange={(event) => onTitleChange(event.target.value)}
      />
      <Select value={role.trackKey} onValueChange={onTrackChange}>
        <SelectTrigger size="sm" className="w-36 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {trackOptions.map((option) => (
            <SelectItem key={option.trackKey} value={option.trackKey}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        aria-label={t("removeRoleLabel", { title: role.title })}
        onClick={onRemove}
      >
        <HugeiconsIcon icon={Delete02Icon} aria-hidden="true" />
      </Button>
    </div>
  )
}
