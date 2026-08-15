"use client"

import { SearchIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd"
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import { useTranslations } from "next-intl"
import { useCommandPaletteControls } from "@/components/command-palette-provider"
import { ACTIVE_CLASSES, RAIL_CLASSES } from "@/components/nav-main"

// The sidebar footer's search row. It sits directly under Documentation and
// above the account row, and renders as an ordinary nav row (same button,
// rail padding and tooltip) so the footer reads as one list rather than a
// control bolted under one. The palette it opens lives above the sidebar
// (CommandPaletteProvider), so the row reads its state from context rather
// than owning it: see the provider for why it cannot be mounted in here.
export function NavSearch() {
  const t = useTranslations("dashboard")
  const label = t("commandPalette.trigger")
  const { open, setOpen, isMac } = useCommandPaletteControls()

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        tooltip={label}
        className={`${RAIL_CLASSES} ${ACTIVE_CLASSES}`}
      >
        <HugeiconsIcon icon={SearchIcon} strokeWidth={2} />
        {/* The vendored button truncates its last child span; the shortcut
            hint takes that position here, so the label carries it itself. */}
        <span className="min-w-0 truncate">{label}</span>
        {/* Hidden rather than clipped in the icon rail: the row collapses to
            a 32px square, and a shortcut hint with no label to explain it is
            noise even for the moment the width animates. Right-aligned, so
            resolving the modifier after mount moves nothing but itself. */}
        <KbdGroup className="ml-auto shrink-0 group-data-[collapsible=icon]:hidden">
          {isMac === null ? null : (
            <>
              <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
              <Kbd>K</Kbd>
            </>
          )}
        </KbdGroup>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
