"use client"

import { useState } from "react"

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024

// Headless upload flow shared by the user avatar and the org logo: client-side
// validation (type + size), object-URL preview, generate-url -> POST blob ->
// apply (server validates + stores) -> optional mirror -> revoke preview. The
// caller supplies the surface-specific Convex bindings; this owns the flow.
export function useImageUpload(opts: {
  generateUploadUrl: () => Promise<string>
  setImage: (storageId: string) => Promise<string>
  removeImage: () => Promise<void>
  onMirror?: (url: string | null) => Promise<void>
  labels: { invalidType: string; tooLarge: string; error: string }
  maxBytes?: number
}) {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function selectFile(file: File) {
    setError(null)
    if (!file.type.startsWith("image/")) {
      setError(opts.labels.invalidType)
      return
    }
    if (file.size > maxBytes) {
      setError(opts.labels.tooLarge)
      return
    }
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
    setIsUploading(true)
    try {
      const uploadUrl = await opts.generateUploadUrl()
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      })
      if (!res.ok) throw new Error("upload failed")
      const { storageId } = await res.json()
      const served = await opts.setImage(storageId)
      if (opts.onMirror) await opts.onMirror(served)
    } catch {
      setError(opts.labels.error)
    } finally {
      URL.revokeObjectURL(objectUrl)
      setPreviewUrl(null)
      setIsUploading(false)
    }
  }

  async function remove() {
    setError(null)
    setIsRemoving(true)
    try {
      await opts.removeImage()
      if (opts.onMirror) await opts.onMirror(null)
    } catch {
      setError(opts.labels.error)
    } finally {
      setIsRemoving(false)
    }
  }

  return { previewUrl, isUploading, isRemoving, error, selectFile, remove }
}
