import type { ReactNode } from "react"

// The shared wizard footer row: an optional hint fills the space to the left
// (inside the row, so its appearance never shifts the layout vertically) and
// the actions group on the right, secondary immediately left of the primary
// (the onboarding footer convention).
export function WizardFooter({
  hint,
  children,
}: {
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex w-full items-center justify-end gap-2">
      {hint != null && (
        <span className="min-w-0 flex-1 truncate text-right text-muted-foreground text-sm">
          {hint}
        </span>
      )}
      {children}
    </div>
  )
}
