"use client"

import { createContext, type ReactNode, useContext } from "react"
import { CommandPalette } from "@/components/command-palette"
import {
  type CommandPaletteControls,
  useCommandPalette,
} from "@/hooks/use-command-palette"

const CommandPaletteContext = createContext<CommandPaletteControls | null>(null)

// Owns the palette: its open state, its global Cmd/Ctrl+K listener and the
// dialog itself. Mounted by AppShell as a sibling of the sidebar, never
// inside it. Below the 768px breakpoint the sidebar renders inside a sheet,
// and the sheet unmounts its children while closed, so a palette mounted in
// the sidebar footer would not exist at all on a narrow window: the shortcut
// would do nothing until the user opened the navigation by hand. The search
// row stays where it belongs, in the footer, and reaches the state from here.
export function CommandPaletteProvider(props: { children: ReactNode }) {
  const controls = useCommandPalette()
  return (
    <CommandPaletteContext value={controls}>
      {props.children}
      <CommandPalette open={controls.open} onOpenChange={controls.setOpen} />
    </CommandPaletteContext>
  )
}

export function useCommandPaletteControls(): CommandPaletteControls {
  const value = useContext(CommandPaletteContext)
  if (value === null) {
    throw new Error(
      "useCommandPaletteControls must be used inside CommandPaletteProvider"
    )
  }
  return value
}
