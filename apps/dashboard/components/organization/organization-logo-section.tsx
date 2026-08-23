"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { SettingsFrame, SettingsRow } from "@/components/settings-frame"
import { useAction, useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import { toast } from "@/lib/toast"
import { AvatarUpload } from "@/components/avatar-upload"
import { useOrganization } from "@/components/org-context"
import { useImageUpload } from "@/hooks/use-image-upload"
import { initialsOf } from "@/lib/initials"

// Org logo section for the General tab. Owns the org-specific Convex bindings
// (admin-gated set/remove) and renders the shared AvatarUpload via the shared
// useImageUpload hook. The current logo url is passed in (the page fetches the
// org settings once) so the section does not re-query.
export function OrganizationLogoSection(props: { imageUrl: string | null }) {
  const t = useTranslations("dashboard.organization.logo")
  const tToast = useTranslations("dashboard.toast")
  const { orgId, name } = useOrganization()
  const generateUploadUrl = useMutation(api.files.generateImageUploadUrl)
  const setOrgAvatar = useAction(api.accounts.organization.setOrgAvatar)
  const removeOrgAvatar = useMutation(api.accounts.organization.removeOrgAvatar)

  const upload = useImageUpload({
    generateUploadUrl: () => generateUploadUrl({}),
    // The storage id from the upload response is a valid _storage id string;
    // Convex's generated arg type is the branded Id, so narrow it here.
    setImage: async (storageId) => {
      const url = await setOrgAvatar({
        orgId,
        storageId: storageId as Id<"_storage">,
      })
      toast.success(tToast("logoUpdated"))
      return url
    },
    removeImage: async () => {
      await removeOrgAvatar({ orgId })
      toast.success(tToast("logoRemoved"))
    },
    labels: {
      invalidType: t("invalidType"),
      tooLarge: t("tooLarge"),
      error: t("error"),
    },
  })

  const initials = initialsOf(name)

  return (
    <SettingsFrame title={t("title")}>
      <SettingsRow
        align="center"
        label={t("description")}
        description={t("helper")}
      >
        <AvatarUpload
          imageUrl={props.imageUrl}
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
      </SettingsRow>
    </SettingsFrame>
  )
}
