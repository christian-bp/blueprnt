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
import { useRef, useState } from "react"
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
  // Every unselected library card on the page, INCLUDING the ones a cap has
  // closed: a card that cannot be dropped still has to be narrated by name
  // while it is refused, and a cap can close under a drag that is already in
  // the air.
  cards: readonly BuildDragCard[]
  // The dimension's own localized name, for the narration. Supplied by the
  // caller because the wording is library content, not this hook's copy.
  dimensionName: (key: DimensionKey) => string
  // A card landed in its own dimension's zone. Answers whether the add
  // actually started: the same criterion cannot be added twice at once, and a
  // drop that lands on one already in flight is refused rather than dropped on
  // the floor.
  onDrop: (libraryKey: string) => boolean
}) {
  const { cards, dimensionName, onDrop } = options
  const t = useTranslations("dashboard.dnd.criterion")

  const [activeKey, setActiveKey] = useState<string | null>(null)
  // What the drop just handled actually did. Recorded rather than re-derived,
  // because the narration must report the decision instead of reaching its own:
  // dnd-kit calls the onDragEnd PROP first and the monitor the announcement
  // rides on second, so by announcement time the add is already in flight and a
  // second look would call an accepted drop busy.
  const dropRefused = useRef(false)

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
    dropRefused.current = false
    if (over === null) return
    if (zoneVerdict(active.data.current, over.data.current) !== "ok") return
    const card = cardOf(active.data.current)
    if (card === null) return
    dropRefused.current = !onDrop(card.libraryKey)
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
          // The zone would take it, but the same criterion is already on its
          // way in. Saying so is the whole point: a reader who is told "added"
          // while nothing happened has no way to find out otherwise.
          return dropRefused.current
            ? t("notAddedBusy", { name: card.name })
            : t("dropped", { name: card.name, dimension: at.dimension })
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
