#!/usr/bin/env bun
/**
 * Vendor update for the shadcn components in packages/ui.
 *
 * `update`  takes every upstream component, including brand new ones, with the
 *           shadcn CLI, snapshots that pristine output into .vendor/, then
 *           replays the patches in patches/ on top. A patch that no longer
 *           applies stops the run rather than vanishing silently, which is the
 *           whole point: the CLI overwrites all sources unconditionally.
 * `refresh` regenerates every patch from .vendor/ against the current sources.
 *           Run it after resolving a .rej by hand, or after adding a deviation.
 *
 * Patch paths are repository-root relative and `git apply` runs from the root,
 * because git apply run from a subdirectory silently IGNORES patch entries whose
 * paths resolve outside that directory, and still exits 0. Package-relative
 * paths therefore produce a run that reports success and changes nothing.
 */
import { $ } from "bun"
import { existsSync } from "node:fs"
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

const PKG = path.resolve(import.meta.dir, "..")
const ROOT = (await $`git rev-parse --show-toplevel`.cwd(PKG).text()).trim()
const PKG_REL = path.relative(ROOT, PKG)
const SRC_REL = `${PKG_REL}/src/components`
const VENDOR_REL = `${PKG_REL}/.vendor/components`
const SRC = path.join(ROOT, SRC_REL)
const VENDOR = path.join(ROOT, VENDOR_REL)
const PATCHES = path.join(PKG, "patches")

// One line per patch, written as the patch's header. A component that differs
// from upstream without an entry here fails `refresh`, so a deviation cannot
// enter the set without a stated reason.
const DEVIATIONS: Record<string, string> = {
  avatar:
    "A brand variant for identity avatars (brand ring + tinted initials fallback).",
  badge: "A success variant; the email log maps delivered and sent onto it.",
  checkbox:
    "Base UI omits data-checked while indeterminate, so the mixed state needs its own fill and a minus glyph.",
  command:
    "Dialog.Root renders its children open or not, so the accessible header must sit inside DialogContent; beside it, it leaves an sr-only heading in the page on every render.",
  "dropdown-menu":
    "Popup sized to its content; upstream pins it to the trigger width and clips labels.",
  empty: "Brand-tinted icon media instead of neutral.",
  select:
    "Trigger may shrink inside form grids; popup sized to its content for the same clipping reason as the dropdown.",
  spinner:
    "HugeiconsIcon types strokeWidth as a number, so the svg props type must not admit a string.",
  tooltip: "No arrow unless asked for; upstream always draws one.",
}

async function sourceStatus(): Promise<string[]> {
  const status = await $`git status --porcelain -- ${SRC_REL}`.cwd(ROOT).text()
  return status.split("\n").filter((line) => line.trim() !== "")
}

// The CLI overwrites every source unconditionally, so uncommitted work in there
// is unrecoverable once it runs. Untracked files are safe to keep: they are
// either pristine upstream already or about to be rewritten with the same bytes.
async function assertCleanSources(): Promise<void> {
  const dirty = (await sourceStatus()).filter((line) => !line.startsWith("??"))
  if (dirty.length === 0) return
  console.error(`Refusing to run: uncommitted changes under ${SRC_REL}.`)
  console.error(
    "Commit or stash them first; the shadcn CLI would overwrite them."
  )
  console.error(dirty.join("\n"))
  process.exit(1)
}

async function snapshotUpstream(): Promise<void> {
  await rm(VENDOR, { recursive: true, force: true })
  await mkdir(path.dirname(VENDOR), { recursive: true })
  await cp(SRC, VENDOR, { recursive: true })
}

async function patchedComponents(): Promise<string[]> {
  if (!existsSync(PATCHES)) return []
  const entries = await readdir(PATCHES)
  return entries
    .filter((entry) => entry.endsWith(".patch"))
    .map((entry) => entry.replace(/\.patch$/, ""))
    .sort()
}

async function differsFromUpstream(base: string): Promise<boolean> {
  const file = `${base}.tsx`
  const [ours, theirs] = await Promise.all([
    readFile(path.join(SRC, file), "utf8"),
    readFile(path.join(VENDOR, file), "utf8"),
  ])
  return ours !== theirs
}

async function applyPatches(): Promise<string[]> {
  const failed: string[] = []
  for (const base of await patchedComponents()) {
    const patch = path.join(PATCHES, `${base}.patch`)
    const result = await $`git apply -p1 ${patch}`.cwd(ROOT).nothrow().quiet()
    if (result.exitCode !== 0) {
      failed.push(base)
      console.error(`  FAILED  ${base}.patch`)
      console.error(result.stderr.toString().trim())
      // Re-run so the hunks that still apply land, and the rest is left as a
      // .rej next to the source, which is what you resolve by hand.
      await $`git apply -p1 --reject ${patch}`.cwd(ROOT).nothrow().quiet()
      continue
    }
    // A zero exit is not proof the patch did anything: git apply drops entries
    // whose paths land outside its working directory without complaining. If
    // the source still matches pristine upstream, the deviation is gone.
    if (!(await differsFromUpstream(base))) {
      failed.push(base)
      console.error(
        `  NO-OP   ${base}.patch applied cleanly but changed nothing`
      )
      continue
    }
    console.log(`  ok      ${base}.patch`)
  }
  return failed
}

