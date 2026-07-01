import { NextIntlClientProvider } from "next-intl"
import messages from "@workspace/i18n/messages/en.json"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Module-level variable: useAction returns a closure over this so the
// component always calls the current mock. The describe-level beforeEach
// reassigns it to a fresh vi.fn() so each test starts from a clean identity.
// (bun correlates rejected Promises to a specific vi.fn() instance; a fresh
// identity per test prevents spurious unhandledRejection events when the
// error test runs after a success test.)
let draftMock = vi.fn()

vi.mock("convex/react", () => ({
  useAction: () => draftMock,
}))

vi.mock("@workspace/backend/convex/_generated/api", () => {
  function pathProxy(path: string): unknown {
    return new Proxy(
      {},
      {
        get(_target, prop) {
          if (
            prop === Symbol.toPrimitive ||
            prop === "toString" ||
            prop === "valueOf"
          )
            return () => path
          if (typeof prop !== "string") return undefined
          return pathProxy(path === "" ? prop : `${path}.${prop}`)
        },
      }
    )
  }
  return { api: pathProxy("") }
})

import { RoleAiPanel } from "@/components/roles/role-ai-panel"

function wrap(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {node}
    </NextIntlClientProvider>
  )
}

describe("RoleAiPanel", () => {
  beforeEach(() => {
    draftMock = vi.fn()
  })
  afterEach(() => cleanup())

  it("generates then fills via onFilled and closes via onDone", async () => {
    draftMock.mockResolvedValue({
      purpose: "Runs the platform.",
      responsibilities: "Owns delivery",
    })
    const onFilled = vi.fn()
    const onDone = vi.fn()
    wrap(
      <RoleAiPanel
        orgId="org-1"
        roleId={"role-1" as never}
        onFilled={onFilled}
        onDone={onDone}
      />
    )
    fireEvent.click(
      screen.getByRole("button", { name: messages.dashboard.roles.ai.draftCta })
    )
    await waitFor(() =>
      expect(onFilled).toHaveBeenCalledWith({
        purpose: "Runs the platform.",
        responsibilities: "Owns delivery",
      })
    )
    expect(onDone).toHaveBeenCalledTimes(1)
    // The optional guidance is omitted when the description textarea is empty.
    expect(draftMock).toHaveBeenCalledWith({
      orgId: "org-1",
      roleId: "role-1",
      locale: "en",
    })
  })

  it("forwards the optional guidance description", async () => {
    draftMock.mockResolvedValue({ purpose: "P", responsibilities: "R" })
    wrap(
      <RoleAiPanel
        orgId="org-1"
        roleId={"role-1" as never}
        onFilled={vi.fn()}
      />
    )
    fireEvent.change(
      screen.getByLabelText(messages.dashboard.roles.ai.descriptionLabel),
      { target: { value: "Owns payments" } }
    )
    fireEvent.click(
      screen.getByRole("button", { name: messages.dashboard.roles.ai.draftCta })
    )
    await waitFor(() =>
      expect(draftMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        locale: "en",
        description: "Owns payments",
      })
    )
  })

  it("shows an error and stays retryable when generation fails", async () => {
    draftMock.mockImplementation(async () => {
      throw new Error("AI unavailable")
    })
    const onFilled = vi.fn()
    wrap(
      <RoleAiPanel
        orgId="org-1"
        roleId={"role-1" as never}
        onFilled={onFilled}
      />
    )
    fireEvent.click(
      screen.getByRole("button", { name: messages.dashboard.roles.ai.draftCta })
    )
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined())
    expect(onFilled).not.toHaveBeenCalled()
    // The Generate button is still available to retry.
    expect(
      screen.getByRole("button", { name: messages.dashboard.roles.ai.draftCta })
    ).toBeDefined()
  })
})
