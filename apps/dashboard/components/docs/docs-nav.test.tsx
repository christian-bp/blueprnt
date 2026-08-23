import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

const pathState = vi.hoisted(() => ({ current: "/docs/roles-register" }))

vi.mock("next/navigation", () => ({
  usePathname: () => pathState.current,
}))

import {
  DocsNav,
  DocsNavPanel,
  type DocsNavSection,
  filterSections,
} from "@/components/docs/docs-nav"

const SECTIONS: DocsNavSection[] = [
  {
    section: "getting-started",
    label: "Getting started",
    pages: [
      { slug: "introduction", title: "Introduction" },
      { slug: "key-concepts", title: "Key concepts" },
    ],
  },
  {
    section: "roles",
    label: "Roles",
    pages: [
      { slug: "roles-register", title: "The roles register" },
      { slug: "role-families", title: "Role families" },
    ],
  },
]

function renderNav() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DocsNav sections={SECTIONS} />
    </NextIntlClientProvider>
  )
}

afterEach(() => {
  pathState.current = "/docs/roles-register"
  cleanup()
})

const NAV = messages.dashboard.docs.nav

describe("filterSections", () => {
  it("keeps everything for an empty or whitespace query", () => {
    expect(filterSections(SECTIONS, "")).toEqual(SECTIONS)
    expect(filterSections(SECTIONS, "   ")).toEqual(SECTIONS)
  })

  it("keeps only the pages whose title matches, and drops the emptied sections", () => {
    const result = filterSections(SECTIONS, "introduction")
    expect(result.map((section) => section.section)).toEqual([
      "getting-started",
    ])
    expect(result[0]?.pages.map((page) => page.slug)).toEqual(["introduction"])
  })

  it("keeps a whole section when the section's own label matches", () => {
    // A reader typing the name of a part of the guide wants that part, not
    // the subset of its pages that happen to repeat the word in their title.
    const result = filterSections(SECTIONS, "roles")
    const roles = result.find((section) => section.section === "roles")
    expect(roles?.pages).toEqual(SECTIONS[1]?.pages)
  })

  it("matches across the folding the whole docs surface uses", () => {
    // Via matchScore: case, word order and the Nordic letters all fold, so a
    // reader never has to reproduce the exact spelling to find a page.
    const nordic: DocsNavSection[] = [
      {
        section: "pay",
        label: "Lönekartläggning",
        pages: [{ slug: "what-is", title: "Vad är en lönekartläggning" }],
      },
    ]
    expect(filterSections(nordic, "lonekart")).toHaveLength(1)
    expect(filterSections(SECTIONS, "register roles")).toHaveLength(1)
    expect(filterSections(SECTIONS, "ROLES")).toHaveLength(1)
  })

  it("returns nothing when the query matches no page or section", () => {
    expect(filterSections(SECTIONS, "zzzz")).toEqual([])
  })
})

describe("DocsNav search", () => {
  it("filters the tree to the matching pages and opens them without a click", () => {
    // "Key concepts" sits in a section that is NOT the current one, so it is
    // closed until the query opens it: a filter that hides its own results
    // behind a disclosure would be useless.
    renderNav()
    expect(screen.queryByRole("link", { name: "Key concepts" })).toBeNull()

    fireEvent.change(
      screen.getByRole("textbox", { name: NAV.searchPlaceholder }),
      {
        target: { value: "key concepts" },
      }
    )
    expect(screen.getByRole("link", { name: "Key concepts" })).toBeDefined()
    expect(screen.queryByRole("link", { name: "Role families" })).toBeNull()
    expect(screen.queryByText("Roles")).toBeNull()
  })

  // The field sits at the very top of a scroll container that has no padding
  // of its own there, and a scroll container clips at its padding box: flush
  // against that edge, the input's 3px focus ring is cut along its whole top
  // edge. The room has to live on the sticky element, because sticky pins to
  // the scrollport and padding on the scroller would scroll away with it.
  it("keeps room above the field for its focus ring", () => {
    const { container } = renderNav()
    const sticky = container.querySelector("div.sticky")
    expect(sticky?.className).toMatch(/(^|\s)(py|pt)-/)
  })

  it("says so when nothing matches, and restores the tree when the query is cleared", () => {
    renderNav()
    const field = screen.getByRole("textbox", { name: NAV.searchPlaceholder })

    fireEvent.change(field, { target: { value: "zzzz" } })
    expect(screen.getByText(NAV.noMatches)).toBeDefined()

    fireEvent.change(field, { target: { value: "" } })
    expect(screen.queryByText(NAV.noMatches)).toBeNull()
    expect(screen.getByText("Getting started")).toBeDefined()
    expect(screen.getByText("Roles")).toBeDefined()
  })
})

