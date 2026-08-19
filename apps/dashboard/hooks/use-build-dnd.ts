"use client"

import {
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  type ScreenReaderInstructions,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import type { DimensionKey } from "@workspace/core"
import { useTranslations } from "next-intl"
import { useState } from "react"
import {
  builderCollisionDetection,
  builderKeyboardCoordinates,
  libraryDragData,
  zoneDropData,
  zoneVerdict,
} from "@/lib/builder-dnd"

// One library card as the drag needs to know it: what it is called (for the
// narration and the drag overlay) and which dimension it belongs to.
export interface BuildDragCard {
  libraryKey: string
  dimensionKey: DimensionKey
  name: string
}

// The drag-and-drop controller of the model build view: the sensors, the
// collision detection, what a drop does, and what a screen reader is told
// while it happens.
//
// Separate from the markup for the reason the roles surface separated its own
// (hooks/use-family-dnd.ts): the INTERACTION is its own concern, and it is
// the part that has to keep working from the keyboard alone.
//
// Every rule about WHERE a card may land is read from lib/builder-dnd, never
// re-derived here, so the zone's own "I cannot take this" tint and this
// controller's decision can never disagree.
export function useBuildDnd(options: {
  // Every draggable card currently on the page. Only cards that are actually
  // draggable belong here: a card the caps have closed is not one.
  cards: readonly BuildDragCard[]
  // The dimension's own localized name, for the narration. Supplied by the
  // caller because the wording is library content, not this hook's copy.
  dimensionName: (key: DimensionKey) => string
  // A card landed in its own dimension's zone.
  onDrop: (libraryKey: string) => void
}) {
  const { cards, dimensionName, onDrop } = options
  const t = useTranslations("dashboard.dnd.criterion")

  const [activeKey, setActiveKey] = useState<string | null>(null)

  const sensors = useSensors(
    // The distance constraint keeps a plain click on the card body from
    // starting a drag, so the Add button beside it and the card's own focus
    // behaviour stay untouched.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: builderKeyboardCoordinates })
  )

  function cardOf(data: unknown): BuildDragCard | null {
    const dragged = libraryDragData(data)
    if (dragged === null) return null
    return cards.find((card) => card.libraryKey === dragged.libraryKey) ?? null
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveKey(cardOf(active.data.current)?.libraryKey ?? null)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveKey(null)
    if (over === null) return
    if (zoneVerdict(active.data.current, over.data.current) !== "ok") return
    const card = cardOf(active.data.current)
    if (card !== null) onDrop(card.libraryKey)
  }

  function handleDragCancel() {
    setActiveKey(null)
  }

  // The zone under the card and what it would do with it. Both readings come
  // from the same verdict the drop applies, so a reader who cannot see the
  // zone's colour is told exactly what the colour says.
  function verdictAt(activeData: unknown, overData: unknown) {
    const zone = zoneDropData(overData)
    if (zone === null) return null
    return {
      verdict: zoneVerdict(activeData, overData),
      dimension: dimensionName(zone.dimensionKey),
    }
  }

  const announcements: Announcements = {
    onDragStart({ active }) {
      const card = cardOf(active.data.current)
      return card === null ? undefined : t("pickedUp", { name: card.name })
    },
    onDragOver({ active, over }) {
      const card = cardOf(active.data.current)
      if (card === null || over === null) return undefined
      const at = verdictAt(active.data.current, over.data.current)
      if (at === null) return undefined
      switch (at.verdict) {
        case "ok":
          return t("over", { name: card.name, dimension: at.dimension })
        case "wrongDimension":
          return t("wrongDimension", {
            name: card.name,
            dimension: at.dimension,
          })
        case "full":
          return t("full", { dimension: at.dimension })
      }
    },
    onDragEnd({ active, over }) {
      const card = cardOf(active.data.current)
      if (card === null) return undefined
      const at =
        over === null ? null : verdictAt(active.data.current, over.data.current)
      if (at === null) return t("cancelled", { name: card.name })
      switch (at.verdict) {
        case "ok":
          return t("dropped", { name: card.name, dimension: at.dimension })
        case "wrongDimension":
          return t("notAddedWrongDimension", {
            name: card.name,
            dimension: at.dimension,
          })
        case "full":
          return t("notAddedFull", {
            name: card.name,
            dimension: at.dimension,
          })
      }
    },
    onDragCancel({ active }) {
      const card = cardOf(active.data.current)
      return card === null ? undefined : t("cancelled", { name: card.name })
    },
  }

  const screenReaderInstructions: ScreenReaderInstructions = {
    draggable: t("instructions"),
  }

  return {
    // Spread straight onto DndContext, so the view cannot forget one handler
    // and lose (say) the drop while everything else keeps working.
    dndContextProps: {
      sensors,
      collisionDetection: builderCollisionDetection,
      accessibility: { announcements, screenReaderInstructions },
      onDragStart: handleDragStart,
      onDragEnd: handleDragEnd,
      onDragCancel: handleDragCancel,
    },
    // The card in flight, for the caller's DragOverlay.
    activeCard:
      activeKey === null
        ? null
        : (cards.find((card) => card.libraryKey === activeKey) ?? null),
  }
}
