import { cleanup, render, screen } from "@testing-library/react"
import { UserGroupIcon } from "@hugeicons/core-free-icons"
import { afterEach, describe, expect, it } from "vitest"
import { ActionCard } from "@/components/action-card"

afterEach(cleanup)

describe("ActionCard", () => {
  it("is one link over the whole card, named by its title", () => {
    render(
      <ActionCard
        title="Import employees"
        description="Bring in your people file"
        icon={UserGroupIcon}
        href="/people/import"
      />
    )
    const link = screen.getByRole("link", { name: "Import employees" })
    expect(link.getAttribute("href")).toBe("/people/import")
    // The detail line is visible content, not part of the link's name.
    expect(screen.getByText("Bring in your people file")).toBeDefined()
  })

  // Same reason as WidgetCard's: the Card clips its overflow and this anchor
  // is the clip edge, so an outward ring is painted away.
  it("draws its focus ring inside the clipped card box", () => {
    render(
      <ActionCard
        title="Import employees"
        description="Bring in your people file"
        icon={UserGroupIcon}
        href="/people/import"
      />
    )
    const link = screen.getByRole("link", { name: "Import employees" })
    expect(link.className).toContain("focus-visible:inset-ring-2")
  })

  // The tone is how a dashboard row shows work apart from a plain
  // destination without spending a second heading on it.
  it("exposes its tone, defaulting to brand", () => {
    const { container } = render(
      <>
        <ActionCard
          title="Approve criteria"
          description="9 items"
          icon={UserGroupIcon}
          href="/model/method"
        />
        <ActionCard
          title="Roles"
          description="Describe and evaluate"
          icon={UserGroupIcon}
          href="/roles"
          tone="muted"
        />
      </>
    )
    expect(
      [...container.querySelectorAll("[data-tone]")].map((c) =>
        c.getAttribute("data-tone")
      )
    ).toEqual(["brand", "muted"])
  })

  it("renders its icon chip decoratively", () => {
    const { container } = render(
      <ActionCard
        title="Roles"
        description="Describe and evaluate"
        icon={UserGroupIcon}
        href="/roles"
      />
    )
    expect(container.querySelector("span[aria-hidden='true']")).not.toBeNull()
  })
})
