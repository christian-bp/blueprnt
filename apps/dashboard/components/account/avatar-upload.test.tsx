import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import en from "@workspace/i18n/messages/en.json"

// --- Convex hook mocks (vi.hoisted so they are defined before vi.mock) ---
// useMutation is discriminated by the api reference passed to it so reordering
// hooks cannot silently mis-route. useAction always returns the setMyAvatar mock
// (setMyAvatar is an action because it validates and deletes rejected blobs).
const { generateAvatarUploadUrlMock, setMyAvatarMock, removeMyAvatarMock } =
  vi.hoisted(() => {
    const generateAvatarUploadUrlMock = vi.fn(
      async () => "https://example.com/upload-url"
    )
    const setMyAvatarMock = vi.fn(
      async (_args: { storageId: string }) =>
        "https://example.com/avatar/served.jpg"
    )
    const removeMyAvatarMock = vi.fn(async () => null)
    return {
      generateAvatarUploadUrlMock,
      setMyAvatarMock,
      removeMyAvatarMock,
    }
  })

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    accounts: {
      account: {
        generateAvatarUploadUrl: "accounts.account.generateAvatarUploadUrl",
        setMyAvatar: "accounts.account.setMyAvatar",
        removeMyAvatar: "accounts.account.removeMyAvatar",
      },
    },
  },
}))

vi.mock("convex/react", () => ({
  useMutation: (ref: string) => {
    if (ref === "accounts.account.generateAvatarUploadUrl")
      return generateAvatarUploadUrlMock
    if (ref === "accounts.account.removeMyAvatar") return removeMyAvatarMock
    return vi.fn()
  },
  useAction: () => setMyAvatarMock,
}))

// --- Auth-client mock ---
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

// --- global.fetch mock ---
const fetchMock = vi.fn(async () => ({
  ok: true,
  json: async () => ({ storageId: "kg123" }),
}))
vi.stubGlobal("fetch", fetchMock)

// --- URL.createObjectURL / revokeObjectURL stubs ---
vi.stubGlobal(
  "URL",
  Object.assign(URL, {
    createObjectURL: vi.fn(() => "blob:fake-preview-url"),
    revokeObjectURL: vi.fn(),
  })
)

import { AvatarUpload } from "./avatar-upload"

const t = en.dashboard.account.profile.avatar

function renderUpload() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AvatarUpload />
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

describe("AvatarUpload", () => {
  beforeEach(() => {
    generateAvatarUploadUrlMock.mockResolvedValue(
      "https://example.com/upload-url"
    )
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

  it("selecting a valid image runs the full upload flow", async () => {
    renderUpload()

    const input = document.querySelector("input[type=file]") as HTMLInputElement
    const file = makeImageFile()

    Object.defineProperty(input, "files", { value: [file], configurable: true })
    fireEvent.change(input)

    await waitFor(() => {
      expect(generateAvatarUploadUrlMock).toHaveBeenCalledWith({})
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.com/upload-url",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "image/jpeg" },
          body: file,
        })
      )
    })

    await waitFor(() => {
      expect(setMyAvatarMock).toHaveBeenCalledWith({ storageId: "kg123" })
    })

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({
        image: "https://example.com/avatar/served.jpg",
      })
    })
  })

  it("an oversized file shows tooLarge error and uploads nothing", async () => {
    renderUpload()

    const input = document.querySelector("input[type=file]") as HTMLInputElement
    const file = makeImageFile({ size: 6 * 1024 * 1024 })

    Object.defineProperty(input, "files", { value: [file], configurable: true })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByText(t.tooLarge)).toBeDefined()
    })

    expect(generateAvatarUploadUrlMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(setMyAvatarMock).not.toHaveBeenCalled()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it("a non-image file shows invalidType error and uploads nothing", async () => {
    renderUpload()

    const input = document.querySelector("input[type=file]") as HTMLInputElement
    const file = makeImageFile({ type: "application/pdf" })

    Object.defineProperty(input, "files", { value: [file], configurable: true })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByText(t.invalidType)).toBeDefined()
    })

    expect(generateAvatarUploadUrlMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(setMyAvatarMock).not.toHaveBeenCalled()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it("a failed upload shows the error message and does not call setMyAvatar", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ storageId: "" }),
    })

    renderUpload()

    const input = document.querySelector("input[type=file]") as HTMLInputElement
    const file = makeImageFile()

    Object.defineProperty(input, "files", { value: [file], configurable: true })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByText(t.error)).toBeDefined()
    })

    expect(setMyAvatarMock).not.toHaveBeenCalled()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it("the remove button calls removeMyAvatar and updateUser with empty image", async () => {
    // Render with an existing image so the remove button is visible
    useSession.mockReturnValue({
      data: {
        user: {
          name: "Jane Doe",
          email: "jane@example.com",
          image: "https://example.com/avatar/current.jpg",
        },
      },
    })

    renderUpload()

    const removeBtn = screen.getByRole("button", { name: t.remove })
    fireEvent.click(removeBtn)

    await waitFor(() => {
      expect(removeMyAvatarMock).toHaveBeenCalledWith({})
    })

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({ image: "" })
    })
  })
})
