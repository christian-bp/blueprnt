"use client"

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react"
import { createPortal } from "react-dom"

// A named place in the layout that content from ELSEWHERE in the React tree
// renders into.
//
// Both of this app's uses are the same shape: a piece of chrome the section
// shell mounts (a chapter action row, a floating stack) needs to show a
// control that belongs to the chapter far below it, and whose state, hooks and
// queries live down there. Passing the node down would mean lifting every
// chapter's data into the shell; passing it up is what portals are for, so the
// content stays in its own tree and only its DOM travels.
//
// A factory rather than one context, because two slots must not share a
// target: a chapter action landing in the floating stack would be a bug no
// type could catch if both read the same provider.
export function createDomSlot() {
  const SlotContext = createContext<{
    target: HTMLElement | null
    setTarget: (element: HTMLElement | null) => void
  } | null>(null)

  // Mounted above both the place that RENDERS the slot and the place whose
  // content fills it.
  function Provider({ children }: { children: ReactNode }) {
    const [target, setTarget] = useState<HTMLElement | null>(null)
    const value = useMemo(() => ({ target, setTarget }), [target])
    return <SlotContext.Provider value={value}>{children}</SlotContext.Provider>
  }

  // The ref the slot's own box takes, which is what publishes it as the
  // target. Undefined outside a provider, so the box still renders.
  function useSlotRef() {
    return useContext(SlotContext)?.setTarget
  }

  // Renders its children into the slot, or IN PLACE when there is no slot to
  // render into: outside a provider, and for the one commit between mount and
  // the target's ref callback running.
  //
  // In place rather than nothing, deliberately. A component under test does
  // not need the shell around it, and a surface that forgets the provider
  // shows its control in the wrong position rather than losing it entirely,
  // which is a bug someone notices instead of one they have to go looking for.
  function Content({ children }: { children: ReactNode }) {
    const slot = useContext(SlotContext)
    if (slot?.target == null) return <>{children}</>
    return createPortal(children, slot.target)
  }

  return { Provider, useSlotRef, Content }
}
