import path from "node:path";
import process from "node:process";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";

// Aspire inyecta la URL de la Api con WithReference. Esto corre en Node (el proxy), no en el navegador.
const apiTarget =
  process.env.services__api__https__0 ?? process.env.API_HTTPS ?? "https://localhost:7180";

// changeOrigin queda en false a propósito: la Api tiene que ver el Host del navegador (localhost:5173) para
// armar bien el redirect_uri de Google. secure: false acepta el certificado de desarrollo.
const backend = { target: apiTarget, changeOrigin: false, secure: false, ws: true };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  build: {
    // Segunda entrada: la página del iframe de renovación silenciosa.
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, "index.html"),
        silentRenew: path.resolve(import.meta.dirname, "silent-renew.html"),
      },
    },
  },
  server: {
    port: Number(process.env.PORT ?? 5173),
    strictPort: true,
    proxy: {
      "/api": backend,
      "/account": backend,
      "/connect": backend,
      "/signin-google": backend,
      "/.well-known": backend,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: false,
    // Claude Code arma sus worktrees dentro de .claude/, así que ahí hay copias enteras del proyecto con sus
    // propios tests. Sin esta exclusión, "npm run test" corre también los de otra sesión y falla por eso.
    exclude: [...configDefaults.exclude, ".claude/**"],
  },
});
