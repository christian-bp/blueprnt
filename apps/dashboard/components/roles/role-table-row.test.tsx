import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { RoleLevelCell } from "@/components/roles/role-table-row"

const t = messages.dashboard

function renderCell(props: {
  level: number | null
  slug: string
  profileComplete: boolean
}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleLevelCell {...props} />
    </NextIntlClientProvider>
  )
}

// The register's level column is outcome-or-act: the level once one exists,
// the direct way INTO the rate flow while a ready profile still waits for its
// rating, and the muted absence only where rating cannot begin. The link is
// the register's one-press path into rating; losing it re-creates the
// role-page round trip it exists to remove.
describe("RoleLevelCell", () => {
  afterEach(() => cleanup())

  it("shows the level once the role has one", () => {
    renderCell({ level: 7, slug: "engineer", profileComplete: true })
    expect(screen.getByText("7")).toBeDefined()
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("links straight into the rate flow while a ready role waits", () => {
    renderCell({ level: null, slug: "engineer", profileComplete: true })
    const link = screen.getByRole("link", { name: t.rating.title })
    expect(link.getAttribute("href")).toBe("/roles/engineer/rate")
    expect(screen.queryByText(t.roles.notEvaluated)).toBeNull()
  })

  it("shows the muted absence, not a link, while the profile is incomplete", () => {
    renderCell({ level: null, slug: "engineer", profileComplete: false })
    expect(screen.getByText(t.roles.notEvaluated)).toBeDefined()
    expect(screen.queryByRole("link")).toBeNull()
  })
})
