import path from "node:path";
import { build, preview } from "vite";

const origin = "http://127.0.0.1:5178";
const root = process.cwd();
const outDir = path.resolve(root, ".test-artifacts/visual-app");
if (!outDir.startsWith(root + path.sep)) throw new Error("Visual output must stay inside the workspace.");
// Test entries stay outside the product build. Bundling avoids hundreds of ESM
// requests per navigation and Windows ERR_NO_BUFFER_SPACE during complete runs.
await build({
  mode: "development",
  define: { "process.env.NODE_ENV": JSON.stringify("development") },
  build: { target: "esnext", outDir, emptyOutDir: true, sourcemap: false,
    rollupOptions: { input: {
      main: path.resolve(root, "index.html"), silentRenew: path.resolve(root, "silent-renew.html"),
      visual: path.resolve(root, "src/test/visual/index.html"), session: path.resolve(root, "src/test/visual/session.html"),
    } },
  },
});
let ready = false;
const server = await preview({
  configFile: false,
  mode: "development", build: { outDir },
  preview: { host: "127.0.0.1", port: 5178, strictPort: true, proxy: {} },
  plugins: [{ name: "visual-readiness", configurePreviewServer(viteServer) {
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
