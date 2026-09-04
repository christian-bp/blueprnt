import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  ASSISTANT_PAGES,
  ASSISTANT_PROMPT_LOCALES,
  assistantSystemPrompt,
} from "@workspace/backend/convex/assistant/knowledge"
import {
  CRITERIA_LIBRARY_KEYS,
  criteriaLibraryContent,
  type CriteriaLibraryKey,
  LIBRARY_OVERLAP_PAIRS,
  REGISTERED_LIBRARY_LOCALES,
} from "@workspace/backend/convex/evaluationModel/criteriaLibrary"
import da from "@workspace/i18n/messages/da.json"
import en from "@workspace/i18n/messages/en.json"
import fi from "@workspace/i18n/messages/fi.json"
import nb from "@workspace/i18n/messages/nb.json"
import sv from "@workspace/i18n/messages/sv.json"
import { routing } from "@workspace/i18n/routing"
import { describe, expect, it } from "vitest"
import { headingAnchor, headingTexts } from "@/lib/docs/anchors"
import { NAV_AREAS } from "@/lib/navigation"
import { collectStaticAppRoutes } from "@/test/app-routes"
import {
  allDocSlugs,
  DOCS_NAV,
  POPULAR_DOCS,
  SECTION_LABEL_KEYS,
} from "./docs-nav"
import { docFrontmatterSchema } from "./frontmatter"
import { parseMdx } from "./parse-mdx"

const CONTENT_ROOT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../content/docs"
)
const MESSAGES: Record<string, unknown> = { en, sv, nb, da, fi }

const slugsOf = (locale: string) =>
  readdirSync(path.join(CONTENT_ROOT, locale))
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""))
    .sort()

const rawOf = (locale: string, slug: string) =>
  readFileSync(path.join(CONTENT_ROOT, locale, `${slug}.mdx`), "utf8")

const bodyOf = (locale: string, slug: string) => parseMdx(rawOf(locale, slug))

// Every `](...)` target, whatever shape it takes. Reading only targets that
// start with "/" is not a narrower check but no check at all: a relative
// target (`](key-concepts)`) or a titled one (`](/roles "Roles")`) matches
// nothing and passes unseen, and the renderer sends any href that is
// neither absolute nor an anchor to a new tab as an external address.
const LINK = /\]\(([^)]*)\)/g

type DocLink = { target: string; anchor: string; raw: string }

const docLinks = (content: string): DocLink[] =>
  [...content.matchAll(LINK)].map((match) => {
    const raw = match[1] ?? ""
    // A destination runs to the first space (the optional link title) unless
    // it is wrapped in angle brackets, which is how markdown carries one
    // containing spaces.
    const angled = /^<([^>]*)>/.exec(raw)
    const destination = angled ? (angled[1] ?? "") : (raw.split(/\s/)[0] ?? "")
    const hash = destination.indexOf("#")
    return hash === -1
      ? { target: destination, anchor: "", raw }
      : {
          target: destination.slice(0, hash),
          anchor: destination.slice(hash),
          raw,
        }
  })

const EXTERNAL_LINK = /^(?:https?:|mailto:)/i

const normalizeSpace = (text: string) => text.replace(/\s+/g, " ").trim()

const headingTextsOf = (locale: string, slug: string) =>
  headingTexts(bodyOf(locale, slug).content)

// Deduplicating: for membership checks only. A collision between two
// headings is invisible here by construction, so guard 10 works on the
// undeduplicated list instead.
const anchorsOf = (locale: string, slug: string) =>
  new Set(headingTextsOf(locale, slug).map(headingAnchor))

describe("guard 1: locale parity", () => {
  it("every locale has exactly the en slug set", () => {
    const enSlugs = slugsOf("en")
    for (const locale of routing.locales) {
      expect(slugsOf(locale), `locale ${locale}`).toEqual(enSlugs)
    }
  })
})

