// Inclusive epoch-ms day bounds for a picked date, in the viewer's local time
// zone. The audit-log range filter is inclusive on `_creationTime`, so a picked
// "to" date should cover the whole day (up to 23:59:59.999), and a picked
// "from" date should start at 00:00:00.000.
export function startOfDay(date: Date): number {
  const x = new Date(date)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

export function endOfDay(date: Date): number {
  const x = new Date(date)
  x.setHours(23, 59, 59, 999)
  return x.getTime()
}
