"use client"

import { CloudUploadIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"
import { useRef, useState } from "react"

// A reusable drag-and-drop / click-to-browse file picker. Owns the drop-zone
// chrome, drag-over state, hidden <input>, and keyboard activation; the caller
// supplies the copy (title/subtitle) and a single onFile handler that receives
// the first dropped or selected file. Validation and parsing stay with the
// caller so the zone is format-agnostic and reusable (CSV import, avatar, etc.).
export function FileDropzone({
  accept,
  onFile,
  title,
  subtitle,
  ariaLabel,
  className,
}: {
  accept?: string
  onFile: (file: File) => void
  title: string
  subtitle: string
  // Region label for assistive tech; falls back to the visible title.
  ariaLabel?: string
  className?: string
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function openPicker() {
    inputRef.current?.click()
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file === undefined) return
    onFile(file)
    // Reset so re-selecting the same file re-triggers the handler.
    e.target.value = ""
  }

  function handleDrop(e: React.DragEvent<HTMLElement>) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file === undefined) return
    onFile(file)
  }

  return (
    // <section> with aria-label gives the region role without an explicit role
    // attribute (satisfies Biome a11y/useSemanticElements).
    <section
      aria-label={ariaLabel ?? title}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          openPicker()
        }
      }}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the whole zone is the interactive element
      tabIndex={0}
      className={cn(
        "flex w-full cursor-pointer flex-col items-center gap-4 rounded-xl border-2 border-dashed px-8 py-12 text-center transition-colors",
        isDragOver
          ? "border-brand bg-brand/5"
          : "border-border hover:border-brand/40 hover:bg-brand/10",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={handleChange}
        aria-hidden="true"
        tabIndex={-1}
      />
      <HugeiconsIcon
        icon={CloudUploadIcon}
        size={40}
        strokeWidth={1.5}
        className="text-brand"
      />
      <div className="flex flex-col items-center gap-1">
        <p className="font-semibold text-foreground text-lg">{title}</p>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>
    </section>
  )
}
