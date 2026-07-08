import { fireEvent, screen } from "@testing-library/react"

// Base UI Select helpers for happy-dom tests. Radix rendered a hidden native
// <select> inside forms (tests drove it with fireEvent.change); Base UI
// renders a hidden input plus a popup listbox instead, so tests drive the
// real UI: open the trigger, then commit an option with the full pointer
// sequence (Base UI commits on pointerup, not on a synthetic click alone).
export async function pickSelectOption(
  trigger: HTMLElement,
  name: string | RegExp
) {
  fireEvent.click(trigger)
  const option = await screen.findByRole("option", { name })
  fireEvent.pointerDown(option)
  fireEvent.pointerUp(option)
  fireEvent.click(option)
}