describe("guard 2: frontmatter", () => {
  it("every file in every locale validates and names a nav section", () => {
    const sections = new Set(DOCS_NAV.map((s) => s.section))
    for (const locale of routing.locales) {
      for (const slug of slugsOf(locale)) {
        const { data } = bodyOf(locale, slug)
        const parsed = docFrontmatterSchema.parse(data)
        expect(
          sections.has(parsed.section as keyof typeof SECTION_LABEL_KEYS),
          `${locale}/${slug}`
        ).toBe(true)
      }
    }
  })

  // A valid section id is not enough: the page must name the section it is
  // actually filed under, or the sidebar files it in one place while the
  // page's own breadcrumb and section label say another.
  it("every page's section is the nav section it is filed under", () => {
    for (const section of DOCS_NAV) {
      for (const slug of section.pages) {
        for (const locale of routing.locales) {
          const parsed = docFrontmatterSchema.parse(bodyOf(locale, slug).data)
          expect(
            parsed.section,
            `${locale}/${slug}: DOCS_NAV files it under "${section.section}", frontmatter says "${parsed.section}"`
          ).toBe(section.section)
        }
      }
    }
  })
})

describe("guard 3: nav drift", () => {
  it("nav slugs and en files are the same set", () => {
    expect([...allDocSlugs()].sort()).toEqual(slugsOf("en"))
  })
  it("every POPULAR_DOCS slug is a real nav slug", () => {
    const enSlugs = new Set(slugsOf("en"))
    for (const slug of POPULAR_DOCS) {
      expect(
        enSlugs.has(slug),
        `POPULAR_DOCS has an unknown slug: ${slug}`
      ).toBe(true)
    }
  })
  it("every section has a label key resolving in every locale", () => {
    for (const section of DOCS_NAV) {
      const key =
        SECTION_LABEL_KEYS[section.section as keyof typeof SECTION_LABEL_KEYS]
      expect(key, section.section).toBeDefined()
      const leaf = key.split(".")[1] ?? ""
      for (const locale of routing.locales) {
        const messages = MESSAGES[locale] as {
          dashboard: { docs: { sections: Record<string, string> } }
        }
        expect(
          messages.dashboard.docs.sections[leaf],
          `${locale} ${key}`
        ).toBeTruthy()
      }
    }
  })
})

describe("guard 4: internal links", () => {
  it("every internal link and anchor resolves, in every locale", () => {
    const appRoutes = collectStaticAppRoutes()
    const docSlugs = new Set(allDocSlugs())
    for (const locale of routing.locales) {
      for (const slug of slugsOf(locale)) {
        for (const { target, anchor, raw } of docLinks(
          bodyOf(locale, slug).content
        )) {
          const where = `${locale}/${slug} -> ](${raw})`
          if (EXTERNAL_LINK.test(target)) continue
          if (target === "") {
            expect(anchor, `${where}: link with no destination`).not.toBe("")
            expect(
              anchorsOf(locale, slug).has(anchor.slice(1)),
              `${where}: no heading on this page anchors to ${anchor}`
            ).toBe(true)
            continue
          }
          // Anything that is neither an anchor nor an absolute path renders
          // as an external new-tab link, so a relative target is a dead link
          // rather than a shorter way of writing an internal one.
          expect(
            target.startsWith("/"),
            `${where}: an internal link is an absolute path (/docs/... or an app route), never a relative one`
          ).toBe(true)
          if (target.startsWith("/docs/")) {
            const targetSlug = target.slice("/docs/".length)
            expect(docSlugs.has(targetSlug), where).toBe(true)
            if (anchor !== "") {
              expect(
                anchorsOf(locale, targetSlug).has(anchor.slice(1)),
                `${where}: no heading on ${target} anchors to ${anchor}`
              ).toBe(true)
            }
          } else {
            expect(appRoutes.has(target), where).toBe(true)
          }
        }
      }
    }
  })
})

