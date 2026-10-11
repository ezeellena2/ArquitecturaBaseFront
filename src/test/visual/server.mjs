import { createServer } from "vite";

const origin = "http://127.0.0.1:5178";
const roots = [
  "/src/test/visual/preview.tsx",
  "/src/features/artificial-intelligence/pages/BusinessInformationPage.tsx",
  "/src/features/business-forms/pages/FormEditorPage.tsx",
];
let ready = false;
const server = await createServer({
  server: { host: "127.0.0.1", port: 5178, strictPort: true },
  plugins: [{
    name: "visual-readiness",
    configureServer(viteServer) {
      // Register before Vite can serve the SPA fallback with status 200.
      viteServer.middlewares.use((request, response, next) => {
        if (new URL(request.url ?? "/", origin).pathname !== "/__visual_ready") return next();
        response.statusCode = ready ? 200 : 503;
        response.setHeader("Content-Type", "text/plain");
        response.end(ready ? "ready" : "preparing");
      });
    },
  }],
});
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => {
  await server.close();
  process.exit(0);
});

try {
  await server.listen();
  const queue = [...roots];
  const visited = new Set();
  while (queue.length) {
    const modulePath = queue.shift();
    if (visited.has(modulePath)) continue;
    visited.add(modulePath);
    const url = new URL(modulePath, origin);
    if (url.origin !== origin || url.pathname.startsWith("/api/")) throw new Error("Visual warmup requires a local module URL.");
    const response = await fetch(url);
    if (!response.ok) throw new Error("Visual module readiness failed (" + response.status + "): " + url.pathname);
    if (response.headers.get("Content-Type")?.includes("text/html")) throw new Error("Visual module returned HTML: " + url.pathname);
    await response.arrayBuffer();
    const module = await server.environments.client.moduleGraph.getModuleByUrl(modulePath);
    for (const dependency of module?.importedModules ?? []) {
      // Vite marks Tailwind watch files/globs as assets, not browser modules.
      if (dependency.type === "asset") continue;
      const dependencyUrl = dependency.id?.startsWith("\0")
        ? "/@id/" + dependency.id.replaceAll("\0", "__x00__")
        : dependency.url;
      queue.push(dependencyUrl);
    }
  }
  ready = true;
  console.log("Visual catalogue modules ready: " + visited.size);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Visual catalogue startup failed.");
  await server.close();
  process.exitCode = 1;
}
