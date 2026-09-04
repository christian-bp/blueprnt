// The day-precision convention shared by every surface that stores a day as
// epoch ms (an action's planned date, the run's collaboration date): the
// ISO day string the DatePicker binds to maps to UTC midnight, and back.
export function isoToMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00.000Z`)
}

export function msToIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}
