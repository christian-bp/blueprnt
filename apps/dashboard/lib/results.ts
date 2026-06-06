// Distribution of complete roles over the model's bands (incomplete roles
// have band null and are excluded). Pure helper so it stays unit-testable.
export function bandCounts(
  bands: { band: number }[],
  rows: { band: number | null }[]
): { band: number; count: number }[] {
  return bands.map(({ band }) => ({
    band,
    count: rows.filter((row) => row.band === band).length,
  }))
}
