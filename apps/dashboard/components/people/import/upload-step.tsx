"use client"

import { ImportFormatError, tokenizeCsv } from "@workspace/import"
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
    parsed = tokenizeCsv(text)
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

export function UploadStep({
  parsed,
  onParsed,
}: {
  parsed: ParsedCsv | null
  onParsed: (result: ParsedCsv, csvText: string) => void
}) {
  const t = useTranslations("dashboard.people.import.upload")
  const [error, setError] = useState<
    "errorEmpty" | "errorNotCsv" | "errorInvalidFormat" | null
  >(null)

  // Format-specific validation stays here; FileDropzone owns the drop/click
  // mechanics and hands us the picked file.
  function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setError("errorNotCsv")
      return
    }
    file
      .text()
      .then((text) => {
        const result = handleCsvText(text)
        if (result.ok) {
          setError(null)
          onParsed(result.parsed, text)
        } else {
          setError(result.error)
        }
      })
      .catch(() => {
        setError("errorEmpty")
      })
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <FileDropzone
        accept=".csv,text/csv"
        onFile={processFile}
        title={t("dropTitle")}
        subtitle={t("browseHint")}
        ariaLabel={t("heading")}
      />

      {/* Inline error */}
      {error !== null && (
        <p role="alert" className="text-destructive text-sm">
          {t(error)}
        </p>
      )}

      {/* Detection summary: shown when a file has been successfully parsed */}
      {parsed !== null && error === null && (
        <p
          className="text-muted-foreground text-sm"
          data-testid="detected-summary"
        >
          {t("detected", {
            rows: parsed.rows.length,
            columns: parsed.headers.length,
          })}
        </p>
      )}
    </div>
  )
}
