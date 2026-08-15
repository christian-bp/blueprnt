import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import {
  Sidebar,
  SidebarFooter,
  SidebarProvider,
} from "@workspace/ui/components/sidebar"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CommandPaletteProvider } from "@/components/command-palette-provider"
import { OrganizationProvider } from "@/components/org-context"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}))

// The real palette is rendered here, not a stub: the two regressions this
// file guards are both about what the palette does to the DOM around it (a
// heading it leaves behind while closed, a listener that never attaches), and
// a stub answers neither question.
const paletteTitle = messages.dashboard.commandPalette.title

function setPlatform(value: string) {
  Object.defineProperty(navigator, "platform", { value, configurable: true })
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { value: width, writable: true })
}

function Shell(props: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <OrganizationProvider
        value={{ orgId: "org1", name: "Acme", role: "admin" }}
      >
        {props.children}
      </OrganizationProvider>
    </NextIntlClientProvider>
  )
}

// The shell's arrangement: the palette's owner wraps the sidebar instead of
// living inside it.
function renderShell(sidebar: ReactNode = null) {
  return render(
    <Shell>
      <SidebarProvider>
        <CommandPaletteProvider>{sidebar}</CommandPaletteProvider>
      </SidebarProvider>
    </Shell>
  )
}

describe("CommandPaletteProvider", () => {
  beforeEach(() => {
    setPlatform("MacIntel")
    setViewportWidth(1280)
    // The palette fetches the guide index the first time it opens; the rows
    // are the palette's own test's subject, not this file's.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    )
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    // Deleting the own property restores the real Navigator getter: left in
    // place it shadows it for every later test in the process, which makes
    // file order load-bearing.
    Reflect.deleteProperty(navigator, "platform")
    setViewportWidth(1024)
  })

  // The regression: the palette used to be mounted by NavFooter, inside the
  // sidebar. Below 768px the sidebar renders inside a sheet, and the sheet
  // unmounts its children while closed, so the shortcut's document listener
  // was never attached on a narrow window until the user opened the
  // navigation by hand. Rendering the REAL sidebar is the point: a mocked one
  // stays mounted and can never show this.
  it("keeps the shortcut live while the sidebar is unmounted below the breakpoint", async () => {
    setViewportWidth(600)
    renderShell(
      <Sidebar>
        <SidebarFooter>
          <span data-testid="inside-sidebar" />
        </SidebarFooter>
      </Sidebar>
    )
    // Precondition, not decoration: if this ever mounts, the test below stops
    // proving anything.
    expect(screen.queryByTestId("inside-sidebar")).toBeNull()

    fireEvent.keyDown(document, { key: "k", metaKey: true })
    expect(
      await screen.findByRole("dialog", { name: paletteTitle })
    ).toBeTruthy()
  })

  it("mounts the palette outside the sidebar on a wide window too", () => {
    renderShell(
      <Sidebar>
        <SidebarFooter>
          <span data-testid="inside-sidebar" />
        </SidebarFooter>
      </Sidebar>
    )
    expect(screen.getByTestId("inside-sidebar")).toBeTruthy()
    fireEvent.keyDown(document, { key: "k", metaKey: true })
    const dialog = screen.getByRole("dialog", { name: paletteTitle })
    expect(dialog.closest("[data-slot=sidebar]")).toBeNull()
  })

  // The other half of the fix, in the vendored CommandDialog: its header used
  // to render beside DialogContent, and Dialog.Root renders that subtree
  // whether the dialog is open or not, so every page carried a phantom
  // level-2 heading a screen-reader user could navigate to.
  it("leaves no heading behind while it is closed", () => {
    renderShell()
    expect(screen.queryAllByRole("heading")).toHaveLength(0)
    expect(document.body.textContent).not.toContain(paletteTitle)
  })

  it("still names the dialog once it is open", () => {
    renderShell()
    fireEvent.keyDown(document, { key: "k", metaKey: true })
    expect(screen.getByRole("dialog", { name: paletteTitle })).toBeTruthy()
    // Named by an sr-only heading inside the popup, which is where the
    // heading is allowed to exist.
    expect(screen.getByRole("heading", { name: paletteTitle })).toBeTruthy()
  })

  it("toggles on Cmd+K on a mac and ignores Ctrl+K there", () => {
    renderShell()
    // Ctrl+K is the shell's kill-line binding on a mac; taking it would break
    // typing in every text field.
    fireEvent.keyDown(document, { key: "k", ctrlKey: true })
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.keyDown(document, { key: "k", metaKey: true })
    expect(screen.getByRole("dialog", { name: paletteTitle })).toBeTruthy()
    fireEvent.keyDown(document, { key: "k", metaKey: true })
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  // The majority platform, and the branch the mac case cannot reach: with
  // only the mac case, dropping the platform check entirely still passes.
  it("toggles on Ctrl+K off a mac and ignores Cmd+K there", () => {
    setPlatform("Win32")
    renderShell()
    fireEvent.keyDown(document, { key: "k", metaKey: true })
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.keyDown(document, { key: "k", ctrlKey: true })
    expect(screen.getByRole("dialog", { name: paletteTitle })).toBeTruthy()
    fireEvent.keyDown(document, { key: "k", ctrlKey: true })
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("leaves a plain k alone", () => {
    renderShell()
    fireEvent.keyDown(document, { key: "k" })
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
