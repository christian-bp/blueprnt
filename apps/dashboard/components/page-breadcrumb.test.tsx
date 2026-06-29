import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { PageBreadcrumb } from "@/components/page-breadcrumb"

describe("PageBreadcrumb", () => {
  afterEach(() => cleanup())

  it("links ancestors and marks the last segment as the current page", () => {
    render(
      <PageBreadcrumb
        segments={[
          { label: "Roles", href: "/roles" },
          { label: "Engineering", href: "/roles/families/engineering" },
          { label: "Senior Engineer" },
        ]}
      />
    )
    const roles = screen.getByRole("link", { name: "Roles" })
    expect(roles.getAttribute("href")).toBe("/roles")
    const family = screen.getByRole("link", { name: "Engineering" })
    expect(family.getAttribute("href")).toBe("/roles/families/engineering")
    // The current page is marked for assistive tech and is not a navigable anchor.
    const current = screen.getByText("Senior Engineer")
    expect(current.getAttribute("aria-current")).toBe("page")
    expect(current.getAttribute("href")).toBeNull()
  })

  it("renders a segment without an href as the non-navigable current page", () => {
    render(
      <PageBreadcrumb
        segments={[{ label: "Roles", href: "/roles" }, { label: "Tech" }]}
      />
    )
    const tech = screen.getByText("Tech")
    expect(tech.getAttribute("aria-current")).toBe("page")
    expect(tech.getAttribute("href")).toBeNull()
  })
})