describe("DocsNav", () => {
  it("opens the section holding the current page and leaves the others closed", () => {
    renderNav()
    expect(
      screen
        .getByRole("button", { name: "Roles" })
        .getAttribute("aria-expanded")
    ).toBe("true")
    expect(
      screen
        .getByRole("button", { name: "Getting started" })
        .getAttribute("aria-expanded")
    ).toBe("false")
    expect(
      screen.getByRole("link", { name: "The roles register" })
    ).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Introduction" })).toBeNull()
  })

  it("marks the current page", () => {
    renderNav()
    expect(
      screen
        .getByRole("link", { name: "The roles register" })
        .getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen
        .getByRole("link", { name: "Role families" })
        .getAttribute("aria-current")
    ).toBeNull()
  })

  it("lets the reader open another section", () => {
    renderNav()
    fireEvent.click(screen.getByRole("button", { name: "Getting started" }))
    expect(screen.getByRole("link", { name: "Introduction" })).toBeTruthy()
  })

  // The whole reason the nav lives in a layout: a section the reader opened
  // themselves must not snap shut on their next click. The component does not
  // remount between guides, so its override must outlive a path change.
  it("keeps a reader-opened section open across a navigation", () => {
    const { rerender } = renderNav()
    fireEvent.click(screen.getByRole("button", { name: "Getting started" }))
    expect(screen.getByRole("link", { name: "Introduction" })).toBeTruthy()

    pathState.current = "/docs/role-families"
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <DocsNav sections={SECTIONS} />
      </NextIntlClientProvider>
    )

    expect(screen.getByRole("link", { name: "Introduction" })).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "Role families" })
        .getAttribute("aria-current")
    ).toBe("page")
  })

  // A stale collapse override must never outrank the current-section default:
  // a reader who collapses the section holding the current page, then reaches
  // another page in that SAME section by a route the nav did not drive
  // (back/forward, the guide index, a footer link), must still see it open,
  // with the page they are reading marked current.
  it("keeps the current section open across a navigation even after the reader collapsed it", () => {
    const { rerender } = renderNav()
    // Collapsing has no visible effect yet: the section still holds the
    // current page, so the current-section default keeps it open regardless
    // of the override this records.
    fireEvent.click(screen.getByRole("button", { name: "Roles" }))
    expect(
      screen
        .getByRole("button", { name: "Roles" })
        .getAttribute("aria-expanded")
    ).toBe("true")

    pathState.current = "/docs/role-families"
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <DocsNav sections={SECTIONS} />
      </NextIntlClientProvider>
    )

    expect(
      screen
        .getByRole("button", { name: "Roles" })
        .getAttribute("aria-expanded")
    ).toBe("true")
    expect(
      screen
        .getByRole("link", { name: "Role families" })
        .getAttribute("aria-current")
    ).toBe("page")
  })

  it("renders no section as current on the index route", () => {
    pathState.current = "/docs"
    renderNav()
    for (const label of ["Getting started", "Roles"]) {
      expect(
        screen
          .getByRole("button", { name: label })
          .getAttribute("aria-expanded")
      ).toBe("false")
    }
  })
})

describe("DocsNavPanel", () => {
  const INDEX_TITLE = messages.dashboard.docs.index.title

  function renderPanel() {
    return render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <DocsNavPanel sections={SECTIONS}>
          <p>article</p>
        </DocsNavPanel>
      </NextIntlClientProvider>
    )
  }

  it("links back to the guide index and renders the page beside the nav", () => {
    renderPanel()
    const home = screen.getByRole("link", { name: INDEX_TITLE })
    expect(home.getAttribute("href")).toBe("/docs")
    expect(home.getAttribute("aria-current")).toBeNull()
    expect(screen.getByText("article")).toBeTruthy()
  })

  // The index page is itself the navigation (a hero, the popular guides, every
  // section listed), so the column beside it would repeat those links and push
  // the page's centred hero off centre. The page still renders; the nav stays
  // mounted for the route-transition slide but is inert, so none of its links
  // are in the tab order or the accessibility tree.
  it("keeps the nav column inert on the index route", () => {
    pathState.current = "/docs"
    renderPanel()
    expect(
      screen.getByRole("link", { name: INDEX_TITLE }).closest("[inert]")
    ).not.toBeNull()
    for (const button of screen.getAllByRole("button")) {
      expect(button.closest("[inert]")).not.toBeNull()
    }
    expect(screen.getByText("article")).toBeTruthy()
  })

  // The nav is the only navigation this surface has, so there is deliberately
  // no way to hide it. The section triggers are the only buttons here.
  it("offers no way to collapse the nav", () => {
    renderPanel()
    const sectionLabels = SECTIONS.map((section) => section.label)
    for (const button of screen.getAllByRole("button")) {
      expect(sectionLabels).toContain(button.textContent)
    }
  })
})
