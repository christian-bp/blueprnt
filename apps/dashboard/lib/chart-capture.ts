// Rasterizes a live SVG chart into a PNG data URI, so a PDF export can carry
// the app's own shadcn/recharts charts instead of hand-drawn approximations
// (ADR-0026). The pipeline: clone the SVG, inline every paint-relevant
// computed style (which resolves the theme's CSS variables to literal
// values), serialize, decode as an image, and draw it onto a canvas at a
// print-quality scale.
//
// Styles must be inlined because an SVG loaded as an image is a standalone
// document: it cannot see the page's stylesheets, CSS variables, or fonts.
// For the same reason the chart's webfont falls back to the system stack
// inside the raster; the PDF's own type is Helvetica, so the fallback reads
// consistent rather than broken.

// The properties a chart's rendering depends on. Geometry lives in
// attributes (which survive cloning); this list is the styling recharts and
// the shadcn chart CSS apply via classes and variables.
const INLINE_STYLE_PROPS = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "font-family",
  "font-size",
  "font-weight",
  "letter-spacing",
  "text-anchor",
  "dominant-baseline",
  "opacity",
  "color",
] as const

// Computed style bakes the document URL into local references: a pattern
// fill comes back as url("http://host/page#id"). Inside a standalone SVG
// document that absolute form points at an external resource an image is not
// allowed to fetch, so the paint silently disappears; only the fragment form
// resolves. External URLs without a fragment are left alone.
export function stripUrlOrigins(value: string): string {
  return value.replace(/url\((['"]?)[^)#'"]*#/g, "url($1#")
}

// The app's webfont stack (next/font) names only families the page itself
// registers, none of which exist inside a standalone SVG image, and a stack
// with no resolvable family falls all the way back to the browser's serif
// default. Appending the generics keeps the raster's type a sans in the
// document's own Helvetica family.
function withGenericFallback(fontFamily: string): string {
  return `${fontFamily}, Helvetica, Arial, sans-serif`
}

function inlineStyles(source: Element, clone: Element) {
  if (!(clone instanceof SVGElement) && !(clone instanceof HTMLElement)) return
  const computed = window.getComputedStyle(source)
  for (const prop of INLINE_STYLE_PROPS) {
    const value = computed.getPropertyValue(prop)
    if (value === "") continue
    clone.style.setProperty(
      prop,
      prop === "font-family"
        ? withGenericFallback(value)
        : stripUrlOrigins(value)
    )
  }
}

export interface CapturedChart {
  // PNG data URI, rasterized at `scale` times the on-screen size.
  src: string
  // The chart's on-screen CSS pixel size, so the consumer can place the
  // image at the source's proportions.
  width: number
  height: number
}

// Whether this environment can rasterize at all (a real 2d canvas): jsdom
// and headless test environments answer no, and the caller falls back to
// whatever it renders without captures.
export function canRasterizeCharts(): boolean {
  try {
    return document.createElement("canvas").getContext("2d") !== null
  } catch {
    return false
  }
}

export async function captureSvgToPng(
  svg: SVGSVGElement,
  scale = 3,
  decodeTimeoutMs = IMAGE_DECODE_TIMEOUT_MS
): Promise<CapturedChart> {
  const rect = svg.getBoundingClientRect()
  const width = Math.round(rect.width)
  const height = Math.round(rect.height)
  if (width === 0 || height === 0) throw new Error("chart has no size")
  const clone = svg.cloneNode(true) as SVGSVGElement
  // querySelectorAll walks in document order and a deep clone preserves
  // structure, so the two lists pair element-for-element.
  const sources = [svg, ...svg.querySelectorAll("*")]
  const clones = [clone, ...clone.querySelectorAll("*")]
  for (let index = 0; index < sources.length; index++) {
    const source = sources[index]
    const target = clones[index]
    if (source !== undefined && target !== undefined) {
      inlineStyles(source, target)
    }
  }
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  clone.setAttribute("width", String(width))
  clone.setAttribute("height", String(height))
  const markup = new XMLSerializer().serializeToString(clone)
  const image = await loadImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`,
    decodeTimeoutMs
  )
  const canvas = document.createElement("canvas")
  canvas.width = width * scale
  canvas.height = height * scale
  const context = canvas.getContext("2d")
  if (context === null) throw new Error("no 2d canvas context")
  context.scale(scale, scale)
  context.drawImage(image, 0, 0, width, height)
  return { src: canvas.toDataURL("image/png"), width, height }
}

// A delay that holds its length in hidden tabs too: setTimeout there is
// throttled up to a minute per tick (which turned a sub-second capture wait
// into minutes), while MessageChannel messages are ordinary tasks exempt
// from timer throttling. It ticks the message queue until the deadline, so
// it costs task churn only for the wait's real length; `cancelled` lets a
// race's loser stop ticking as soon as the winner settles.
export function unthrottledDelay(
  ms: number,
  cancelled?: () => boolean
): Promise<void> {
  return new Promise((resolve) => {
    const deadline = performance.now() + ms
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      if (cancelled?.() === true || performance.now() >= deadline) {
        channel.port1.close()
        resolve()
      } else {
        channel.port2.postMessage(null)
      }
    }
    channel.port2.postMessage(null)
  })
}

// An export must never await a decode forever: in a fully hidden tab the
// load event can wait for a paint that never comes, which froze an export
// mid-capture. decode() rasterizes off the paint path, so it resolves in
// hidden tabs too; the timeout is the final guard either way (on timeout
// the caller falls back to the vector charts).
const IMAGE_DECODE_TIMEOUT_MS = 5000

function loadImage(src: string, timeoutMs: number): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = src
  let settled = false
  const decoded = image.decode().then(
    () => {
      settled = true
      return image
    },
    (error: unknown) => {
      settled = true
      throw error instanceof Error
        ? error
        : new Error("chart image failed to decode")
    }
  )
  const timeout = unthrottledDelay(timeoutMs, () => settled).then(() => {
    if (!settled) throw new Error("chart image decode timed out")
    return image
  })
  return Promise.race([decoded, timeout])
}
