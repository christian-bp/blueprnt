"use client"

import { Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  InputGroup,
  InputGroupAddon,
} from "@workspace/ui/components/input-group"
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd"
import { useTranslations } from "next-intl"
import { useCommandPaletteControls } from "@/components/command-palette-provider"

// The top bar's centered search trigger: looks like a search field, is a
// button that opens the command palette (the palette owns the real input).
// pointer-events-none on the group keeps the whole area one click target.
export function SearchButton() {
  const t = useTranslations("dashboard")
  const { open, setOpen, isMac } = useCommandPaletteControls()
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={t("commandPalette.trigger")}
      className="w-80 cursor-pointer rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      <InputGroup className="pointer-events-none h-7">
        <InputGroupAddon>
          <HugeiconsIcon
            icon={Search01Icon}
            strokeWidth={2}
            aria-hidden="true"
          />
        </InputGroupAddon>
        <span className="flex-1 ps-1.5 text-start text-muted-foreground text-sm">
          {t("commandPalette.trigger")}
        </span>
        <InputGroupAddon align="inline-end">
          <KbdGroup>
            <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </InputGroupAddon>
      </InputGroup>
    </button>
  )
}
