import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { drainOtpMountTimers } from "@/test/otp-timers"
import { OtpField } from "./otp-field"

afterEach(async () => {
  cleanup()
  await drainOtpMountTimers()
})

describe("OtpField", () => {
  it("renders a labelled code input", () => {
    render(
      <OtpField
        value=""
        onChange={() => {}}
        onComplete={() => {}}
        ariaLabel="6-digit code"
      />
    )
    expect(screen.getByLabelText("6-digit code")).toBeDefined()
  })

  it("keeps the slots visible but disabled with the status card on top while verifying", () => {
    render(
      <OtpField
        value="123456"
        onChange={() => {}}
        onComplete={() => {}}
        ariaLabel="6-digit code"
        verifying
        verifyingLabel="Verifying..."
      />
    )
    expect(screen.getByRole("status")).toBeDefined()
    expect(screen.getByText("Verifying...")).toBeDefined()
    // The input stays mounted and shows the entered code, but takes no input.
    const input = screen.getByLabelText("6-digit code") as HTMLInputElement
    expect(input.disabled).toBe(true)
    expect(screen.getByText("1")).toBeDefined()
    expect(screen.getByText("6")).toBeDefined()
  })

  it("refocuses the input after verifying ends", async () => {
    const { rerender } = render(
      <OtpField
        value="123456"
        onChange={() => {}}
        onComplete={() => {}}
        ariaLabel="6-digit code"
        verifying
      />
    )
    rerender(
      <OtpField
        value=""
        onChange={() => {}}
        onComplete={() => {}}
        ariaLabel="6-digit code"
      />
    )
    await drainOtpMountTimers()
    const input = screen.getByLabelText("6-digit code")
    expect(document.activeElement).toBe(input)
  })
})