describe("guard 5: assistant prompt routes", () => {
  // The prompt is built in packages/backend, which cannot import this app's
  // message files or nav registries, so ASSISTANT_PAGES is where a
  // destination's name is defined for the prompt and this guard is the link
  // between the two packages. It reads the rendered prompt and the table
  // itself rather than the source text: what the model receives is what has
  // to be checked.
  const promptPages = Object.entries(ASSISTANT_PAGES)

  const listedPathsIn = (prompt: string) =>
    new Set(
      [...prompt.matchAll(/^- .+? \((\/[a-z0-9/-]*)\): /gm)].map(
        (m) => m[1] ?? ""
      )
    )

  const messageAt = (locale: string, labelKey: string): unknown =>
    labelKey
      .split(".")
      .reduce<unknown>(
        (node, part) =>
          node !== null && typeof node === "object"
            ? (node as Record<string, unknown>)[part]
            : undefined,
        (MESSAGES[locale] as { dashboard: unknown }).dashboard
      )

  // Every label key the app itself uses for a destination: the rail, the
  // inner sidebars and the command palette all render NAV_AREAS, and a path
  // can appear both as an area and as one of its inner rows (/work is "Job
  // architecture" as the area and "Levels" as its first row). Pages outside
  // the registry (the import wizards) have no entry here, so their declared
  // key is only checked for resolving.
  const appLabelKeys = (href: string): Set<string> => {
    const keys = new Set<string>()
    for (const area of NAV_AREAS) {
      if (area.href === href) keys.add(area.labelKey)
      for (const group of area.innerNav) {
        for (const entry of group.entries) {
          if (entry.href === href) keys.add(entry.labelKey)
        }
      }
    }
    return keys
  }

  it("every path in the prompt's Pages list is a real static route", () => {
    const paths = listedPathsIn(assistantSystemPrompt({ locale: "en" }))
    expect(paths.size).toBeGreaterThanOrEqual(9)
    expect(paths.size).toBe(promptPages.length)
    const appRoutes = collectStaticAppRoutes()
    for (const p of paths) {
      expect(
        appRoutes.has(p),
        `prompt lists a route that does not exist: ${p}`
      ).toBe(true)
    }
  })

  // The forward check above only proves the prompt names no dead route. It
  // cannot catch the opposite, and the opposite is the defect that has now
  // shipped twice: a real destination missing from the list, which the model
  // answers by substituting the nearest one it was given (it sent users to
  // /organization for account security, and to /model for weighting).
  it("every inner-nav destination in the app's own registry is one the prompt knows", () => {
    const listed = listedPathsIn(assistantSystemPrompt({ locale: "en" }))
    // The platform console is a staff surface the assistant never routes
    // users to, exactly as it stayed out of the old registries.
    for (const area of NAV_AREAS.filter((a) => !a.platformOnly)) {
      for (const group of area.innerNav) {
        for (const entry of group.entries) {
          expect(
            listed.has(entry.href),
            `the registry has ${entry.href} but the assistant prompt does not list it, so the model will send users to a neighbouring page instead`
          ).toBe(true)
        }
      }
    }
  })

  it("every area destination is one the prompt knows", () => {
    const listed = listedPathsIn(assistantSystemPrompt({ locale: "en" }))
    for (const area of NAV_AREAS.filter((a) => !a.platformOnly)) {
      expect(
        listed.has(area.href),
        `the rail has ${area.href} but the assistant prompt does not list it`
      ).toBe(true)
    }
  })

  it("the prompt's locales are exactly the app's locales", () => {
    expect([...ASSISTANT_PROMPT_LOCALES].sort()).toEqual(
      [...routing.locales].sort()
    )
  })

  it("the criteria library's locale set is exactly the app's locales", () => {
    expect([...REGISTERED_LIBRARY_LOCALES].sort()).toEqual(
      [...routing.locales].sort()
    )
  })

  // The defect this exists for: the prompt named every destination in English
  // ("Work" for /work), so the model translated it into a word the product
  // never shows ("Arbete" in Swedish) and linked the audit log as "Audit log"
  // inside Swedish prose. A name is only right if it is the label the app
  // renders for that path, in that locale, so the check is equality against
  // the message files rather than "is translated somehow".
  it("every destination's name is the app's own label for it, in every locale", () => {
    for (const [href, page] of promptPages) {
      const known = appLabelKeys(href)
      if (known.size > 0) {
        expect(
          known.has(page.labelKey),
          `the prompt names ${href} with "${page.labelKey}", but the app labels it with ${[...known].join(" or ")}`
        ).toBe(true)
      }
      for (const locale of routing.locales) {
        const label = messageAt(locale, page.labelKey)
        expect(
          typeof label === "string" && label !== "",
          `${locale}: dashboard.${page.labelKey} (the prompt's name for ${href}) resolves to nothing`
        ).toBe(true)
        expect(
          page.name[locale],
          `${locale}: the prompt names ${href} "${page.name[locale]}" but the app shows "${String(label)}"`
        ).toBe(label)
      }
    }
  })

  // Rendering is checked separately from the table: a name defined correctly
  // but dropped from the rendered list would still leave the model with no
  // way to name the page.
  it("renders every destination with its own locale's name", () => {
    for (const locale of routing.locales) {
      const prompt = assistantSystemPrompt({ locale })
      for (const [href, page] of promptPages) {
        expect(
          prompt.includes(`- ${page.name[locale]} (${href}): `),
          `${locale}: the rendered Pages list is missing ${href}`
        ).toBe(true)
      }
    }
  })

  // The prompt's own example guide links are the model's template for the
  // shape of a docs path, so a stale one teaches it to emit a dead link.
  it("every /docs guide path used as an example in the prompt is a real slug", () => {
    const docSlugs = new Set(allDocSlugs())
    const examples = [
      ...assistantSystemPrompt({ locale: "en" }).matchAll(
        /\/docs\/([a-z0-9-]+)/g
      ),
    ].map((m) => m[1] ?? "")
    for (const slug of examples) {
      expect(
        docSlugs.has(slug),
        `prompt links a documentation page that does not exist: /docs/${slug}`
      ).toBe(true)
    }
  })
})

