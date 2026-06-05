// scripts/extract-standard-template.ts
// One-off: dump the standard template source tabs to JSON for hand-curation.
// Usage: bun add -d xlsx && bun scripts/extract-standard-template.ts <path-to-xlsx>
import { readFile } from "node:fs/promises"
import * as XLSX from "xlsx"

const path = process.argv[2]
if (!path)
  throw new Error("usage: bun scripts/extract-standard-template.ts <xlsx>")
const wb = XLSX.read(await readFile(path), { type: "buffer" })
for (const name of ["Vikter & faktorer", "Track"]) {
  const sheet = wb.Sheets[name]
  if (!sheet) {
    console.error(`missing sheet: ${name} (found: ${wb.SheetNames.join(", ")})`)
    continue
  }
  console.log(`=== ${name} ===`)
  console.log(
    JSON.stringify(XLSX.utils.sheet_to_json(sheet, { header: 1 }), null, 2)
  )
}
