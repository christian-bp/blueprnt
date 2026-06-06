// Developer documentation for the flag asset service (not product UI; see
// the layout note on why this page is outside the i18n pipeline).
const SIZES = [
  { dir: "s", dimensions: "16 x 12" },
  { dir: "m", dimensions: "20 x 15" },
  { dir: "l", dimensions: "32 x 24" },
] as const

const EXAMPLES = ["SE", "NO", "DK", "FI"] as const

export default function Page() {
  return (
    <main>
      <h1>blueprnt flags</h1>
      <p>
        Country flag SVGs for the blueprnt apps, served statically with
        immutable caching and open CORS.
      </p>
      <h2>Usage</h2>
      <p>
        <code>
          /flags/{"{size}"}/{"{ISO 3166-1 alpha-2}"}.svg
        </code>
      </p>
      <table cellPadding={6}>
        <thead>
          <tr>
            <th align="left">Size</th>
            <th align="left">Dimensions (px)</th>
            <th align="left">Example</th>
          </tr>
        </thead>
        <tbody>
          {SIZES.map((size) => (
            <tr key={size.dir}>
              <td>
                <code>{size.dir}</code>
              </td>
              <td>{size.dimensions}</td>
              <td>
                <code>{`/flags/${size.dir}/SE.svg`}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Examples</h2>
      <p style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        {EXAMPLES.map((code) => (
          // biome-ignore lint/performance/noImgElement: this page demonstrates the raw asset URLs; app UIs use the Flag component from @workspace/ui/flag
          <img
            key={code}
            src={`/flags/l/${code}.svg`}
            alt={code}
            width={32}
            height={24}
          />
        ))}
      </p>
      <p>
        In app code, use <code>Flag</code> from <code>@workspace/ui/flag</code>,
        which reads <code>NEXT_PUBLIC_FLAGS_URL</code>.
      </p>
    </main>
  )
}
