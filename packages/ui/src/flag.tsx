import type { CSSProperties } from "react"
import { cn } from "@workspace/ui/lib/utils"

// Country flag image served by the flags app (apps/flags). First-party code,
// NOT shadcn vendor (hence it lives outside src/components and is linted and
// tested like any other code).
//
// The service URL comes from NEXT_PUBLIC_FLAGS_URL (the local flags app runs
// on :3002). Pass `alt` with the translated country name from the caller's
// i18n context; it defaults to the bare country code, never English prose.
const FLAG_BASE_URL =
  process.env.NEXT_PUBLIC_FLAGS_URL ?? "http://localhost:3002"

export type FlagSize = "S" | "M" | "L"

const SIZE_CONFIG: Record<
  FlagSize,
  { width: number; height: number; radius: string; shadow: string }
> = {
  S: {
    width: 16,
    height: 12,
    radius: "1px",
    shadow: "0 0 1px 0.5px rgba(0,0,0,0.1)",
  },
  M: {
    width: 20,
    height: 15,
    radius: "1.5px",
    shadow: "0 1px 2px rgba(0,0,0,0.1)",
  },
  L: {
    width: 32,
    height: 24,
    radius: "2px",
    shadow: "0 2px 3px rgba(0,0,0,0.1)",
  },
}

export function Flag({
  code,
  alt,
  size = "L",
  className,
  hasDropShadow = false,
  hasBorder = true,
  hasBorderRadius = true,
}: {
  // ISO 3166-1 alpha-2 country code (case-insensitive).
  code: string
  // Translated country name from the caller's i18n context.
  alt?: string
  size?: FlagSize
  className?: string
  hasDropShadow?: boolean
  hasBorder?: boolean
  hasBorderRadius?: boolean
}) {
  const config = SIZE_CONFIG[size]

  const containerStyle: CSSProperties = {
    display: "inline-block",
    overflow: "hidden",
    position: "relative",
    boxSizing: "border-box",
    width: config.width,
    height: config.height,
    ...(hasBorderRadius && { borderRadius: config.radius }),
    ...(hasDropShadow && { boxShadow: config.shadow }),
  }

  const imgStyle: CSSProperties = {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
  }

  // Subtle inner border drawn as an overlay so it blends with the flag
  // colors instead of framing them.
  const overlayStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
    display: "block",
    boxSizing: "border-box",
    mixBlendMode: "overlay",
    border: "1px solid rgba(0,0,0,0.5)",
    ...(hasBorderRadius && { borderRadius: config.radius }),
  }

  return (
    <div className={cn(className)} style={containerStyle}>
      {/* biome-ignore lint/performance/noImgElement: tiny static SVGs from our own asset service; next/image adds nothing here */}
      <img
        src={`${FLAG_BASE_URL}/flags/${size.toLowerCase()}/${code.toUpperCase()}.svg`}
        alt={alt ?? code}
        style={imgStyle}
        loading="lazy"
      />
      {hasBorder && <div style={overlayStyle} />}
    </div>
  )
}
