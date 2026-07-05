import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { WizardShell } from "./wizard-shell"

afterEach(() => cleanup())

describe("WizardShell", () => {
  it("renders its children", () => {
    render(
      <WizardShell>
        <div data-testid="content" />
      </WizardShell>
    )
    expect(screen.getByTestId("content")).toBeDefined()
  })

  it("renders the header slots and footer when provided", () => {
    render(
      <WizardShell
        headerLeft={<div data-testid="hl" />}
        headerRight={<div data-testid="hr" />}
        footer={<div data-testid="ft" />}
      >
        <div />
      </WizardShell>
    )
    expect(screen.getByTestId("hl")).toBeDefined()
    expect(screen.getByTestId("hr")).toBeDefined()
    expect(screen.getByTestId("ft")).toBeDefined()
  })

  it("omits the footer when not provided", () => {
    render(
      <WizardShell>
        <div />
      </WizardShell>
    )
    expect(screen.queryByTestId("ft")).toBeNull()
  })
})
