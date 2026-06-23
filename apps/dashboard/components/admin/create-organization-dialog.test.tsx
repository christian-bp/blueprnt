import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    platform: {
      admin: {
        createOrganization: "platform.admin.createOrganization",
      },
    },
  },
}))

import { CreateOrganizationDialog } from "@/components/admin/create-organization-dialog"

const labels = messages.dashboard.admin.orgs.create

function renderAndOpen() {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CreateOrganizationDialog />
    </NextIntlClientProvider>
  )
  // Open the dialog by clicking the trigger button.
  fireEvent.click(screen.getByRole("button", { name: labels.cta }))
}

describe("CreateOrganizationDialog auto-slug", () => {
  afterEach(() => {
    cleanup()
  })

  it("typing a name auto-fills the slug", () => {
    renderAndOpen()
    const nameInput = screen.getByLabelText(labels.nameLabel)
    const slugInput = screen.getByLabelText(labels.slugLabel)

    fireEvent.change(nameInput, { target: { value: "Kanonkula AB" } })
    expect((slugInput as HTMLInputElement).value).toBe("kanonkula-ab")
  })

  it("manually editing the slug stops auto-fill", () => {
    renderAndOpen()
    const nameInput = screen.getByLabelText(labels.nameLabel)
    const slugInput = screen.getByLabelText(labels.slugLabel)

    // First, type a name so the slug is auto-set.
    fireEvent.change(nameInput, { target: { value: "Acme" } })
    expect((slugInput as HTMLInputElement).value).toBe("acme")

    // Now the user hand-edits the slug.
    fireEvent.change(slugInput, { target: { value: "my-custom-slug" } })
    expect((slugInput as HTMLInputElement).value).toBe("my-custom-slug")

    // Typing more name must NOT overwrite the hand-edited slug.
    fireEvent.change(nameInput, { target: { value: "Acme Corp" } })
    expect((slugInput as HTMLInputElement).value).toBe("my-custom-slug")
  })

  it("handles Nordic characters in the auto-slug", () => {
    renderAndOpen()
    const nameInput = screen.getByLabelText(labels.nameLabel)
    const slugInput = screen.getByLabelText(labels.slugLabel)

    fireEvent.change(nameInput, { target: { value: "Känslosam AB" } })
    expect((slugInput as HTMLInputElement).value).toBe("kanslosam-ab")
  })
})
