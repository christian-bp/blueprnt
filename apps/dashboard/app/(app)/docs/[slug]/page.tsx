import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale } from "next-intl/server"
import { DocsHashScroll } from "@/components/docs/hash-scroll"
import { DocsMdx } from "@/components/docs/mdx"
import { getAdjacentDocs, getDoc } from "@/lib/docs/docs"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const doc = await getDoc(await getLocale(), slug)
  return doc
    ? { title: doc.frontmatter.title, description: doc.frontmatter.description }
    : {}
}

export default async function DocArticlePage({ params }: Props) {
  const { slug } = await params
  const locale = await getLocale()
  const doc = await getDoc(locale, slug)
  if (doc === null) notFound()
  const { previous, next } = getAdjacentDocs(slug)
  const [previousDoc, nextDoc] = await Promise.all([
    previous ? getDoc(locale, previous) : null,
    next ? getDoc(locale, next) : null,
  ])
  return (
    // pt-4: more air above the title than the shell's own page inset gives.
    // Every other page's title lives in its breadcrumb row; this one opens
    // reads right; this one opens at text-2xl and needs the room a document
    // title does. On its own element, never merged into the column's py-*,
    // so the two padding utilities can never fight over source order.
    <article className="mx-auto min-w-0 max-w-3xl pt-4 pb-16">
      {/* Deliberate deviation from the breadcrumb-title norm: a docs article is a reading
          surface, so its title is the document's own h1 at the editorial
          scale that opens the MDX heading hierarchy, not the app's h2 page
          title. */}
      <h1 className="font-semibold text-2xl">{doc.frontmatter.title}</h1>
      <p className="mt-2 text-muted-foreground">
        {doc.frontmatter.description}
      </p>
      <DocsMdx body={doc.body} />
      <DocsHashScroll />
      <div className="mt-12 flex justify-between border-border border-t pt-6 text-sm">
        {previousDoc ? (
          <Link href={`/docs/${previousDoc.slug}`} className="text-brand">
            &larr; {previousDoc.frontmatter.title}
          </Link>
        ) : (
          <span />
        )}
        {nextDoc ? (
          <Link href={`/docs/${nextDoc.slug}`} className="text-brand">
            {nextDoc.frontmatter.title} &rarr;
          </Link>
        ) : (
          <span />
        )}
      </div>
    </article>
  )
}
