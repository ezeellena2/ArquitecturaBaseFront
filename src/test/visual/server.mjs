import path from "node:path";
import { build, preview } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const origin = "http://127.0.0.1:5178";
const root = process.cwd();
const outDir = path.resolve(root, ".test-artifacts/visual-app");
if (!outDir.startsWith(root + path.sep)) throw new Error("Visual output must stay inside the workspace.");
// Test entries stay outside the product build. Bundling avoids hundreds of ESM
// requests per navigation and Windows ERR_NO_BUFFER_SPACE during complete runs.
await build({
  configFile: false, plugins: [react(), tailwindcss({ optimize: false })],
  resolve: { alias: { "@": path.resolve(root, "src") } },
  mode: "development",
  define: { "process.env.NODE_ENV": JSON.stringify("development") },
  build: { target: "esnext", outDir, emptyOutDir: true, sourcemap: false, cssMinify: false,
    rollupOptions: { output: { codeSplitting: { groups: [{
      name: "visual-shared", test: /[\\/]node_modules[\\/]|[\\/]src[\\/]shared[\\/]/,
    }] } }, input: {
      main: path.resolve(root, "index.html"), silentRenew: path.resolve(root, "silent-renew.html"),
      visual: path.resolve(root, "src/test/visual/index.html"), session: path.resolve(root, "src/test/visual/session.html"),
      designLab: path.resolve(root, "design-lab/whatsapp-chat/index.html"),
    } },
  },
});
let ready = false;
const server = await preview({
  configFile: false,
  mode: "development", build: { outDir },
  preview: { host: "127.0.0.1", port: 5178, strictPort: true, proxy: {} },
  plugins: [{ name: "visual-readiness", configurePreviewServer(viteServer) {
    // ME2: the scenes with a brand («brand-…») show a generic logo and icon, drawn here: the product never carries a client's.
    viteServer.middlewares.use((request, response, next) => {
      const pathname = new URL(request.url ?? "/", origin).pathname;
      if (pathname !== "/api/settings/brand/logo" && pathname !== "/api/settings/brand/icon") return next();
      const logo = pathname.endsWith("/logo");
      response.setHeader("Content-Type", "image/svg+xml");
      response.end(logo
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="56" viewBox="0 0 200 56"><rect width="56" height="56" rx="8" fill="#E8A33D"/>'
          + '<path d="M14 40 28 16l14 24Z" fill="#fff"/><rect x="56" width="144" height="56" fill="#1F3A4D"/>'
          + '<text x="70" y="36" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#fff">Agro Demo</text></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="#E8A33D"/>'
          + '<path d="M16 46 32 18l16 28Z" fill="#fff"/></svg>');
    });
    viteServer.middlewares.use((request, response, next) => {
      if (new URL(request.url ?? "/", origin).pathname !== "/__visual_ready") return next();
      response.statusCode = ready ? 200 : 503;
      response.setHeader("Content-Type", "text/plain");
      response.end(ready ? "ready" : "preparing");
    });
  } }],
});
const close = () => new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => {
  await close(); process.exit(0);
});
try {
  for (const entry of ["/src/test/visual/index.html", "/src/test/visual/session.html", "/index.html"]) {
    const response = await fetch(new URL(entry, origin));
    if (!response.ok || !response.headers.get("Content-Type")?.includes("text/html"))
      throw new Error("Visual HTML readiness failed: " + entry);
    await response.arrayBuffer();
  }
  ready = true;
  console.log("Visual test bundle ready.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Visual catalogue startup failed.");
  await close(); process.exitCode = 1;
}
