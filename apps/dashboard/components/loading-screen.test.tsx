import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { LoadingScreen } from "./loading-screen"

afterEach(() => cleanup())

describe("LoadingScreen", () => {
  it("renders a brand-colored loader labelled by its prop", () => {
    render(<LoadingScreen label="Checking your session" />)
    const spinner = screen.getByLabelText("Checking your session")
    expect(spinner.getAttribute("class")).toContain("text-brand")
  })
})
