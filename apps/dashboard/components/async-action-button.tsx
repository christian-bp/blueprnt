"use client"

import { Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { AnimatePresence, motion } from "motion/react"
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react"

// A button that runs an async action and animates through idle -> loading
// (spinner) -> done (a checkmark + optional confirm label) -> back to idle, with
// the content cross-fading between states. The action returns false to skip the
// done state (it failed) and revert immediately; anything else counts as
// success. Self-managing; reused by CopyButton and the 2FA resend control.
const REVERT_MS = 2000

type ActionState = "idle" | "loading" | "done"

export function AsyncActionButton({
  action,
  children,
  idleIcon,
  doneIcon = <HugeiconsIcon icon={Tick02Icon} className="size-4" />,
  doneLabel,
  disabled,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick"> & {
  action: () => Promise<boolean | undefined>
  idleIcon?: ReactNode
  doneIcon?: ReactNode
  doneLabel?: ReactNode
}) {
  const [state, setState] = useState<ActionState>("idle")
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Clear the pending revert if the button unmounts mid-timeout.
  useEffect(() => () => clearTimeout(timer.current), [])

  async function run() {
    if (state === "loading") return
    setState("loading")
    const result = await action()
    if (result === false) {
      setState("idle")
      return
    }
    setState("done")
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState("idle"), REVERT_MS)
  }

  return (
    <Button
      type="button"
      onClick={run}
      disabled={disabled || state === "loading"}
      {...props}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.15 }}
          className="inline-flex items-center gap-2"
        >
          {state === "loading" ? (
            <Spinner />
          ) : state === "done" ? (
            <>
              {doneIcon}
              {doneLabel ?? children}
            </>
          ) : (
            <>
              {idleIcon}
              {children}
            </>
          )}
        </motion.span>
      </AnimatePresence>
    </Button>
  )
}
