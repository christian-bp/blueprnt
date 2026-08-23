import { cn } from "@workspace/ui/lib/utils"

// The rail's square brand mark: the "b" letterform cropped out of the wordmark
// (components/logo.tsx, second path) on a primary square. The viewBox is
// tight-cropped to the glyph the same way the wordmark's is, so the letter
// centers optically inside the square. Pass `label` where the mark stands in
// for the product name (the rail's home link); without one it is decorative
// and hidden from assistive tech.
export function BrandMark({
  className,
  label,
}: {
  className?: string
  label?: string
}) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground",
        className
      )}
    >
      {/* viewBox = the glyph's measured bounding box (getBBox: 92.7 183.1
          135.2 201.9) plus a hair of padding, so the letter never clips. */}
      <svg
        viewBox="90 181 140 206"
        className="h-4 w-auto"
        fill="currentColor"
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M147.29,384.55c-38.06-4.16-56.65-34.9-54.45-69.96,2.1-33.5,6.35-65.97,11.67-99.05,1.39-8.62,4.29-16.91,10.01-23.41,9.59-10.9,27.58-12.25,38.47-2.49,11.75,10.52,8.23,36.37,6.25,50.57,27.68-9.79,55.08,4.19,63.97,31.5,6.79,20.86,5.83,42.74-.81,63.88-10.18,32.43-40.45,52.75-75.11,48.96ZM162.68,287.26c-15.54-1.49-18.65,43.71-4.6,43.99,14.74.29,19.16-42.6,4.6-43.99Z" />
      </svg>
    </span>
  )
}