describe("guard 6: term coverage", () => {
  const labelOf = (value: unknown): string | null => {
    if (typeof value === "string") return value
    if (
      value !== null &&
      typeof value === "object" &&
      "label" in value &&
      typeof (value as { label: unknown }).label === "string"
    ) {
      return (value as { label: string }).label
    }
    return null
  }
  // Terms whose home is a domain namespace; pay-mapping and people terms
  // have no glossary namespace, so they are listed explicitly.
  const EXTRA_TERMS = [
    "Pay mapping",
    "Equal work",
    "Equivalent work",
    "Collaboration",
    "Rules and practice",
    "Action",
    "Note",
    "Reference date",
    "Frozen data",
    "Classification",
    "Pay gap",
    "Quartile",
  ]
  // Reviewed exclusions: namespace values that are not standalone term
  // labels, so they get no glossary heading of their own.
  const EXCLUDED_TERM_KEYS = {
    // "Level {level}" is an interpolated status string (e.g. "Level 3"),
    // not a term label; the term itself is already covered by "Level".
    assessment: new Set(["levelNumbered"]),
  }
  it("every canonical term has a glossary heading", () => {
    const anchors = anchorsOf("en", "glossary")
    const terms = [
      ...Object.values(en.model).map(labelOf),
      ...Object.entries(en.assessment)
        .filter(([key]) => !EXCLUDED_TERM_KEYS.assessment.has(key))
        .map(([, value]) => labelOf(value)),
      ...EXTRA_TERMS,
    ].filter((t): t is string => t !== null)
    for (const term of terms) {
      expect(
        anchors.has(headingAnchor(term)),
        `glossary is missing: ${term}`
      ).toBe(true)
    }
  })
})

