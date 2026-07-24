// Pure derivation of the overview's band-distribution card from the same
// getResults query the /work band views read (no stored aggregate, like
// buildTodo/buildOverviewStats). One entry per model band, in band order
// (Band 1 highest, ascending), zero-filled so an empty band still renders a
// (zero-height) bar rather than shifting the others.
export type BandCount = { band: number; count: number }
export type BandOverview = {
  totalRoles: number
  bandCount: number
  bandCounts: BandCount[]
}

export type BandOverviewInput = {
  rows: { band: number | null }[]
  bands: { band: number }[]
}

// null when there is nothing to chart yet: no bands configured (no model),
// or no role has resolved a band (no results yet). The overview omits the
// card entirely in that case rather than rendering an empty/misleading chart.
export function buildBandOverview(
  input: BandOverviewInput
): BandOverview | null {
  if (input.bands.length === 0) return null

  const bandCounts: BandCount[] = [...input.bands]
    .sort((a, b) => a.band - b.band)
    .map((b) => ({
      band: b.band,
      count: input.rows.filter((r) => r.band === b.band).length,
    }))

  const totalRoles = bandCounts.reduce((sum, c) => sum + c.count, 0)
  if (totalRoles === 0) return null

  const bandCount = bandCounts.filter((c) => c.count > 0).length
  return { totalRoles, bandCount, bandCounts }
}
