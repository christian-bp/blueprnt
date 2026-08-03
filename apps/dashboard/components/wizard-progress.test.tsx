import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { WizardProgress } from "./wizard-progress"

// The vendored shadcn Progress (Base UI) exposes the value through the
// progressbar's aria-valuenow; read the percentage back from it the same way
// the people import suite does.
function percentNow(root: HTMLElement) {
  const bar =
    root.getAttribute("role") === "progressbar"
      ? root
      : (root.querySelector('[role="progressbar"]') as HTMLElement)
  return Number(bar.getAttribute("aria-valuenow"))
}

describe("WizardProgress", () => {
  afterEach(() => {
    cleanup()
  })

  it("derives the percentage from done/total, rounded", () => {
    render(<WizardProgress done={59} total={118} label="Working" testId="wp" />)
    expect(percentNow(screen.getByTestId("wp"))).toBe(50)
  })

  it("reads a non-positive total as 0 percent instead of dividing by zero", () => {
    render(<WizardProgress done={0} total={0} label="Working" testId="wp" />)
    expect(percentNow(screen.getByTestId("wp"))).toBe(0)
  })

  it("clamps the percentage to 100 even if done exceeds total", () => {
    render(
      <WizardProgress done={150} total={100} label="Working" testId="wp" />
    )
    expect(percentNow(screen.getByTestId("wp"))).toBe(100)
  })

  it("never lets the bar move backwards when done/total drop between renders", () => {
    const { rerender } = render(
      <WizardProgress done={90} total={100} label="Working" testId="wp" />
    )
    expect(percentNow(screen.getByTestId("wp"))).toBe(90)

    // A caller's counts can legitimately dip (e.g. a cleared progress row);
    // the bar must hold at its highest value rather than snapping back.
    rerender(<WizardProgress done={0} total={0} label="Working" testId="wp" />)
    expect(percentNow(screen.getByTestId("wp"))).toBe(90)

    // A genuinely higher value still climbs past the held one.
    rerender(
      <WizardProgress done={95} total={100} label="Working" testId="wp" />
    )
    expect(percentNow(screen.getByTestId("wp"))).toBe(95)
  })

  it("renders the label in its default muted status style when no heading is requested", () => {
    render(<WizardProgress done={1} total={2} label="Importing..." />)
    const labelEl = screen.getByText("Importing...")
    expect(labelEl.className).toContain("text-muted-foreground")
    expect(labelEl.className).not.toContain("font-medium")
  })

  it("renders the label with heading emphasis when heading is set", () => {
    render(
      <WizardProgress
        done={1}
        total={2}
        label="Drafting role profiles"
        heading
      />
    )
    const labelEl = screen.getByText("Drafting role profiles")
    expect(labelEl.className).toContain("font-medium")
  })

  it("renders no description paragraph unless one is supplied", () => {
    const { rerender } = render(
      <WizardProgress done={1} total={2} label="Working" />
    )
    expect(screen.queryByText("We are writing a purpose...")).toBeNull()

    rerender(
      <WizardProgress
        done={1}
        total={2}
        label="Working"
        description="We are writing a purpose..."
      />
    )
    expect(screen.getByText("We are writing a purpose...")).toBeDefined()
  })

  it("leaves the count slot empty (but present) when no countLabel is given", () => {
    render(<WizardProgress done={1} total={2} label="Working" testId="wp" />)
    expect(screen.getByTestId("wp-count").textContent).toBe("")
  })

  it("shows the caller's count text in the right-aligned slot", () => {
    render(
      <WizardProgress
        done={59}
        total={118}
        label="Working"
        countLabel="59 of 118 rows"
        testId="wp"
      />
    )
    expect(screen.getByTestId("wp-count").textContent).toBe("59 of 118 rows")
  })

  // The standing rule this codebase already had (onboarding's own comment,
  // before the extraction): the drafting bar earns the brand accent, "other
  // progress bars stay neutral". The default must keep that rule, not flip
  // it, so a future edit cannot silently brand every bar again.
  it("stays unaccented by default: neither the bar nor the spinner brand", () => {
    render(<WizardProgress done={1} total={2} label="Working" testId="wp" />)
    const bar = screen.getByTestId("wp")
    expect(bar.className).not.toContain("bg-brand")
    const spinner = document.querySelector('[aria-hidden="true"].animate-spin')
    expect(spinner?.className).not.toContain("text-brand")
  })

  it("brands both the bar and the spinner when accent is passed", () => {
    render(
      <WizardProgress done={1} total={2} label="Working" testId="wp" accent />
    )
    const bar = screen.getByTestId("wp")
    expect(bar.className).toContain("bg-brand")
    const spinner = document.querySelector('[aria-hidden="true"].animate-spin')
    expect(spinner?.className).toContain("text-brand")
  })
})
