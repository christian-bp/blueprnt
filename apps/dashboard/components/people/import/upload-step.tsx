"use client"

import {
  Alert02Icon,
  Cancel01Icon,
  Csv01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { ImportFormatError, tokenizeCsv } from "@workspace/import"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@workspace/ui/components/attachment"
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

// OLE2 compound-file magic (legacy .xls). The tokenizer's binary guard cannot
// catch this: reading the file as UTF-8 text mangles these bytes to U+FFFD, so
// ADR-0010 defers the OLE2 sniff to the consumer layer. We do it here, on the
// raw bytes, before decoding, so a legacy .xls renamed to .csv fails with a
// clear "wrong format" message instead of a confusing "missing columns" error.
// (ZIP/XLSX/ODS is caught in the tokenizer: its PK\x03\x04 magic is ASCII and
// survives the UTF-8 decode.)
const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]

// True when the file's leading bytes are the OLE2 signature. Pure over the byte
// prefix so it is unit-testable without a File/FileReader.
export function isOle2Signature(head: Uint8Array): boolean {
  if (head.length < OLE2_MAGIC.length) return false
  return OLE2_MAGIC.every((byte, index) => head[index] === byte)
}

/** Human-readable file size for the file card's meta line. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// What the file card shows, per state. A discriminated union rather than a set
// of loose booleans, so a state, its test hook and its copy cannot drift apart,
// and a missing field is a compile error.
type UploadCard =
  | {
      state: "uploading"
      testId: "uploading-file"
      title: string
      description: string
      progress: number
    }
  | {
      state: "error"
      testId: "rejected-file"
      title: string
      description: string
    }
  | {
      state: "done"
      testId: "detected-summary"
      title: string
      description: string
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
  // Name of the file that was refused, so the error card can say which file it
  // was. Held separately from `error` because a rejection can happen before any
  // read starts, so `reading` is not set on those paths.
  const [rejected, setRejected] = useState<{ name: string } | null>(null)

  // Every rejection records the offending file's name alongside the code, so the
  // card can name it.
  function fail(
    file: File,
    code: "errorEmpty" | "errorNotCsv" | "errorInvalidFormat"
  ) {
    setRejected({ name: file.name })
    setError(code)
  }

  // Format-specific validation stays here; FileDropzone owns the drop/click
  // mechanics and hands us the picked file. The FileReader progress events
  // drive an honest progress bar (instant for small files).
  async function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      fail(file, "errorNotCsv")
      return
    }
    setError(null)
    setRejected(null)
    // Sniff the raw leading bytes for the OLE2 (legacy .xls) magic before
    // decoding as text: UTF-8 decoding would destroy the signature, so a
    // renamed .xls would otherwise slip past the tokenizer's binary guard and
    // fail later with a confusing "missing columns" error (ADR-0010).
    const head = new Uint8Array(
      await file.slice(0, OLE2_MAGIC.length).arrayBuffer()
    )
    if (isOle2Signature(head)) {
      fail(file, "errorInvalidFormat")
      return
    }
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
      fail(file, "errorEmpty")
    }
    reader.onload = () => {
      setReading(null)
      const text = typeof reader.result === "string" ? reader.result : ""
      const result = handleCsvText(text)
      if (result.ok) {
        setError(null)
        setRejected(null)
        onParsed(result.parsed, text, { name: file.name, size: file.size })
      } else {
        fail(file, result.error)
      }
    }
    reader.readAsText(file)
  }

  // A read in flight wins, otherwise a parsed file with no error. Checking
  // `parsed` and `fileName` inline rather than via a precomputed boolean is what
  // narrows them to non-null for the done arm.
  const card: UploadCard | null =
    reading !== null
      ? {
          state: "uploading",
          testId: "uploading-file",
          title: reading.name,
          description: t("uploading", { progress: reading.progress }),
          progress: reading.progress,
        }
      : error !== null
        ? {
            state: "error",
            testId: "rejected-file",
            title: rejected?.name ?? "",
            description: t(error),
          }
        : parsed !== null && fileName !== null
          ? {
              state: "done",
              testId: "detected-summary",
              title: fileName,
              description: `${
                fileSize !== null ? `${formatFileSize(fileSize)} · ` : ""
              }${t("detected", {
                rows: parsed.rows.length,
                columns: parsed.headers.length,
              })}`,
            }
          : null

  return (
    <div className="flex w-full flex-col gap-4">
      <FileDropzone
        accept=".csv,text/csv"
        onFile={processFile}
        title={t("dropTitle")}
        subtitle={t("browseHint")}
        ariaLabel={t("heading")}
      />

      {card !== null && (
        <Attachment
          state={card.state}
          className="w-full"
          data-testid={card.testId}
        >
          <AttachmentMedia>
            {card.state === "uploading" ? (
              <Spinner />
            ) : card.state === "error" ? (
              <HugeiconsIcon
                icon={Alert02Icon}
                strokeWidth={2}
                aria-hidden="true"
              />
            ) : (
              <HugeiconsIcon
                icon={Csv01Icon}
                size={20}
                strokeWidth={1.5}
                aria-hidden="true"
              />
            )}
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{card.title}</AttachmentTitle>
            <AttachmentDescription
              role={card.state === "error" ? "alert" : undefined}
            >
              {card.description}
            </AttachmentDescription>
          </AttachmentContent>
          {card.state === "done" && (
            <AttachmentActions>
              <AttachmentAction
                onClick={onClear}
                aria-label={t("removeFile", { file: card.title })}
                data-testid="remove-file"
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              </AttachmentAction>
            </AttachmentActions>
          )}
          {/* basis-full: the Attachment root is flex-wrap, so this puts the bar
              on its own row inside the card instead of below it. */}
          {card.state === "uploading" && (
            <Progress value={card.progress} className="basis-full" />
          )}
        </Attachment>
      )}
    </div>
  )
}