describe("guard 7: error coverage", () => {
  const TROUBLESHOOTING_PAGES = [
    "troubleshooting-sign-in-and-account",
    "troubleshooting-model-and-evaluation",
    "troubleshooting-people-and-import",
    "troubleshooting-pay-mapping",
  ]

  it("every errors namespace key is explained on a troubleshooting page", () => {
    // The key is a code in backticks, so it is the same in every locale even
    // though the prose around it is translated: a translator dropping or
    // mistyping one leaves that locale with an unexplained error.
    for (const locale of routing.locales) {
      const text = TROUBLESHOOTING_PAGES.map(
        (slug) => bodyOf(locale, slug).content
      ).join("\n")
      for (const key of Object.keys(en.errors)) {
        expect(
          text.includes(`\`${key}\``),
          `${locale}: no troubleshooting entry for: ${key}`
        ).toBe(true)
      }
    }
  })

  // Each code is documented by its own "Code: `<code>`" line, and the entry
  // quotes the sentence the app actually shows immediately below it.
  // Covering the code alone is not enough: rewording the i18n string leaves
  // all four pages quoting the old sentence in five locales, and the
  // assistant then quotes back a message the user never saw, with nothing to
  // catch it. The code line is what keys an entry rather than a heading,
  // because a heading is prose written for an HR reader ("The role is
  // locked") and no longer carries the identifier; the line's label is
  // translated per locale ("Code", "Kod", "Kode", "Koodi"), so the pattern
  // matches the line's shape instead of an English word. An entry runs to
  // the next code line, and the quoted message is the first quotation in it.
  // The corpus hard wraps its prose, so the comparison normalizes whitespace.
  const CODE_LINE = /^\p{L}+:[ \t]+`([A-Za-z][A-Za-z0-9]*)`[ \t]*$/gmu

  const errorEntriesOf = (locale: string) => {
    const entries = new Map<string, string[]>()
    for (const slug of TROUBLESHOOTING_PAGES) {
      const parts = bodyOf(locale, slug).content.split(CODE_LINE)
      for (let i = 1; i < parts.length; i += 2) {
        const code = parts[i] ?? ""
        entries.set(code, [...(entries.get(code) ?? []), parts[i + 1] ?? ""])
      }
    }
    return entries
  }
  const QUOTED_MESSAGE = /"([^"]+)"/

  it("every documented code quotes its current message, in every locale", () => {
    for (const locale of routing.locales) {
      const errors = (MESSAGES[locale] as { errors: Record<string, string> })
        .errors
      const entries = errorEntriesOf(locale)
      for (const key of Object.keys(en.errors)) {
        expect(
          entries.get(key)?.length ?? 0,
          `${locale}: expected exactly one troubleshooting entry keyed by a "Code: \`${key}\`" line`
        ).toBe(1)
        const quoted = QUOTED_MESSAGE.exec(entries.get(key)?.[0] ?? "")
        expect(
          quoted,
          `${locale}/${key}: the entry quotes no message text`
        ).not.toBeNull()
        expect(
          normalizeSpace(quoted?.[1] ?? ""),
          `${locale}/${key}: the quoted message has drifted from the string the app shows`
        ).toBe(normalizeSpace(errors[key] ?? ""))
      }
    }
  })

  // The check above reads the entry a code line opens, so a code line that
  // documents nothing in errors.* would go unseen: the corpus would carry a
  // codeblock-shaped line for an identifier the app cannot raise, and the
  // assistant would offer it as an explanation for a message no user can
  // receive. Every code line is therefore required to name a live code, in
  // every locale.
  it("no troubleshooting page documents a code the app cannot raise", () => {
    const known = new Set(Object.keys(en.errors))
    for (const locale of routing.locales) {
      for (const code of errorEntriesOf(locale).keys()) {
        expect(
          known.has(code),
          `${locale}: a troubleshooting page documents \`${code}\`, which is not a key in the errors namespace`
        ).toBe(true)
      }
    }
  })
})

