"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useAction, useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { useRef, useState } from "react"
import { authClient } from "@/lib/auth-client"

const MAX_SIZE = 5 * 1024 * 1024

// Clickable avatar that lets the signed-in user upload or remove their profile
// picture. The Avatar itself is the click target; a hidden file input is
// triggered on click. A small X button appears when an image is present.
// Client validation rejects files that are too large or non-image; an inline
// error message is shown and no upload is attempted. A local object URL is
// shown as a preview while the upload is in flight; the URL is revoked when the
// request settles to avoid memory leaks.
export function AvatarUpload() {
  const t = useTranslations("dashboard.account.profile.avatar")
  const { data: session } = authClient.useSession()
  const generateAvatarUploadUrl = useMutation(
    api.accounts.account.generateAvatarUploadUrl
  )
  // setMyAvatar is an action (it validates and deletes a rejected upload's blob,
  // which a transactional mutation cannot do), so it is called via useAction.
  const setMyAvatar = useAction(api.accounts.account.setMyAvatar)
  const removeMyAvatar = useMutation(api.accounts.account.removeMyAvatar)

  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sessionImage = session?.user?.image ?? null
  const name = session?.user?.name ?? ""
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()

  const displayImage = previewUrl ?? sessionImage ?? undefined
  const hasImage = !!(previewUrl ?? sessionImage)
  const isBusy = isUploading || isRemoving

  function handleClick() {
    if (!isBusy) {
      inputRef.current?.click()
    }
  }

  async function handleChange(evt: React.ChangeEvent<HTMLInputElement>) {
    const file = evt.target.files?.[0]
    // Reset input value so the same file can be re-selected after removal
    if (inputRef.current) {
      inputRef.current.value = ""
    }
    if (!file) return

    setError(null)

    if (!file.type.startsWith("image/")) {
      setError(t("invalidType"))
      return
    }
    if (file.size > MAX_SIZE) {
      setError(t("tooLarge"))
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
    setIsUploading(true)

    try {
      const uploadUrl = await generateAvatarUploadUrl({})
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      })
      if (!res.ok) throw new Error("upload failed")
      const { storageId } = await res.json()
      const served = await setMyAvatar({ storageId })
      await authClient.updateUser({ image: served })
    } catch {
      setError(t("error"))
    } finally {
      URL.revokeObjectURL(objectUrl)
      setPreviewUrl(null)
      setIsUploading(false)
    }
  }

  async function handleRemove(e: React.MouseEvent) {
    e.stopPropagation()
    setError(null)
    setIsRemoving(true)
    try {
      await removeMyAvatar({})
      await authClient.updateUser({ image: "" })
    } catch {
      setError(t("error"))
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="relative">
        <Avatar
          key={displayImage ?? "no-avatar"}
          className="size-20 cursor-pointer"
          onClick={handleClick}
        >
          {isBusy ? (
            <AvatarFallback>
              <Spinner className="size-6" />
            </AvatarFallback>
          ) : (
            <>
              {displayImage != null && (
                <AvatarImage src={displayImage} alt={name} />
              )}
              <AvatarFallback>{initials}</AvatarFallback>
            </>
          )}
        </Avatar>

        {hasImage && !isBusy && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label={t("remove")}
            className="absolute -top-1 -right-1 size-6 rounded-full border border-border"
            onClick={handleRemove}
          >
            <HugeiconsIcon
              icon={Cancel01Icon}
              strokeWidth={2}
              className="size-3"
            />
          </Button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {error != null && <p className="text-destructive text-sm">{error}</p>}
    </div>
  )
}
