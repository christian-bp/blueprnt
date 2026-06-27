import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { AuthHeading } from "./auth-heading"

afterEach(() => cleanup())

describe("AuthHeading", () => {
  it("renders the title as a level-1 heading", () => {
    render(<AuthHeading title="Sign in" />)
    const heading = screen.getByRole("heading", { level: 1 })
    expect(heading.textContent).toBe("Sign in")
  })

  it("renders an optional description", () => {
    render(<AuthHeading title="Sign in" description="Welcome back" />)
    expect(screen.queryByText("Welcome back")).not.toBeNull()
  })

  it("omits the description when none is given", () => {
    const { container } = render(<AuthHeading title="Sign in" />)
    expect(container.querySelector("p")).toBeNull()
  })
})
