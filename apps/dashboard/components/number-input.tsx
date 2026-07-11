import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import type { ComponentProps } from "react"

// The standard numeric field: a type="number" Input with the browser's up/down
// spinner buttons hidden (they invite misclicks and do not fit our forms). The
// numeric type still gives the numeric keyboard and valueAsNumber parsing; bind
// the value with numberInputField (@/lib/number-field) for NaN-safe handling.
// An app primitive so every numeric field reads and behaves the same.
export function NumberInput({
  className,
  ...props
}: ComponentProps<typeof Input>) {
  return (
    <Input
      type="number"
      className={cn(
        // Hide the spinners in WebKit/Blink and Firefox.
        "[appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none",
        className
      )}
      {...props}
    />
  )
}
