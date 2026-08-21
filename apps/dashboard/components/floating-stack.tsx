"use client"

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { createDomSlot } from "@/components/dom-slot"

const slot = createDomSlot()

// How many items are currently in the stack. The rail renders nothing at all
// when the answer is zero: a section whose open chapter has nothing to say
// should leave no fixed element behind, empty or not.
const CountContext = createContext<{
  count: number
  add: (delta: number) => void
} | null>(null)

// Mounted by the section shell, above both the rail and the chapters whose
// pills fill it.
export function FloatingStackProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0)
  const value = useMemo(
    () => ({ count, add: (delta: number) => setCount((c) => c + delta) }),
    [count]
  )
  return (
    <CountContext.Provider value={value}>
      <slot.Provider>{children}</slot.Provider>
    </CountContext.Provider>
  )
}

// Rendered by a chapter, anywhere in its own tree: its pill appears in the
// stack.
export function FloatingStackItem({ children }: { children: ReactNode }) {
  const registry = useContext(CountContext)
  const add = registry?.add
  useEffect(() => {
    if (add === undefined) return
    add(1)
    return () => add(-1)
  }, [add])
  return <slot.Content>{children}</slot.Content>
}

// The floating rail a guided section keeps at the bottom of the viewport for
// whatever its open chapter has to say.
//
// Bottom-CENTRE, at the offset and the z the chapter pills have always used,
// because that is all it carries: the journey instrument that briefly lived
// here sits centred on the section's title row instead, where it does not pass
// over the reader's data. Centre rather than a corner because a pill carries
// the chapter's whole subject, and because the toasts own the bottom-right on
// this app (z-50 against this z-40, so a toast passes over a pill rather than
// being hidden by it).
//
// FIXED positioning is the collision law satisfied rather than worked around:
// the rail is out of flow, so it cannot push a column or a row, and no
// ancestor's overflow can clip it. Nothing in it takes pointer events except a
// pill that has actually rendered.
export function FloatingStack() {
  const ref = slot.useSlotRef()
  const registry = useContext(CountContext)
  if (registry !== null && registry.count === 0) return null
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex flex-col items-center gap-3 px-4"
      data-slot="floating-stack"
    >
      {/* display:contents makes the pills direct flex items of the rail, so
          they take its gap and its order rather than stacking inside a wrapper
          of their own. */}
      <span className="contents" ref={ref} />
    </div>
  )
}
