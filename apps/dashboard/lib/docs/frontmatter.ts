import { z } from "zod"

// Exactly midday's frontmatter shape; strict so stray fields fail in tests
// instead of silently shipping.
export const docFrontmatterSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    section: z.string().min(1),
  })
  .strict()

export type DocFrontmatter = z.infer<typeof docFrontmatterSchema>