describe("guard 8: locale structural parity", () => {
  const HEADING = /^(#{2,4})\s+/gm
  const headingLevelsOf = (content: string) =>
    [...content.matchAll(HEADING)].map((m) => (m[1] ?? "").length)

  // A locale keeps the source's structure and only translates its prose, so
  // two locales' link targets appearing in a different order is itself the
  // defect (e.g. a reordered glossary), not a legitimate variation.
  const firstDivergence = (a: string[], b: string[]) => {
    const len = Math.max(a.length, b.length)
    for (let i = 0; i < len; i++) {
      if (a[i] !== b[i]) return i
    }
    return -1
  }

  // Title and description are covered by docFrontmatterSchema's own min(1),
  // which throws here before any assertion runs.
  it("frontmatter parses and its section matches en", () => {
    for (const locale of routing.locales) {
      if (locale === "en") continue
      for (const slug of slugsOf(locale)) {
        const enFrontmatter = docFrontmatterSchema.parse(
          bodyOf("en", slug).data
        )
        const localeFrontmatter = docFrontmatterSchema.parse(
          bodyOf(locale, slug).data
        )
        expect(localeFrontmatter.section, `${locale}/${slug} section`).toBe(
          enFrontmatter.section
        )
      }
    }
  })

  it("heading level sequence matches en, position for position", () => {
    for (const locale of routing.locales) {
      if (locale === "en") continue
      for (const slug of slugsOf(locale)) {
        expect(
          headingLevelsOf(bodyOf(locale, slug).content),
          `${locale}/${slug} heading sequence`
        ).toEqual(headingLevelsOf(bodyOf("en", slug).content))
      }
    }
  })

  it("internal link target sequence matches en's, position for position, with anchors present wherever en has one", () => {
    for (const locale of routing.locales) {
      if (locale === "en") continue
      for (const slug of slugsOf(locale)) {
        const enLinks = docLinks(bodyOf("en", slug).content)
        const localeLinks = docLinks(bodyOf(locale, slug).content)
        const enTargets = enLinks.map((l) => l.target)
        const localeTargets = localeLinks.map((l) => l.target)
        const firstDiff = firstDivergence(enTargets, localeTargets)
        const divergence =
          firstDiff === -1
            ? ""
            : ` (diverges at position ${firstDiff}: en has "${enTargets[firstDiff] ?? "(nothing)"}", ${locale} has "${localeTargets[firstDiff] ?? "(nothing)"}")`
        expect(
          localeTargets,
          `${locale}/${slug} link target sequence${divergence}`
        ).toEqual(enTargets)

        for (const [i, enLink] of enLinks.entries()) {
          if (enLink.anchor !== "") {
            expect(
              (localeLinks[i]?.anchor ?? "") !== "",
              `${locale}/${slug} link ${i} (${enLink.target}) is missing the anchor en has`
            ).toBe(true)
          }
        }
      }
    }
  })
})

describe("guard 9: heading anchor contract", () => {
  // The renderer (mdx.tsx) derives a heading's DOM id from the React
  // children it renders; the chunker (chunk.ts) and this suite's own
  // anchorsOf derive the SAME page's id from the raw markdown heading text,
  // via headingAnchor. The two derivations agree only when a heading is
  // plain text: inline markdown (bold, italic, inline code, a link, or an
  // image) renders through React's children as something other than the
  // raw string this guard reads (e.g. "Point **budget** done" becomes the
  // children array ["Point ", <strong>, " done"], not the raw text), so the
  // renderer's actual id and the chunker/guard's predicted id would diverge
  // and any deep link built against the latter would 404. This guard is
  // what anchors.ts's "plain text by convention" comment refers to.
  const HEADING = /^#{2,4}\s+(.+)$/gm
  const INLINE_MARKDOWN_PATTERNS: Record<string, RegExp> = {
    bold: /\*\*[^*]+\*\*|__[^_]+__/,
    italic: /(?<!\*)\*[^*]+\*(?!\*)|(?<!_)_[^_]+_(?!_)/,
    code: /`[^`]+`/,
    // Also catches an image (![alt](url)): same bracket-paren shape with a
    // leading "!", so no separate pattern is needed for it.
    link: /\[[^\]]*\]\([^)]*\)/,
    // The renderer loads remark-gfm, so the two GFM inline constructs render
    // as elements too and have to be caught by the same rule. Strikethrough
    // takes one or two tildes (single tilde is micromark's default), and the
    // run may not sit against a space on the inside, which is what keeps an
    // approximation like "~100 to ~200" out of it.
    strikethrough: /(?<!~)(~~?)(?=[^\s~])(?:[^~]*[^\s~])?\1(?!~)/,
    // Autolink literals: a bare www/http(s) address or an email address
    // becomes an anchor without any link syntax around it.
    autolink:
      /(?:^|[\s*_~(])(?:https?:\/\/|www\.)\S+|(?:^|[\s(])[^\s@]+@[^\s@]+\.[^\s@]+/i,
  }

  it("no heading in any locale contains inline markdown syntax", () => {
    const offenders: string[] = []
    for (const locale of routing.locales) {
      for (const slug of slugsOf(locale)) {
        for (const match of bodyOf(locale, slug).content.matchAll(HEADING)) {
          const heading = match[1] ?? ""
          for (const [kind, pattern] of Object.entries(
            INLINE_MARKDOWN_PATTERNS
          )) {
            if (pattern.test(heading)) {
              offenders.push(`${locale}/${slug}: "${heading}" (${kind})`)
            }
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

describe("guard 10: anchor uniqueness", () => {
  // headingAnchor slugifies through slugify, which folds diacritics, so two
  // headings on one page can collapse onto one anchor ("Atgarder" and
  // "Åtgärder" both become "atgarder"). The renderer emits the anchor as a
  // literal DOM id, so #anchor navigation and every deep link the assistant
  // builds would silently land on whichever heading comes first in the DOM.
  // The Nordic locales are the real risk surface, so this runs on all five.
  it("no page in any locale has two headings sharing one anchor", () => {
    const collisions: string[] = []
    for (const locale of routing.locales) {
      for (const slug of slugsOf(locale)) {
        // Distinct anchors have to number exactly as many as the headings
        // they came from; the pair is carried along so the failure names it.
        const firstByAnchor = new Map<string, string>()
        for (const heading of headingTextsOf(locale, slug)) {
          const anchor = headingAnchor(heading)
          const first = firstByAnchor.get(anchor)
          if (first === undefined) {
            firstByAnchor.set(anchor, heading)
          } else {
            collisions.push(
              `${locale}/${slug}: "${first}" and "${heading}" both anchor to #${anchor}`
            )
          }
        }
      }
    }
    expect(collisions).toEqual([])
  })
})

