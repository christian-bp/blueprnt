import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import type { Locale } from "@workspace/i18n/routing"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CommandPalette } from "@/components/command-palette"
import { OrganizationProvider } from "@/components/org-context"
import type { DocsIndex } from "@/lib/docs/docs-index"

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

const palette = messages.dashboard.commandPalette

// The slugs deliberately share no words with the titles they belong to. A row
// hands cmdk its key as the row's value, and a key built from a title-derived
// slug would let cmdk's OWN scorer satisfy these assertions, hiding whether
// shouldFilter={false} is still passed and whether our matcher runs at all.
const INDEX: DocsIndex = [
  {
    slug: "d1",
    title: "Score and levels",
    description: "How a rating becomes a level.",
    headings: ["Nivåer in practice", "Level versus seniority"],
  },
  {
    slug: "d2",
    title: "Importing people",
    description: "Bring a payroll export into the register.",
    headings: ["Supported files"],
  },
]

function renderPalette(role = "admin", locale: Locale = "en") {
  const onOpenChange = vi.fn()
  const view = render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <OrganizationProvider value={{ orgId: "org1", name: "Acme", role }}>
        <CommandPalette open onOpenChange={onOpenChange} />
      </OrganizationProvider>
    </NextIntlClientProvider>
  )
  return { onOpenChange, view }
}

// The rows of one group, by its heading, so an assertion about "Pages" can
// never be satisfied by a guide that happens to share a word.
function groupRows(heading: string): string[] {
  const group = screen
    .getByText(heading)
    .closest("[cmdk-group]") as HTMLElement | null
  if (group === null) throw new Error(`no group for ${heading}`)
  return within(group)
    .getAllByRole("option")
    .map((row) => row.textContent ?? "")
}

function type(value: string) {
  fireEvent.change(screen.getByRole("combobox"), { target: { value } })
}

// The guides arrive over a fetch. Waiting on a real row rather than on the
// group heading, because the heading is also on the loading placeholder and
// would resolve before a single guide exists.
const guidesLoaded = () => screen.findByText("Score and levels")

