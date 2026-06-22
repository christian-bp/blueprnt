import sweego from "@christian-ek/sweego/convex.config"
import { defineApp } from "convex/server"
import betterAuth from "./betterAuth/convex.config"

const app = defineApp()
app.use(betterAuth)
app.use(sweego)

export default app
