import { useEffect, useState } from "react"

// Returns a debounced copy of `value` that only updates after `delayMs` of no
// further changes. Used to drive a query off a fast-changing input (e.g. a
// search box) without firing on every keystroke.
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return debounced
}
