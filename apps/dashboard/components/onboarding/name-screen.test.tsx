import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const createMock = vi.fn()
const orgUpdateMock = vi.fn()

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    organization: {
      create: (...args: unknown[]) => createMock(...args),
      update: (...args: unknown[]) => orgUpdateMock(...args),
    },
  },
}))

vi.mock("@/lib/slug", () => ({
  organizationSlug: (name: string) => `${name.toLowerCase()}-xxxx`,
}))

import { NameScreen } from "@/components/onboarding/name-screen"

const labels = messages.dashboard.onboarding.organization
const nextCta = messages.dashboard.onboarding.screens.nextCta

function renderScreen(props: Parameters<typeof NameScreen>[0]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <NameScreen {...props} />
    </NextIntlClientProvider>
  )
}

describe("NameScreen", () => {
  beforeEach(() => {
    createMock.mockReset()
    orgUpdateMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("create mode: creates the organization with name and slug on continue", async () => {
    createMock.mockResolvedValue({ data: { id: "org-new" }, error: null })
    const onAdvance = vi.fn()
    renderScreen({ existing: null, onAdvance })

    const input = screen.getByLabelText(labels.nameLabel)
    fireEvent.change(input, { target: { value: "Acme Corp" } })

    const form = input.closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({
        name: "Acme Corp",
        slug: "acme corp-xxxx",
      })
    })
    await waitFor(() => {
      expect(onAdvance).toHaveBeenCalledTimes(1)
    })
    expect(orgUpdateMock).not.toHaveBeenCalled()
  })

  it("create mode: the CTA is disabled for a too-short name", () => {
    renderScreen({ existing: null, onAdvance: vi.fn() })
    const input = screen.getByLabelText(labels.nameLabel)
    const button = screen.getByRole("button", { name: nextCta })

    expect(button).toHaveProperty("disabled", true)
    fireEvent.change(input, { target: { value: "a" } })
    expect(button).toHaveProperty("disabled", true)
    fireEvent.change(input, { target: { value: "ab" } })
    expect(button).toHaveProperty("disabled", false)
  })

  it("existing mode: an unchanged name calls onAdvance without renaming", async () => {
    const onAdvance = vi.fn()
    renderScreen({
      existing: { orgId: "org-9", name: "Existing Name" },
      onAdvance,
    })

    const input = screen.getByLabelText(labels.nameLabel) as HTMLInputElement
    expect(input.value).toBe("Existing Name")

    const form = input.closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)

    await waitFor(() => {
      expect(onAdvance).toHaveBeenCalledTimes(1)
    })
    expect(orgUpdateMock).not.toHaveBeenCalled()
    expect(createMock).not.toHaveBeenCalled()
  })

  it("existing mode: a changed name calls organization.update then onAdvance", async () => {
    orgUpdateMock.mockResolvedValue({ data: { id: "org-9" }, error: null })
    const onAdvance = vi.fn()
    renderScreen({ existing: { orgId: "org-9", name: "Old Name" }, onAdvance })

    const input = screen.getByLabelText(labels.nameLabel)
    fireEvent.change(input, { target: { value: "New Name" } })

    const form = input.closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)

    await waitFor(() => {
      expect(orgUpdateMock).toHaveBeenCalledWith({
        organizationId: "org-9",
        data: { name: "New Name" },
      })
    })
    await waitFor(() => {
      expect(onAdvance).toHaveBeenCalledTimes(1)
    })
    expect(createMock).not.toHaveBeenCalled()
  })

  it("create mode: shows an alert when organization.create resolves with an error", async () => {
    createMock.mockResolvedValue({ error: { message: "taken" }, data: null })
    const onAdvance = vi.fn()
    renderScreen({ existing: null, onAdvance })

    const input = screen.getByLabelText(labels.nameLabel)
    fireEvent.change(input, { target: { value: "Acme Corp" } })

    const form = input.closest("form")
    if (!form) throw new Error("form not found")
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    expect(onAdvance).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: nextCta })).toHaveProperty(
      "disabled",
      false
    )
  })
})
