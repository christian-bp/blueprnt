import { ChartLegend } from "./chart-legend"
import { PointShapeIcon } from "./point-mark"

// The key for a chart whose marks stand for JOBS. One chip per job, in the
// hue its points wear, so no hue ever appears on the plot without something
// naming it. The chip is the same filled circle the plot draws, not a square
// swatch: a key shows the object its chart shows.
//
// It runs ACROSS rather than down, unlike a two-series gender key: this one
// is as long as the comparison is, and six jobs stacked vertically push the
// chart's own findings off the screen.
export function RoleLegend({
  items,
}: {
  items: {
    id: string
    label: string
    color: string
    hidden?: boolean
    onToggle?: () => void
    toggleDisabled?: boolean
  }[]
}) {
  return (
    <ChartLegend
      layout="row"
      items={items.map((item) => ({
        id: item.id,
        label: item.label,
        ...(item.hidden === undefined ? {} : { hidden: item.hidden }),
        ...(item.onToggle === undefined ? {} : { onToggle: item.onToggle }),
        ...(item.toggleDisabled === undefined
          ? {}
          : { toggleDisabled: item.toggleDisabled }),
        mark: <PointShapeIcon shape="circle" fill={item.color} />,
      }))}
    />
  )
}
