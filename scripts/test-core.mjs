import { build } from "vite";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
process.env.GOMAXPROCS = "2";
await mkdir("test/scratch", { recursive: true });
await build({
  configFile: false,
  build: {
    target: "es2022", minify: false, outDir: "test/scratch", emptyOutDir: false,
    lib: { entry: "test/core/entry.ts", formats: ["es"], fileName: () => "core-tests.mjs" },
    rollupOptions: { external: (id) => !id.startsWith(".") && !id.startsWith("/") && !/^[A-Za-z]:/.test(id) },
  },
});
// Let every registered suite finish naturally, and reject incomplete runner output.
const run = spawnSync(
  process.execPath,
  ["--test", "--test-reporter=tap", "test/scratch/core-tests.mjs"],
  { encoding: "utf8", timeout: 30000 },
);
process.stdout.write(run.stdout ?? "");
process.stderr.write(run.stderr ?? "");
const complete =
  /^# tests 33$/m.test(run.stdout ?? "") &&
  /^# pass 33$/m.test(run.stdout ?? "");
if (!complete)
  process.stderr.write("Core test run incomplete: all 33 cases must pass.\n");
process.exitCode = run.status === 0 && complete ? 0 : 1;