describe("guard 11: writing style", () => {
  // The house rule forbids the em dash in everything we write. The corpus is
  // the largest body of prose in the repo, it is translated five ways, and
  // the assistant quotes it back verbatim, so one that slips into a locale
  // propagates into answers. Frontmatter is scanned with the body: a title
  // and description are prose we write too. The character is written as an
  // escape so the rule cannot be broken by the file that enforces it.
  const EM_DASH = "\u2014"
  it("no page in any locale uses an em dash", () => {
    const offenders: string[] = []
    for (const locale of routing.locales) {
      for (const slug of slugsOf(locale)) {
        for (const [i, line] of rawOf(locale, slug).split("\n").entries()) {
          if (line.includes(EM_DASH)) {
            offenders.push(`${locale}/${slug}:${i + 1}: ${line.trim()}`)
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

describe("guard 12: the criteria library reference names every criterion", () => {
  // The library reference page is the only surface outside the picker that
  // lists the criteria, and it is written FROM the library's own name and
  // short text rather than paraphrasing them. Nothing else notices when the
  // library gains, loses or renames a criterion: the page would simply go
  // quietly out of date in five locales, and the assistant would answer from
  // it. Each locale is checked against its OWN content, so a name that was
  // translated in the library but not on the page fails too.
  // The page's entry form: a bullet whose bold lead is the criterion's own
  // name. Matched as the ENTRY rather than anywhere in the text, because the
  // overlap list repeats the same names further down and would otherwise let
  // a criterion dropped from its dimension pass as present.
  const entryNames = (locale: string): Set<string> => {
    const names = new Set<string>()
    for (const line of rawOf(locale, "criteria-library").split("\n")) {
      const lead = /^- \*\*(.+?)\.\*\* /.exec(line)
      if (lead !== null) names.add(lead[1] as string)
    }
    return names
  }

  it("every library criterion has its own entry, in every locale", () => {
    const missing: string[] = []
    for (const locale of routing.locales) {
      const entries = entryNames(locale)
      const content = criteriaLibraryContent(locale)
      for (const key of CRITERIA_LIBRARY_KEYS) {
        const name = content.criteria[key].name
        if (!entries.has(name)) missing.push(`${locale}/${key}: ${name}`)
      }
    }
    expect(missing).toEqual([])
  })

  it("the page carries no criterion the library does not have", () => {
    // The reverse direction: a criterion removed from the library must not
    // survive as a bullet. Bold-led bullets are the page's entry form, so a
    // leftover entry is one whose bold lead matches no library name.
    const strays: string[] = []
    for (const locale of routing.locales) {
      const names = new Set(
        CRITERIA_LIBRARY_KEYS.map(
          (key) => criteriaLibraryContent(locale).criteria[key].name
        )
      )
      for (const name of entryNames(locale)) {
        if (!names.has(name)) strays.push(`${locale}: ${name}`)
      }
    }
    expect(strays).toEqual([])
  })
})

describe("guard 13: the criteria library reference states every declared overlap", () => {
  // The overlap-pairs list is prose ("<name A> <conjunction> <name B>"),
  // not guard 12's bold-lead entry form, so it needs its own parser. A
  // criterion's own name can itself contain the locale's conjunction word
  // (e.g. "Analytical and problem-solving effort"), so a bullet is resolved
  // by testing every occurrence of the conjunction as a candidate split
  // point against the locale's own criterion names, rather than by
  // splitting on the first or last one. Nothing else notices when
  // LIBRARY_OVERLAP_PAIRS gains, loses or changes a pair: the page would
  // simply go quietly out of date in five locales.
  const CONJUNCTION: Record<string, string> = {
    en: "and",
    sv: "och",
    nb: "og",
    da: "og",
    fi: "ja",
  }

  // Plain bullets that are neither guard 12's bold-lead entry form nor a
  // markdown link bullet (the Related section's reading list) are the
  // overlap list's own bullets, wherever its heading falls.
  const overlapBulletLines = (locale: string): string[] =>
    rawOf(locale, "criteria-library")
      .split("\n")
      .filter(
        (line) =>
          line.startsWith("- ") &&
          !/^- \*\*(.+?)\.\*\* /.test(line) &&
          !line.startsWith("- [")
      )
      .map((line) => line.slice(2).trim())

  // Resolves one bullet to the pair of library keys it names, or null when
  // it does not resolve to exactly one pair of the locale's own names.
  const resolveBullet = (
    locale: string,
    line: string
  ): [CriteriaLibraryKey, CriteriaLibraryKey] | null => {
    const content = criteriaLibraryContent(locale)
    const nameToKey = new Map<string, CriteriaLibraryKey>(
      CRITERIA_LIBRARY_KEYS.map((key) => [content.criteria[key].name, key])
    )
    const conjunction = ` ${CONJUNCTION[locale]} `
    const matches: [CriteriaLibraryKey, CriteriaLibraryKey][] = []
    let from = 0
    for (;;) {
      const at = line.indexOf(conjunction, from)
      if (at === -1) break
      const leftKey = nameToKey.get(line.slice(0, at))
      const rightKey = nameToKey.get(line.slice(at + conjunction.length))
      if (leftKey !== undefined && rightKey !== undefined) {
        matches.push([leftKey, rightKey])
      }
      from = at + 1
    }
    return matches.length === 1
      ? (matches[0] as (typeof matches)[number])
      : null
  }

  const pairId = (a: string, b: string) => [a, b].sort().join("/")
  const declaredIds = new Set(
    LIBRARY_OVERLAP_PAIRS.map(([a, b]) => pairId(a, b))
  )

  it("every declared overlap pair has exactly one bullet, in every locale", () => {
    const offenders: string[] = []
    for (const locale of routing.locales) {
      const counts = new Map<string, number>()
      for (const line of overlapBulletLines(locale)) {
        const pair = resolveBullet(locale, line)
        if (pair === null) continue
        const id = pairId(pair[0], pair[1])
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }
      for (const [a, b] of LIBRARY_OVERLAP_PAIRS) {
        const count = counts.get(pairId(a, b)) ?? 0
        if (count !== 1) {
          offenders.push(`${locale}: ${a}/${b} has ${count} bullet(s)`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it("the page names no overlap the library does not declare", () => {
    // The reverse direction: a bullet whose pair was removed from
    // LIBRARY_OVERLAP_PAIRS, or that never resolved to two real names in
    // the first place, must not survive unnoticed.
    const offenders: string[] = []
    for (const locale of routing.locales) {
      for (const line of overlapBulletLines(locale)) {
        const pair = resolveBullet(locale, line)
        if (pair === null) {
          offenders.push(`${locale}: unresolved overlap bullet "${line}"`)
          continue
        }
        const id = pairId(pair[0], pair[1])
        if (!declaredIds.has(id)) {
          offenders.push(`${locale}: undeclared overlap ${pair[0]}/${pair[1]}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
