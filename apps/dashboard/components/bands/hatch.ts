// The diagonal-hatch fill for empty bands (ladder) and empty cells (matrix).
//
// The `background-size` is the load-bearing part. It pins the gradient to one
// spatial period of the -60deg, 6px-period pattern: 6px / sin(60deg) = 4*sqrt(3)
// = 6.9282px on x, 6px / cos(60deg) = 12px on y. One full period on each axis,
// so the diagonal lines join seamlessly across both tile edges.
//
// Without the fixed size, WebKit samples the repeating gradient across the whole
// paint box and normalizes the 1px line over the box's projected length, so in a
// tall cell the line is under-sampled and the hatch renders sparse and faint
// (Safari only; WebKit #94795). Pinning the size makes WebKit rasterize one
// small, well-sampled tile and repeat it, which is height-independent. Blink
// (Chrome) never had the problem. var(--border) keeps the hatch theme-aware.
export const HATCH_CLASS =
  "bg-[repeating-linear-gradient(-60deg,var(--border),var(--border)_1px,transparent_1px,transparent_6px)] [background-size:6.9282px_12px]"
