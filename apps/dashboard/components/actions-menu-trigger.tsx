"use client"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import type { ComponentProps } from "react"

// The app's actions trigger: the bare "..." button that opens a row's or a
// section's menu. Ghost, in muted ink, so the surface carries the state it
// shows rather than an outlined control competing with it, and it darkens on
// hover like every other one.
//
// It exists as a component because the same preset was written out at every
// menu in the app, and four of them had drifted to the outlined variant. Pass
// the aria-label (the menu names what it acts on) and, in a small frame
// header, size="icon-sm"; the icon stays the caller's child, since these sit
// inside a DropdownMenuTrigger whose own children become the button's.
export function ActionsMenuTrigger({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "shrink-0 text-muted-foreground hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}
