import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import en from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Flow-level coverage of the account avatar's account-specific wiring (the
// Better Auth image mirror), re-homed from the old avatar-upload.test.tsx after
// the upload flow moved into the shared useImageUpload hook + AvatarUpload.
const { generateUploadUrlMock, setMyAvatarMock, removeMyAvatarMock } =
  vi.hoisted(() => {
    const generateUploadUrlMock = vi.fn(
      async () => "https://example.com/upload-url"
    )
    const setMyAvatarMock = vi.fn(
      async (_args: { storageId: string }) =>
        "https://example.com/avatar/served.jpg"
    )
    const removeMyAvatarMock = vi.fn(async () => null)
    return { generateUploadUrlMock, setMyAvatarMock, removeMyAvatarMock }
  })

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    files: { generateImageUploadUrl: "files.generateImageUploadUrl" },
    accounts: {
      account: {
        setMyAvatar: "accounts.account.setMyAvatar",
        removeMyAvatar: "accounts.account.removeMyAvatar",
      },
    },
  },
}))

vi.mock("convex/react", () => ({
  useMutation: (ref: string) => {
    if (ref === "files.generateImageUploadUrl") return generateUploadUrlMock
    if (ref === "accounts.account.removeMyAvatar") return removeMyAvatarMock
    return vi.fn()
  },
  useAction: () => setMyAvatarMock,
}))

const { updateUser, useSession } = vi.hoisted(() => ({
  updateUser: vi.fn(async () => ({ error: null })),
  useSession: vi.fn(
    (): {
      data: { user: { name: string; email: string; image: string | null } }
    } => ({
      data: {
        user: { name: "Jane Doe", email: "jane@example.com", image: null },
      },
    })
  ),
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: { updateUser, useSession },
}))

const fetchMock = vi.fn(async () => ({
  ok: true,
  json: async () => ({ storageId: "kg123" }),
}))
vi.stubGlobal("fetch", fetchMock)
vi.stubGlobal(
  "URL",
  Object.assign(URL, {
    createObjectURL: vi.fn(() => "blob:fake-preview-url"),
    revokeObjectURL: vi.fn(),
  })
)

import { AvatarSection } from "./avatar-section"

const t = en.dashboard.account.profile.avatar

function renderSection() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AvatarSection />
    </NextIntlClientProvider>
  )
}

function makeImageFile(overrides?: { size?: number; type?: string }) {
  const file = new File(["data"], "photo.jpg", {
    type: overrides?.type ?? "image/jpeg",
  })
  if (overrides?.size !== undefined) {
    Object.defineProperty(file, "size", { value: overrides.size })
  }
  return file
}

describe("AvatarSection", () => {
  beforeEach(() => {
    generateUploadUrlMock.mockResolvedValue("https://example.com/upload-url")
    setMyAvatarMock.mockResolvedValue("https://example.com/avatar/served.jpg")
    removeMyAvatarMock.mockResolvedValue(null)
    updateUser.mockResolvedValue({ error: null })
    useSession.mockReturnValue({
      data: {
        user: { name: "Jane Doe", email: "jane@example.com", image: null },
      },
    })
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ storageId: "kg123" }),
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("selecting a valid image runs the full upload flow and mirrors the served url", async () => {
    renderSection()
    const input = document.querySelector("input[type=file]") as HTMLInputElement
    const file = makeImageFile()
    Object.defineProperty(input, "files", { value: [file], configurable: true })
    fireEvent.change(input)

    await waitFor(() => expect(generateUploadUrlMock).toHaveBeenCalledWith({}))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.com/upload-url",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "image/jpeg" },
          body: file,
        })
      )
    )
    await waitFor(() =>
      expect(setMyAvatarMock).toHaveBeenCalledWith({ storageId: "kg123" })
    )
    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith({
        image: "https://example.com/avatar/served.jpg",
      })
    )
  })

  it("an oversized file shows tooLarge and uploads nothing", async () => {
    renderSection()
    const input = document.querySelector("input[type=file]") as HTMLInputElement
    const file = makeImageFile({ size: 6 * 1024 * 1024 })
    Object.defineProperty(input, "files", { value: [file], configurable: true })
    fireEvent.change(input)
    await waitFor(() => expect(screen.getByText(t.tooLarge)).toBeDefined())
    expect(generateUploadUrlMock).not.toHaveBeenCalled()
    expect(setMyAvatarMock).not.toHaveBeenCalled()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it("a non-image file shows invalidType and uploads nothing", async () => {
    renderSection()
    const input = document.querySelector("input[type=file]") as HTMLInputElement
    const file = makeImageFile({ type: "application/pdf" })
    Object.defineProperty(input, "files", { value: [file], configurable: true })
    fireEvent.change(input)
    await waitFor(() => expect(screen.getByText(t.invalidType)).toBeDefined())
    expect(generateUploadUrlMock).not.toHaveBeenCalled()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it("a failed upload shows the error and does not call setMyAvatar", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ storageId: "" }),
    })
    renderSection()
    const input = document.querySelector("input[type=file]") as HTMLInputElement
    const file = makeImageFile()
    Object.defineProperty(input, "files", { value: [file], configurable: true })
    fireEvent.change(input)
    await waitFor(() => expect(screen.getByText(t.error)).toBeDefined())
    expect(setMyAvatarMock).not.toHaveBeenCalled()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it("the remove button calls removeMyAvatar and mirrors an empty image", async () => {
    useSession.mockReturnValue({
      data: {
        user: {
          name: "Jane Doe",
          email: "jane@example.com",
          image: "https://example.com/avatar/current.jpg",
        },
      },
    })
    renderSection()
    fireEvent.click(screen.getByRole("button", { name: t.remove }))
    await waitFor(() => expect(removeMyAvatarMock).toHaveBeenCalledWith({}))
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ image: "" }))
  })
})
