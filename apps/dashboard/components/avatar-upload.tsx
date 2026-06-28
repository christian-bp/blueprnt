"use client"

import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { useRef } from "react"

// Presentational clickable avatar with upload + remove. The Avatar is the click
// target; a hidden file input opens on click and the chosen File is forwarded to
// onSelectFile (the caller's useImageUpload hook validates + uploads). A small X
// removes a present image. Preview/busy/error are driven entirely by props so the
// same component serves the user avatar and the org logo.
export function AvatarUpload(props: {
  imageUrl: string | null
  fallback: string
  alt: string
  previewUrl: string | null
  isUploading: boolean
  isRemoving: boolean
  error: string | null
  onSelectFile: (file: File) => void
  onRemove: () => void
  removeLabel: string
  sizeClassName?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const displayImage = props.previewUrl ?? props.imageUrl ?? undefined
  const hasImage = !!(props.previewUrl ?? props.imageUrl)
  const isBusy = props.isUploading || props.isRemoving

  function handleClick() {
    if (!isBusy) inputRef.current?.click()
  }
  function handleChange(evt: React.ChangeEvent<HTMLInputElement>) {
    const file = evt.target.files?.[0]
    if (inputRef.current) inputRef.current.value = ""
    if (file) props.onSelectFile(file)
  }
  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation()
    props.onRemove()
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="relative">
        <Avatar
          key={displayImage ?? "no-image"}
          className={`${props.sizeClassName ?? "size-20"} cursor-pointer`}
          onClick={handleClick}
        >
          {isBusy ? (
            <AvatarFallback>
              <Spinner />
            </AvatarFallback>
          ) : (
            <>
              {displayImage != null && (
                <AvatarImage src={displayImage} alt={props.alt} />
              )}
              <AvatarFallback>{props.fallback}</AvatarFallback>
            </>
          )}
        </Avatar>

        {hasImage && !isBusy && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label={props.removeLabel}
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
      {props.error != null && (
        <p className="text-destructive text-sm">{props.error}</p>
      )}
    </div>
  )
}
