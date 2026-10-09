import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const out = path.resolve(import.meta.dirname, "evidence");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const checks = [];
try {
  const page = await browser.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") throw new Error(`Unexpected network origin: ${url.origin}`);
    await route.continue();
  });
  for (const lang of ["es", "en"]) {
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 900 });
      for (const scene of ["empty", "answer", "loading", "paused", "missing", "denied", "uncertain", "failure"]) {
        await page.goto(`http://127.0.0.1:5182/design-lab/home-assistant/index.html?lang=${lang}&scene=${scene}`);
        await page.getByRole("heading", { name: lang === "es" ? "Inicio" : "Home", exact: true }).waitFor();
        await page.evaluate(() => document.fonts.ready);
        const geometry = await page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth, mainScroll: document.querySelector("main")?.scrollWidth, mainWidth: document.querySelector("main")?.clientWidth }));
        if (geometry.scroll > geometry.width + 1 || geometry.mainScroll > geometry.mainWidth + 1) throw new Error(`Overflow ${lang}/${width}/${scene}: ${JSON.stringify(geometry)}`);
        if (["empty", "answer"].includes(scene)) await page.screenshot({ path: path.join(out, `${scene}-${lang}-${width}.png`), fullPage: true });
        checks.push({ lang, width, scene, geometry });
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://127.0.0.1:5182/design-lab/home-assistant/index.html?lang=es&scene=empty");
  await page.getByRole("button", { name: "¿Cuántos usuarios activos hay?", exact: true }).click();
  const question = page.getByRole("textbox", { name: "Tu pregunta" });
  if (await question.inputValue() !== "¿Cuántos usuarios activos hay?") throw new Error("Suggestion does not prepare draft");
  await page.getByRole("button", { name: "Nueva conversación", exact: true }).click();
  await page.getByRole("button", { name: "Seguir escribiendo", exact: true }).click();
  if (!await question.inputValue()) throw new Error("Cancel discarded draft");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await page.getByText("Hay 3 usuarios activos.", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Ver datos consultados" }).click();
  await page.getByRole("dialog").waitFor();
  await page.screenshot({ path: path.join(out, "sources-es-1440.png"), fullPage: true });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Historial", exact: true }).click();
  await page.getByRole("heading", { name: "Tus conversaciones" }).waitFor();
  await page.getByRole("button", { name: "Eliminar conversación", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await question.fill("Un borrador que se conserva");
  await page.locator("#assistant-scene").selectOption("failure");
  await page.getByRole("button", { name: "Reintentar", exact: true }).first().click();
  if (await question.inputValue() !== "Un borrador que se conserva") throw new Error("Retry discarded draft");
  if (errors.length) throw new Error(errors.join("\n"));
  await writeFile(path.join(out, "verification.json"), JSON.stringify({ states: checks.length, interactions: "draft, submit, sources, history, cancel delete, recovery", pageErrors: errors, checks }, null, 2));
  console.log(`Verified ${checks.length} responsive/language/state combinations and interaction recovery.`);
} finally {
  await browser.close();
}
