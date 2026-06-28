"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useAction, useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { AvatarUpload } from "@/components/avatar-upload"
import { useImageUpload } from "@/hooks/use-image-upload"
import { authClient } from "@/lib/auth-client"

// Profile picture section for the account profile tab. Owns the account-specific
// bindings (Convex avatar functions + the Better Auth image mirror) and renders
// the shared AvatarUpload via the shared useImageUpload hook.
export function AvatarSection() {
  const t = useTranslations("dashboard.account.profile.avatar")
  const { data: session } = authClient.useSession()
  const generateUploadUrl = useMutation(api.files.generateImageUploadUrl)
  // setMyAvatar is an action (it validates and deletes a rejected upload's blob,
  // which a transactional mutation cannot do), so it is called via useAction.
  const setMyAvatar = useAction(api.accounts.account.setMyAvatar)
  const removeMyAvatar = useMutation(api.accounts.account.removeMyAvatar)

  const upload = useImageUpload({
    generateUploadUrl: () => generateUploadUrl({}),
    // The storage id from the upload response is a valid _storage id string;
    // Convex's generated arg type is the branded Id, so narrow it here.
    setImage: (storageId) =>
      setMyAvatar({ storageId: storageId as Id<"_storage"> }),
    removeImage: async () => {
      await removeMyAvatar({})
    },
    onMirror: async (url) => {
      await authClient.updateUser({ image: url ?? "" })
    },
    labels: {
      invalidType: t("invalidType"),
      tooLarge: t("tooLarge"),
      error: t("error"),
    },
  })

  const name = session?.user?.name ?? ""
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase()

  return (
    <Card>
      <div className="flex items-start justify-between gap-8">
        <CardHeader className="flex-1">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <div className="pt-6 pr-6">
          <AvatarUpload
            imageUrl={session?.user?.image ?? null}
            fallback={initials}
            alt={name}
            previewUrl={upload.previewUrl}
            isUploading={upload.isUploading}
            isRemoving={upload.isRemoving}
            error={upload.error}
            onSelectFile={upload.selectFile}
            onRemove={upload.remove}
            removeLabel={t("remove")}
          />
        </div>
      </div>
      <CardFooter className="text-muted-foreground text-sm">
        {t("helper")}
      </CardFooter>
    </Card>
  )
}
