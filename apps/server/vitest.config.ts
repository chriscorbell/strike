import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      STRIKE_DATA_DIR: path.join(os.tmpdir(), `strike-test-${process.pid}`),
      STRIKE_COACH: "mock",
      STRIKE_TOKEN: "test-token",
    },
    fileParallelism: false,
  },
});
