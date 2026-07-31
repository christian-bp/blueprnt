import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import { RoleTableToolbar } from "@/components/roles/role-table-toolbar"
import { pickSelectOption } from "@/test/select"

const toolbar = messages.dashboard.roles.toolbar

const TRACKS = [
  { key: "IC", name: "Individual contributor" },
  { key: "M", name: "Manager" },
]

function renderToolbar(props: Partial<Parameters<typeof RoleTableToolbar>[0]>) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleTableToolbar tracks={TRACKS} {...props} />
    </NextIntlClientProvider>
  )
}

describe("RoleTableToolbar", () => {
  afterEach(() => cleanup())

  it("reports typed queries and picked tracks to its owner", async () => {
    const onQueryChange = vi.fn()
    const onTrackChange = vi.fn()
    renderToolbar({ query: "", onQueryChange, track: "all", onTrackChange })
    fireEvent.change(screen.getByPlaceholderText(toolbar.searchPlaceholder), {
      target: { value: "engineer" },
    })
    expect(onQueryChange).toHaveBeenCalledWith("engineer")
    await pickSelectOption(
      screen.getByRole("combobox", {
        name: messages.dashboard.roles.table.track,
      }),
      "Manager"
    )
    expect(onTrackChange).toHaveBeenCalledWith("M")
  })

  it("shows the result count only while a filter narrows the table", () => {
    const count = (shown: number, total: number) =>
      toolbar.resultCount
        .replace("{shown}", String(shown))
        .replace("{total}", String(total))
    renderToolbar({ query: "", track: "all", shown: 4, total: 4 })
    expect(screen.queryByText(count(4, 4))).toBeNull()
    cleanup()
    // A query narrows it.
    renderToolbar({ query: "engineer", track: "all", shown: 1, total: 4 })
    expect(screen.getByText(count(1, 4))).toBeDefined()
    cleanup()
    // So does the track filter on its own.
    renderToolbar({ query: "", track: "M", shown: 2, total: 4 })
    expect(screen.getByText(count(2, 4))).toBeDefined()
  })

  it("renders the real controls with only the all-option while data loads", () => {
    renderToolbar({ tracks: [] })
    // The search takes keystrokes even uncontrolled (no skeleton bar).
    const search = screen.getByPlaceholderText(toolbar.searchPlaceholder)
    expect(search.hasAttribute("disabled")).toBe(false)
    const trigger = screen.getByRole("combobox", {
      name: messages.dashboard.roles.table.track,
    })
    expect(trigger.textContent).toContain(toolbar.trackAll)
  })
})
