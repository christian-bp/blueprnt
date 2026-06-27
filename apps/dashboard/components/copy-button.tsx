"use client"

import { Copy01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { Button } from "@workspace/ui/components/button"
import type { ComponentProps, ReactNode } from "react"
import { AsyncActionButton } from "@/components/async-action-button"

// A copy-to-clipboard button that briefly swaps its icon (and optional label) to
// a checkmark when clicked, then reverts. A thin specialization of
// AsyncActionButton whose action is the clipboard write. Button props (variant,
// size, className) forward through.
export function CopyButton({
  value,
  children,
  copiedLabel,
  ...props
}: Omit<ComponentProps<typeof Button>, "value" | "onClick"> & {
  value: string
  copiedLabel?: ReactNode
}) {
  return (
    <AsyncActionButton
      action={async () => {
        try {
          await navigator.clipboard.writeText(value)
        } catch {
          // Clipboard can be unavailable (insecure context / denied): skip the
          // confirmed state so we never claim a copy that did not happen.
          return false
        }
      }}
      idleIcon={<HugeiconsIcon icon={Copy01Icon} className="size-4" />}
      doneLabel={copiedLabel ?? children}
      {...props}
    >
      {children}
    </AsyncActionButton>
  )
}
