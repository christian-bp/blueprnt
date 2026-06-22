import { render } from "@react-email/render"
import { Text } from "@react-email/components"
import { describe, expect, it } from "vitest"
import { BaseEmailTemplate } from "./base-email"

describe("BaseEmailTemplate", () => {
  it("renders the wordmark, title, content, and footer chrome", async () => {
    const html = await render(
      BaseEmailTemplate({
        preview: "Preview text",
        title: "A title",
        locale: "en",
        children: <Text>Body content</Text>,
      })
    )
    expect(html).toContain("/email/blueprnt-wordmark.png")
    expect(html).toContain('alt="blueprnt"')
    expect(html).toContain("A title")
    expect(html).toContain("Body content")
    expect(html).toContain("Blueprnt Nordic AB")
    expect(html).toContain(String(new Date().getFullYear()))
    expect(html).toContain("The job architecture that creates value.")
  })
})
