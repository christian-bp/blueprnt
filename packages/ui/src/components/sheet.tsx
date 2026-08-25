"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"

import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"

import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          // LOCAL DEVIATION (documented in patches/sheet.patch): the app's
          // sheets FLOAT. Upstream pins the panel to the viewport edge, full
          // bleed with one border; ours insets by 4 on every side, rounds its
          // corners and lets the shadow carry the separation, which is the
          // house sheet language. Geometry and chrome only: the data-slots,
          // the Base UI wiring and the focus handling are untouched.
          //
          // Every side gets the same treatment even though only right and left
          // are used today, so the component stays coherent rather than
          // growing a second look the first time someone opens a bottom sheet.
          //
          // p-0 and gap-0 because the header, body and footer own their own
          // padding now; overflow-hidden so the rounded corners actually clip
          // the content that runs to them, which means the BODY is what
          // scrolls (min-h-0 flex-1 overflow-y-auto at the call site).
          //
          // BORDERLESS, on every side. Upstream gives each side variant its own
          // edge border (border-l on right, border-r on left, and so on);
          // border-0 kills all four, and no side block below adds one back.
          // The ring is the house hairline every other floating surface wears
          // (popover, dropdown, dialog: ring-1 ring-foreground/10), not a
          // border returning by another name. It is what carries the edge on
          // the DARK plane, where a shadow over a dark ground has almost
          // nothing to darken; on light it disappears into the shadow.
          "fixed z-50 flex flex-col gap-0 overflow-hidden rounded-xl border-0 bg-popover bg-clip-padding p-0 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0",
          // Right and left mirror each other: inset from their own edge, full
          // height minus the inset, and a width that gives way on a narrow
          // viewport instead of overflowing it.
          "data-[side=right]:inset-y-4 data-[side=right]:right-4 data-[side=right]:left-auto data-[side=right]:h-[calc(100svh-2rem)] data-[side=right]:w-[min(28rem,calc(100vw-2rem))] data-[side=right]:max-w-[28rem] data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem]",
          "data-[side=left]:inset-y-4 data-[side=left]:left-4 data-[side=left]:right-auto data-[side=left]:h-[calc(100svh-2rem)] data-[side=left]:w-[min(28rem,calc(100vw-2rem))] data-[side=left]:max-w-[28rem] data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem]",
          // Top and bottom inset horizontally and sit against their own edge,
          // sized by content up to the same full-height-minus-inset ceiling.
          "data-[side=top]:inset-x-4 data-[side=top]:top-4 data-[side=top]:bottom-auto data-[side=top]:h-auto data-[side=top]:max-h-[calc(100svh-2rem)] data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem]",
          "data-[side=bottom]:inset-x-4 data-[side=bottom]:bottom-4 data-[side=bottom]:top-auto data-[side=bottom]:h-auto data-[side=bottom]:max-h-[calc(100svh-2rem)] data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem]",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                // z-10 so it stays above header content, and the header
                // RESERVES its corner (SheetHeader's padding-right below), so
                // a title, a description or a badge row can never render
                // underneath it. The reservation is structural: a call site
                // cannot forget it, because it is not a call site's to make.
                className="absolute top-3 right-3 z-10 size-7"
                size="icon-sm"
              />
            }
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      // pr-12 reserves the close button's corner: the close is absolute at
      // top-3 right-3 and size-7, so anything the header lays out has to stop
      // clear of it. This lived nowhere before, and a long title or a trailing
      // status chip would render under the button and take its clicks.
      className={cn("flex flex-col gap-0.5 border-b px-5 py-4 pr-12", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "mt-auto flex flex-row flex-wrap justify-end gap-2 border-t px-5 py-3",
        className
      )}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        // truncate, not wrap: the header reserves the close's corner, and a
        // title long enough to need the space must give way inside its own
        // line rather than growing a second one under the button.
        "cn-font-heading truncate text-base font-semibold text-foreground",
        className
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
