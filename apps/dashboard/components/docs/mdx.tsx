import { MDXRemote } from "next-mdx-remote/rsc"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import type { ComponentPropsWithoutRef, ReactNode } from "react"
import remarkGfm from "remark-gfm"
import { headingAnchor } from "@/lib/docs/anchors"

function createHeading(
  level: 2 | 3 | 4,
  headingLinkLabel: (heading: string) => string
) {
  const Tag = `h${level}` as const
  const size = {
    2: "mt-10 mb-4 text-xl font-semibold",
    3: "mt-8 mb-3 text-lg font-semibold",
    4: "mt-6 mb-2 text-base font-semibold",
  }[level]
  return function Heading({ children }: { children?: ReactNode }) {
    const text = String(children)
    const id = headingAnchor(text)
    return (
      <Tag id={id} className={`group scroll-mt-24 ${size}`}>
        {children}
        <a
          aria-label={headingLinkLabel(text)}
          className="ml-2 opacity-0 transition-opacity focus-visible:opacity-60 group-hover:opacity-60"
          href={`#${id}`}
        >
          #
        </a>
      </Tag>
    )
  }
}

function CustomLink(props: ComponentPropsWithoutRef<"a">) {
  const href = props.href ?? ""
  const className = "text-brand underline-offset-4 hover:underline"
  if (href.startsWith("/")) {
    return <Link {...props} href={href} className={className} />
  }
  if (href.startsWith("#")) return <a {...props} className={className} />
  return (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    />
  )
}

const baseComponents = {
  a: CustomLink,
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p className="my-4 text-foreground leading-7" {...props} />
  ),
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul className="my-4 list-disc space-y-2 pl-6" {...props} />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol className="my-4 list-decimal space-y-2 pl-6" {...props} />
  ),
  blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className="my-4 border-border border-l-2 pl-4 text-muted-foreground"
      {...props}
    />
  ),
  code: (props: ComponentPropsWithoutRef<"code">) => (
    <code
      className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm"
      {...props}
    />
  ),
  table: (props: ComponentPropsWithoutRef<"table">) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full text-sm" {...props} />
    </div>
  ),
  th: (props: ComponentPropsWithoutRef<"th">) => (
    <th
      className="border-border border-b px-3 py-2 text-left font-medium"
      {...props}
    />
  ),
  td: (props: ComponentPropsWithoutRef<"td">) => (
    <td className="border-border border-b px-3 py-2 align-top" {...props} />
  ),
  hr: () => <hr className="my-8 border-border" />,
}

export async function DocsMdx({ body }: { body: string }) {
  const t = await getTranslations("dashboard.docs")
  const headingLinkLabel = (heading: string) => t("headingLink", { heading })
  const components = {
    ...baseComponents,
    h2: createHeading(2, headingLinkLabel),
    h3: createHeading(3, headingLinkLabel),
    h4: createHeading(4, headingLinkLabel),
  }
  return (
    <MDXRemote
      source={body}
      components={components}
      options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
    />
  )
}
