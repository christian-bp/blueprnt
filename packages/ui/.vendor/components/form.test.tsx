import { render, screen } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { describe, expect, it } from "vitest"
import { Input } from "@workspace/ui/components/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"

function Harness() {
  const form = useForm<{ name: string }>({ defaultValues: { name: "" } })
  // Seed an error so FormMessage has something to render.
  form.setError("name", { message: "Required field" })
  return (
    <Form {...form}>
      <form>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}

describe("Form", () => {
  it("renders a field's label, control, and error message", () => {
    render(<Harness />)
    const input = screen.getByLabelText("Name")
    expect(input).toBeDefined()
    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(screen.getByText("Required field")).toBeDefined()
  })
})
