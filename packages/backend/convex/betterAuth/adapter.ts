import { createApi } from "@convex-dev/better-auth"
import { createAuthOptions } from "../auth"
import schema from "./schema"

// createApi invokes the options factory during push analysis, where
// deployment env vars are absent. The adapter only consumes database
// options, never baseURL, so a placeholder is passed explicitly.
export const {
  create,
  findOne,
  findMany,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
} = createApi(schema, (ctx) =>
  createAuthOptions(ctx, { baseURL: "http://localhost" })
)
