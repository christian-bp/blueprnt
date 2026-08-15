"use client"

import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react"

// Whether the shortcut is Cmd+K or Ctrl+K, resolved after mount because the
// platform is unknowable on the server: rendering the wrong modifier and
// swapping it would be worse than showing it a frame late. Null until then,
// which is also what keeps the two keys from both being live: on a Mac,
// Ctrl+K is the shell's kill-line binding inside text fields and must not
// open a dialog.
function useIsMac(): boolean | null {
  const [isMac, setIsMac] = useState<boolean | null>(null)
  useEffect(() => {
    setIsMac(/mac/i.test(navigator.platform || navigator.userAgent))
  }, [])
  return isMac
}

export interface CommandPaletteControls {
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
  // Null until the platform is known, which is what the shortcut hint renders
  // nothing for rather than guessing a modifier.
  isMac: boolean | null
}

// The palette's open state and its keyboard shortcut. Owned above the sidebar
// (CommandPaletteProvider mounts it from AppShell) rather than by the search
// row that triggers it: below the 768px breakpoint the sidebar renders inside
// a sheet that is unmounted while closed, so a listener registered in there
// does not exist until the user opens the navigation by hand, and the
// shortcut would silently do nothing on a narrow window.
export function useCommandPalette(): CommandPaletteControls {
  const [open, setOpen] = useState(false)
  const isMac = useIsMac()

  useEffect(() => {
    if (isMac === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k") return
      if (isMac ? !event.metaKey : !event.ctrlKey) return
      // Both browsers and macOS bind this chord themselves (address-bar
      // search); the palette is what the user means inside the app.
      event.preventDefault()
      setOpen((current) => !current)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [isMac])

  // Stable while nothing changed: the value goes through context, so a new
  // object on every render of the shell would re-render every consumer.
  return useMemo(() => ({ open, setOpen, isMac }), [open, isMac])
}
