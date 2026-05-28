import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Alias `@/` → src/, aligné sur tsconfig, pour que les tests importent comme l'app.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
