"use client"

import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { AnimatePresence, motion } from "motion/react"
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react"

// A copy-to-clipboard button that briefly swaps its icon (and optional label) to
// a checkmark when clicked, then reverts. Self-managing; reuse wherever a copy
// affordance is needed. Button props (variant, size, className) forward through.
const REVERT_MS = 2000

export function CopyButton({
  value,
  children,
  copiedLabel,
  ...props
}: Omit<ComponentProps<typeof Button>, "value" | "onClick"> & {
  value: string
  copiedLabel?: ReactNode
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Clear the pending revert if the button unmounts mid-timeout.
  useEffect(() => () => clearTimeout(timer.current), [])

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // Clipboard can be unavailable (insecure context / denied); do nothing.
      return
    }
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), REVERT_MS)
  }

  return (
    <Button type="button" onClick={onCopy} {...props}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? "copied" : "idle"}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.15 }}
          className="inline-flex items-center gap-2"
        >
          <HugeiconsIcon
            icon={copied ? Tick02Icon : Copy01Icon}
            className="size-4"
          />
          {copied ? (copiedLabel ?? children) : children}
        </motion.span>
      </AnimatePresence>
    </Button>
  )
}
