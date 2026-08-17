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

  // The whole reason the nav lives in a layout: today's <details
  // open={isCurrent}> recomputes on every page load, so a section the reader
  // opened themselves snaps shut on their next click. The component does not
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

  it("marks the index link as current on the index route", () => {
    pathState.current = "/docs"
    renderPanel()
    expect(
      screen
        .getByRole("link", { name: INDEX_TITLE })
        .getAttribute("aria-current")
    ).toBe("page")
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