async function update(): Promise<void> {
  await assertCleanSources()

  console.log("1/6  shadcn add -a -y -o")
  await $`npx shadcn@latest add -a -y -o`.cwd(PKG)

  console.log(`2/6  snapshotting pristine upstream into ${VENDOR_REL}`)
  await snapshotUpstream()

  console.log("3/6  replaying local patches")
  const failed = await applyPatches()

  console.log("4/6  new from upstream")
  const added = (await sourceStatus())
    .filter((line) => line.startsWith("??"))
    .map((line) => line.slice(3).trim())
  console.log(
    added.length > 0 ? added.map((file) => `  + ${file}`).join("\n") : "  none"
  )

  // The registry rewrites package.json too: a new component can bring a real
  // dependency, and the chart item pins recharts to the exact version the
  // vendored chart.tsx was generated against. We take the registry's word on
  // both, but the change has to be visible and installed, or the verification
  // below runs against a tree that no longer matches the manifest.
  console.log("5/6  dependencies")
  const manifestDiff = await $`git diff -- ${PKG_REL}/package.json`
    .cwd(ROOT)
    .text()
  if (manifestDiff.trim() === "") {
    console.log("  unchanged")
  } else {
    for (const line of manifestDiff.split("\n")) {
      if (/^[+-]\s+"/.test(line)) console.log(`  ${line.trim()}`)
    }
    await $`bun install`.cwd(ROOT)
  }

  if (failed.length > 0) {
    console.error(
      `\n${failed.length} patch(es) did not land. Upstream changed a line we own.`
    )
    console.error(
      "Resolve the .rej files by hand, then: bun run ui:refresh-patches"
    )
    process.exit(1)
  }

  console.log("6/6  typecheck and tests")
  await $`bun run typecheck`.cwd(PKG)
  await $`bun run test`.cwd(PKG)
  console.log("\nDone. Review the diff before committing.")
}

// git diff --no-index labels both sides with the paths it was given. Rewrite the
// header so both read the real source path, which is what lets `git apply -p1`
// from the repository root land in the right file. Only the preamble is
// touched, never hunk content.
function normalizeHeader(diff: string, srcRel: string): string {
  const out: string[] = []
  let inHunks = false
  for (const line of diff.split("\n")) {
    if (line.startsWith("@@")) inHunks = true
    if (!inHunks) {
      if (line.startsWith("index ")) continue
      if (line.startsWith("diff --git ")) {
        out.push(`diff --git a/${srcRel} b/${srcRel}`)
        continue
      }
      if (line.startsWith("--- ")) {
        out.push(`--- a/${srcRel}`)
        continue
      }
      if (line.startsWith("+++ ")) {
        out.push(`+++ b/${srcRel}`)
        continue
      }
    }
    out.push(line)
  }
  return out.join("\n")
}

async function refresh(): Promise<void> {
  if (!existsSync(VENDOR)) {
    console.error(
      `Missing ${VENDOR_REL}, which the patches are defined against.`
    )
    console.error("It is written by `bun run ui:update`; run that once first.")
    process.exit(1)
  }

  await mkdir(PATCHES, { recursive: true })
  for (const base of await patchedComponents()) {
    await rm(path.join(PATCHES, `${base}.patch`))
  }

  const files = (await readdir(VENDOR)).filter((f) => f.endsWith(".tsx")).sort()
  const written: string[] = []
  const undocumented: string[] = []

  for (const file of files) {
    const base = file.replace(/\.tsx$/, "")
    if (!existsSync(path.join(SRC, file))) continue
    if (!(await differsFromUpstream(base))) continue

    const note = DEVIATIONS[base]
    if (note === undefined) {
      undocumented.push(base)
      continue
    }
    const srcRel = `${SRC_REL}/${file}`
    const diff =
      await $`git diff --no-index --no-color -- ${VENDOR_REL}/${file} ${srcRel}`
        .cwd(ROOT)
        .nothrow()
        .text()
    const header = [
      `# ${file} local deviation`,
      `# ${note}`,
      "# Regenerate with: bun run ui:refresh-patches",
      "",
    ].join("\n")
    await writeFile(
      path.join(PATCHES, `${base}.patch`),
      header + normalizeHeader(diff, srcRel),
      "utf8"
    )
    written.push(base)
  }

  for (const name of written) console.log(`  wrote   ${name}.patch`)
  for (const name of Object.keys(DEVIATIONS)) {
    if (written.includes(name)) continue
    console.warn(
      `  stale   ${name} is documented but no longer differs from upstream`
    )
  }
  if (undocumented.length > 0) {
    console.error(
      `\nThese components differ from upstream with no entry in DEVIATIONS: ${undocumented.join(", ")}`
    )
    console.error("Add a one-line reason there, then run this again.")
    process.exit(1)
  }
  console.log(`\n${written.length} patch(es) written.`)
}

const command = process.argv[2]
if (command === "update") {
  await update()
} else if (command === "refresh") {
  await refresh()
} else {
  console.error("usage: bun scripts/update-shadcn.ts <update|refresh>")
  process.exit(1)
}
