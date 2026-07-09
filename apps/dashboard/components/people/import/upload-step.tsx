"use client"

import { Cancel01Icon, Csv01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { ImportFormatError, tokenizeCsv } from "@workspace/import"
import { Button } from "@workspace/ui/components/button"
import { Progress } from "@workspace/ui/components/progress"
import { Spinner } from "@workspace/ui/components/spinner"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { FileDropzone } from "@/components/file-dropzone"
import type { ParsedCsv } from "./import-wizard"

// Accepts a raw CSV text string, validates it, and returns either a ParsedCsv
// result or an error key. Kept as a named export so tests can call it directly
// without rendering the component.
export function handleCsvText(
  text: string
):
  | { ok: true; parsed: ParsedCsv }
  | { ok: false; error: "errorEmpty" | "errorNotCsv" | "errorInvalidFormat" } {
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    return { ok: false, error: "errorEmpty" }
  }
  let parsed: ParsedCsv
  try {
    const tokenized = tokenizeCsv(text)
    parsed = {
      headers: tokenized.headers,
      rows: tokenized.rows,
      headerless: tokenized.signals.headerless,
    }
  } catch (err) {
    if (err instanceof ImportFormatError) {
      return { ok: false, error: "errorInvalidFormat" }
    }
    throw err
  }
  if (parsed.headers.length === 0) {
    return { ok: false, error: "errorEmpty" }
  }
  if (parsed.rows.length === 0) {
    return { ok: false, error: "errorEmpty" }
  }
  return { ok: true, parsed }
}

/** Human-readable file size for the file card's meta line. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function UploadStep({
  parsed,
  fileName,
  fileSize,
  onParsed,
  onClear,
}: {
  parsed: ParsedCsv | null
  /** Name of the successfully uploaded file (null before the first upload). */
  fileName: string | null
  /** Size in bytes of the uploaded file (null before the first upload). */
  fileSize: number | null
  onParsed: (
    result: ParsedCsv,
    csvText: string,
    file: { name: string; size: number }
  ) => void
  /** Remove the uploaded file and reset everything derived from it. */
  onClear: () => void
}) {
  const t = useTranslations("dashboard.people.import.upload")
  const [error, setError] = useState<
    "errorEmpty" | "errorNotCsv" | "errorInvalidFormat" | null
  >(null)
  // The in-flight read: drives the uploading card (spinner + progress bar).
  const [reading, setReading] = useState<{
    name: string
    size: number
    progress: number
  } | null>(null)

  // Format-specific validation stays here; FileDropzone owns the drop/click
  // mechanics and hands us the picked file. The FileReader progress events
  // drive an honest progress bar (instant for small files).
  function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setError("errorNotCsv")
      return
    }
    setError(null)
    setReading({ name: file.name, size: file.size, progress: 0 })
    const reader = new FileReader()
    reader.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        const progress = Math.round((e.loaded / e.total) * 100)
        setReading((prev) => (prev === null ? prev : { ...prev, progress }))
      }
    }
    reader.onerror = () => {
      setReading(null)
      setError("errorEmpty")
    }
    reader.onload = () => {
      setReading(null)
      const text = typeof reader.result === "string" ? reader.result : ""
      const result = handleCsvText(text)
      if (result.ok) {
        setError(null)
        onParsed(result.parsed, text, { name: file.name, size: file.size })
      } else {
        setError(result.error)
      }
    }
    reader.readAsText(file)
  }

  const showCompleted =
    parsed !== null && fileName !== null && reading === null && error === null

  return (
    <div className="flex w-full flex-col gap-4">
      <FileDropzone
        accept=".csv,text/csv"
        onFile={processFile}
        title={t("dropTitle")}
        subtitle={t("browseHint")}
        ariaLabel={t("heading")}
      />

      {/* Uploading card: shown while the file is being read */}
      {reading !== null && (
        <div
          data-testid="uploading-file"
          className="flex flex-col gap-2 rounded-lg border bg-card p-3"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Spinner />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-sm">{reading.name}</p>
              <p className="text-muted-foreground text-xs">
                {t("uploading", { progress: reading.progress })}
              </p>
            </div>
          </div>
          <Progress value={reading.progress} />
        </div>
      )}

      {/* Uploaded file card: name, size + detected shape, and remove */}
      {showCompleted && (
        <div
          data-testid="detected-summary"
          className="flex items-center gap-3 rounded-lg border bg-card p-3"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <HugeiconsIcon
              icon={Csv01Icon}
              size={20}
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-sm">{fileName}</p>
            <p className="text-muted-foreground text-xs">
              {fileSize !== null && `${formatFileSize(fileSize)} · `}
              {t("detected", {
                rows: parsed.rows.length,
                columns: parsed.headers.length,
              })}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={onClear}
            aria-label={t("removeFile", { file: fileName })}
            data-testid="remove-file"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
          </Button>
        </div>
      )}

      {/* Inline error */}
      {error !== null && (
        <p role="alert" className="text-destructive text-sm">
          {t(error)}
        </p>
      )}
    </div>
  )
}
