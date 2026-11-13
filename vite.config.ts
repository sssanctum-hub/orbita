import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), {
    name: "orbita-version-offline-cache",
    closeBundle() {
      const version = createHash("sha256").update(readFileSync("dist/index.html")).digest("hex").slice(0, 16);
      const file = "dist/sw.js";
      writeFileSync(file, readFileSync(file, "utf8").replace("orbita-web-v1", "orbita-web-" + version));
    },
  }],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