describe("CommandPalette", () => {
  beforeEach(() => {
    push.mockClear()
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(INDEX), {
            headers: { "content-type": "application/json" },
          })
        )
      )
    )
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  // First in the file on purpose: the guide index is cached at module scope
  // for the session, so only the first palette in the run actually fetches.
  it("opens on pages and guides, and fetches the guide index once per locale", async () => {
    renderPalette()
    // The pages are there before any request lands; the guides follow it.
    expect(groupRows(palette.groups.pages)[0]).toContain(
      messages.dashboard.nav.home
    )
    await guidesLoaded()
    expect(groupRows(palette.groups.guides)).toHaveLength(2)
    // Sections stay out of the opening view: a handful of headings taken
    // from the top of the corpus answers nothing until there is a query to
    // rank them against.
    expect(screen.queryByText(palette.groups.sections)).toBeNull()
    expect(vi.mocked(fetch).mock.calls).toEqual([["/api/docs-index?locale=en"]])

    cleanup()
    renderPalette()
    await guidesLoaded()
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  })

  it("narrows every group to the query", async () => {
    renderPalette()
    await guidesLoaded()
    type("people")
    expect(groupRows(palette.groups.pages)).toEqual([
      messages.dashboard.nav.people,
      // The import row's own LABEL contains the query, so cmdk ranks it above
      // the rows that match only through their detail.
      `${messages.dashboard.people.import.title}${messages.dashboard.nav.people}`,
      `${messages.dashboard.people.tabs.people}${messages.dashboard.nav.people}`,
      `${messages.dashboard.people.tabs.classify}${messages.dashboard.nav.people}`,
    ])
    expect(groupRows(palette.groups.guides)).toEqual([
      `Importing people${INDEX[1]?.description}`,
    ])
    // A heading matches through its guide's title too, which is why the one
    // heading of "Importing people" is here and the others are not.
    expect(groupRows(palette.groups.sections)).toEqual([
      "Supported filesImporting people",
    ])
  })

  it("drops a group with no matches instead of showing an empty heading", async () => {
    renderPalette()
    await guidesLoaded()
    type("assistant")
    expect(screen.getByText(palette.groups.pages)).toBeDefined()
    expect(screen.queryByText(palette.groups.guides)).toBeNull()
    expect(screen.queryByText(palette.groups.sections)).toBeNull()
  })

  it("matches a heading through its diacritics", async () => {
    renderPalette()
    await guidesLoaded()
    type("nivaer")
    expect(groupRows(palette.groups.sections)).toEqual([
      "Nivåer in practiceScore and levels",
    ])
  })

  it("says so when nothing matches", async () => {
    renderPalette()
    await guidesLoaded()
    type("qqq")
    expect(screen.getByText(palette.empty)).toBeDefined()
    expect(screen.queryByText(palette.groups.pages)).toBeNull()
  })

  it("keeps the admin pages away from an editor", () => {
    renderPalette("editor")
    type("organization")
    expect(screen.queryByText(palette.groups.pages)).toBeNull()
    cleanup()
    renderPalette("admin")
    type("organization")
    // The organization pages surface through their group heading ("the word a
    // user searches by"); the settings AREA row itself is named Settings and
    // does not match this query. The audit log sits in the Organization
    // category, so the same query finds it too.
    expect(groupRows(palette.groups.pages)).toEqual([
      `${messages.dashboard.organization.tabs.general}${messages.dashboard.nav.organization}`,
      `${messages.dashboard.organization.tabs.members}${messages.dashboard.nav.organization}`,
      `${messages.dashboard.nav.auditLog}${messages.dashboard.nav.organization}`,
    ])
  })

  it("navigates to a page and closes", () => {
    const { onOpenChange } = renderPalette()
    fireEvent.click(screen.getByText(messages.dashboard.nav.payMapping))
    expect(push).toHaveBeenCalledWith("/pay-mappings")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("navigates to a heading's own anchor", async () => {
    renderPalette()
    await guidesLoaded()
    type("seniority")
    fireEvent.click(screen.getByText("Level versus seniority"))
    expect(push).toHaveBeenCalledWith("/docs/d1#level-versus-seniority")
  })

  it("reaches the pages that have no sidebar row", async () => {
    renderPalette()
    await guidesLoaded()
    type("security")
    expect(groupRows(palette.groups.pages)).toEqual([
      `${messages.dashboard.account.tabs.security}${messages.dashboard.nav.accountSettings}`,
    ])
    fireEvent.click(screen.getByText(messages.dashboard.account.tabs.security))
    expect(push).toHaveBeenCalledWith("/account/security")
  })

  it("finds a guide by its title when its key shares nothing with the query", async () => {
    renderPalette()
    await guidesLoaded()
    // "levels" appears in the guide's title and nowhere in its key
    // ("guide:d1"), so only our own matcher can produce this row: cmdk's
    // built-in scorer sees the key alone and would drop it.
    type("levels")
    expect(groupRows(palette.groups.guides)).toEqual([
      `Score and levels${INDEX[0]?.description}`,
    ])
  })

  it("ends every trailing detail at the same right edge", async () => {
    renderPalette()
    await guidesLoaded()
    let checked = 0
    for (const row of screen.getAllByRole("option")) {
      const detail = row.querySelector('[data-slot="command-shortcut"]')
      if (detail === null) continue
      checked += 1
      // Two auto margins on one flex line split the free space between them,
      // which is what put the detail at a different x on every row. The
      // vendor's tick is the other one, and it carries the rule that hides it
      // whenever the row has a command-shortcut slot, so exactly one auto
      // margin survives and it is the detail's.
      const autos = [...row.querySelectorAll("*")].filter((node) =>
        (node.getAttribute("class") ?? "").split(" ").includes("ml-auto")
      )
      const shown = autos.filter(
        (node) =>
          !(node.getAttribute("class") ?? "").includes(
            "group-has-data-[slot=command-shortcut]/command-item:hidden"
          )
      )
      expect(shown).toEqual([detail])
    }
    // Without this the loop is vacuous: dropping the slot from the component
    // makes every querySelector return null, the body never runs, and the
    // test passes while the detail column goes ragged again.
    expect(checked).toBeGreaterThan(0)
  })

  // The dialog is a grid, so its row gap applies between the scrolling list
  // and the footer hint. At the vendor's gap-6 that is 24px of dead space
  // under a half-clipped last row.
  it("closes the gap between the list and the footer hint", async () => {
    renderPalette()
    await guidesLoaded()
    const dialog = document.querySelector("[data-slot=dialog-content]")
    expect(dialog?.className).toContain("gap-0")
  })

  it("hints that Enter goes to the page", async () => {
    renderPalette()
    await guidesLoaded()
    expect(screen.getByText(palette.goToPage)).toBeDefined()
    expect(screen.getByLabelText(palette.enterKey).tagName).toBe("KBD")
  })

  it("names the input and the result list in the user's own language", async () => {
    renderPalette()
    await guidesLoaded()
    expect(screen.getByRole("listbox").getAttribute("aria-label")).toBe(
      palette.results
    )
    const input = screen.getByRole("combobox")
    const labelId = input.getAttribute("aria-labelledby") ?? ""
    expect(document.getElementById(labelId)?.textContent).toBe(palette.title)
  })

  it("does not fetch the guide index until the palette is opened", async () => {
    const onOpenChange = vi.fn()
    // A locale of its own: the index cache is per locale and lives for the
    // module's life, so a locale another test already opened would be served
    // from memory and never fetch at all.
    const tree = (open: boolean) => (
      <NextIntlClientProvider locale="sv" messages={messages}>
        <OrganizationProvider
          value={{ orgId: "org1", name: "Acme", role: "admin" }}
        >
          <CommandPalette open={open} onOpenChange={onOpenChange} />
        </OrganizationProvider>
      </NextIntlClientProvider>
    )
    const { rerender } = render(tree(false))
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    rerender(tree(true))
    await waitFor(() =>
      expect(vi.mocked(fetch).mock.calls).toEqual([
        ["/api/docs-index?locale=sv"],
      ])
    )
  })

  it("shows placeholder rows instead of claiming nothing matches while the index loads", () => {
    // A request that never settles: the palette has to stay honest for as
    // long as it is waiting, not only for a tick.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {}))
    )
    // Another unused locale, so this never-settling promise cannot be handed
    // to a later test from the index cache.
    renderPalette("admin", "nb")
    type("supported")
    // "Supported files" is a heading in the corpus, so the definitive "nothing
    // matches" would be a lie; the guides area says "still loading" instead.
    expect(screen.queryByText(palette.empty)).toBeNull()
    const guides = screen
      .getByText(palette.groups.guides)
      .closest("[cmdk-group]") as HTMLElement
    expect(within(guides).queryAllByRole("option")).toHaveLength(0)
    expect(guides.querySelectorAll('[data-slot="skeleton"]').length).toBe(6)
  })
})
