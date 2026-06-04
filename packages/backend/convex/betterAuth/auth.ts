// Static auth instance used ONLY by the Better Auth CLI for schema
// generation. Runtime code uses createAuth(ctx) from ../auth.
import { createAuth } from "../auth"

export const auth = createAuth({} as never)
