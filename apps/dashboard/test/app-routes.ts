import { readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

// Static app routes from the app directory: route groups unwrap, dynamic
// segments are excluded (docs and the assistant prompt never link to a
// specific entity).
export function collectStaticAppRoutes(): Set<string> {
  const appDir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../app"
  )
  const routes = new Set<string>()
  const walk = (dir: string, url: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        if (entry.name === "page.tsx") routes.add(url === "" ? "/" : url)
        continue
      }
      if (entry.name.startsWith("[")) continue
      if (entry.name.startsWith("(")) walk(path.join(dir, entry.name), url)
      else walk(path.join(dir, entry.name), `${url}/${entry.name}`)
    }
  }
  walk(appDir, "")
  return routes
}
