import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  root: "test/unit",
  cacheDir: "../scratch/vitest-cache",
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./setup.ts"],
    include: ["*.test.{ts,tsx}"],
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
    teardownTimeout: 1000,
  },
});
