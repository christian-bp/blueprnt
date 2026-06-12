// The default Convex runtime is not Node: of Node's globals it provides
// exactly process.env (deployment environment variables). Declare that
// surface instead of pulling in @types/node, whose APIs (fs, Buffer, ...)
// do not exist in the isolate and must not typecheck here. The few
// "use node" actions (seed, devReset) run in real Node but also only read
// process.env, so the minimal surface covers them too. TypeScript 6
// stopped auto-including hoisted @types packages, which is what previously
// made process resolve by accident.
declare const process: {
  env: Record<string, string | undefined>
}
