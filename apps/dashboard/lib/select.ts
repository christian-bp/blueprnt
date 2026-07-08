// Base UI's Select reports a cleared selection as null. Our selects have no
// clear affordance (a value is always chosen), so call sites narrow the
// callback to the non-null case with this wrapper instead of repeating the
// guard at every Select.
export function onSelectValue<T>(handler: (value: T) => unknown) {
  return (value: T | null) => {
    if (value !== null) handler(value)
  }
}
