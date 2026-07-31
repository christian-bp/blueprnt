import { act, cleanup, render, screen } from "@testing-library/react"
import { Toaster } from "@workspace/ui/components/toast"
import { afterEach, describe, expect, it } from "vitest"

import { toast } from "@/lib/toast"

// Every other test mocks `@/lib/toast`, so nothing else exercises the real
// wiring. This asserts the whole path: a call to the module singleton reaches
// the mounted viewport and renders the message. It covers our own host wiring,
// not the vendored component's internals.
describe("toast host", () => {
  afterEach(cleanup)

  it("renders a success message into the mounted viewport", () => {
    render(<Toaster />)

    act(() => {
      toast.success("Role created")
    })

    expect(screen.getByText("Role created")).not.toBeNull()
  })

  // Errors carry priority "high", which Base UI mirrors into an assertive alert
  // region so assistive tech interrupts with the failure. That mirror is why an
  // error's text is in the DOM twice: query it by role, not by text, or the
  // lookup fails with "found multiple elements".
  it("announces an error urgently", () => {
    render(<Toaster />)

    act(() => {
      toast.error("Something went wrong")
    })

    expect(screen.getByRole("alert").textContent).toContain(
      "Something went wrong"
    )
  })
})
