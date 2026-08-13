import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import type { ComponentProps } from "react"

// A submit button that shows a spinner overlay (and disables) while a form is
// submitting, without reflow: the label stays in place but goes invisible and
// the spinner sits on top. Reusable across forms.
export function SubmitButton({
  children,
  isSubmitting,
  disabled,
  variant,
  className,
  ...props
}: ComponentProps<typeof Button> & { isSubmitting: boolean }) {
  return (
    // type="submit" by default: the vendor Button defaults to type="button",
    // so a SubmitButton inside a form would otherwise never submit it unless
    // every call site remembered to say so. Callers can still override via
    // the spread (e.g. a click-driven action outside a form).
    <Button
      type="submit"
      disabled={isSubmitting || disabled}
      variant={variant}
      className={cn("relative", className)}
      {...props}
    >
      <span
        className={cn(
          "inline-flex items-center gap-[inherit]",
          isSubmitting && "invisible"
        )}
      >
        {children}
      </span>
      {isSubmitting && (
        <div className="absolute inset-0 flex items-center justify-center">
          {/* The Spinner inherits the Button's per-variant text color via
              currentColor, so no explicit color is needed. */}
          <Spinner />
        </div>
      )}
    </Button>
  )
}
