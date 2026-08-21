"use client"

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react"
import { createPortal } from "react-dom"

// A guided section's chapter ACTION lands on the tab row, beside the tabs,
// but it belongs to the chapter: whether Viktning offers its AI review needs
// that chapter's own model and review lock, and Metod's export loads its own
// data. The row is section chrome mounted once by the layout, above the
// chapter that is only its child.
//
// So the action travels rather than the state: the chapter renders its own
// control in its own React tree, where its hooks and data already are, and
// this portals the resulting DOM up into the row. A context passing the
// action node down would have meant lifting every chapter's query into the
// shell, or a shell that re-renders on each chapter's private state.
const SlotContext = createContext<{
  target: HTMLElement | null
  setTarget: (element: HTMLElement | null) => void
} | null>(null)

// Mounted by the section shell, above both the tab row and the chapter.
export function ChapterActionSlotProvider({
  children,
}: {
  children: ReactNode
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const value = useMemo(() => ({ target, setTarget }), [target])
  return <SlotContext.Provider value={value}>{children}</SlotContext.Provider>
}

// The box the actions land in, rendered by the tab row. Always present, never
// conditional: it is what keeps the row the same height on a chapter that
// offers no action as on one that does.
export function ChapterActionSlot() {
  const slot = useContext(SlotContext)
  return (
    // Named, so the size rule has something a test can hold it to: every
    // control in this slot is a chapter action, whichever chapter put it
    // there.
    <span
      className="flex shrink-0 items-center gap-2"
      data-slot="chapter-action"
      ref={slot?.setTarget}
    />
  )
}

// Rendered by a chapter, anywhere in its own tree: its control appears in the
// row above. Renders nothing at all outside a section that provides the slot,
// so a chapter component under test does not need the shell around it.
export function ChapterAction({ children }: { children: ReactNode }) {
  const slot = useContext(SlotContext)
  if (slot?.target == null) return null
  return createPortal(children, slot.target)
}
