import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const base = process.env.CONVERSATIONS_PREVIEW_ORIGIN ?? "http://127.0.0.1:5182";
const evidence = fileURLToPath(new URL("./evidence/", import.meta.url));
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const failures = [];
const errors = [];
const consoleMessages = [];
const assistantRequests = [];
const results = [];
const scenes = ["empty", "answer", "loading", "error", "noHistory", "blocked", "expired", "active", "uncertain", "denied"];
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (["error", "warning"].includes(message.type())) consoleMessages.push({ type: message.type(), text: message.text() });
  });
  page.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/api/ai/assistant")) assistantRequests.push(request.url());
  });
  async function visit(scene, lang = "es", width = 1440, extras = "") {
    await page.setViewportSize({ width, height: width < 1000 ? 844 : 1000 });
    await page.goto(`${base}/design-lab/home-assistant/conversations/index.html?lang=${lang}&scene=${scene}&review=1${extras}`);
    if (scene === "denied") await page.getByRole("heading", { name: lang === "es" ? "No tenés permiso" : "You don't have permission", exact: true }).waitFor();
    else await page.locator(".conversation-workspace").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Horizontal overflow: ${scene}/${lang}/${width}`);
  }
  async function check(name, action) {
    try { await action(); results.push(name); }
    catch (error) { failures.push(`${name}: ${error.message}`); }
  }
  for (const lang of ["es", "en"]) {
    for (const scene of scenes) {
      await check(`${scene}/${lang}/1440`, async () => {
        await visit(scene, lang);
        await page.screenshot({ path: `${evidence}${scene}-${lang}-1440.png` });
      });
    }
  }
  await check("Desktop collapse, reopen, resume and new", async () => {
    await visit("empty");
    assert.equal(await page.getByRole("textbox").inputValue(), "");
    await page.getByRole("button", { name: "Ocultar conversaciones", exact: true }).click();
    await page.locator(".conversation-desktop-panel").waitFor({ state: "detached" });
    await page.screenshot({ path: `${evidence}empty-es-1440-closed.png` });
    await page.getByRole("button", { name: "Mostrar conversaciones", exact: true }).click();
    await page.getByRole("button", { name: /¿Cuántos usuarios activos e inactivos hay\?/ }).first().click();
    await page.getByText("Hay 3 usuarios activos y 1 inactivo.", { exact: false }).waitFor();
    await page.getByRole("button", { name: "Nueva conversación", exact: true }).click();
    assert.equal(await page.locator(".assistant-message").count(), 0);
  });
  await check("Draft decision preserves or discards text", async () => {
    await visit("empty");
    await page.getByRole("textbox").fill("Pregunta todavía sin enviar");
    await page.getByRole("button", { name: "Nueva conversación", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await page.screenshot({ path: `${evidence}draft-confirm-es-1440.png` });
    await page.getByRole("button", { name: "Seguir acá", exact: true }).click();
    assert.equal(await page.getByRole("textbox").inputValue(), "Pregunta todavía sin enviar");
    await page.getByRole("button", { name: "Nueva conversación", exact: true }).click();
    await page.getByRole("button", { name: "Descartar y continuar", exact: true }).click();
    assert.equal(await page.getByRole("textbox").inputValue(), "");
  });
  await check("Deletion needs confirmation and clears selection", async () => {
    await visit("answer");
    const selectedTitle = "¿Cuántos usuarios activos e inactivos hay?";
    await page.getByRole("button", { name: `Más acciones: ${selectedTitle}`, exact: true }).click();
    await page.getByRole("menuitem", { name: "Eliminar", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await page.screenshot({ path: `${evidence}delete-confirm-es-1440.png` });
    await page.getByRole("dialog").getByRole("button", { name: "Eliminar", exact: true }).click();
    assert.equal(await page.locator(".conversation-select", { hasText: selectedTitle }).count(), 0);
    assert.equal(await page.getByRole("textbox").inputValue(), "");
  });
  for (const lang of ["es", "en"]) {
    for (const width of [390, 320]) {
      for (const scene of ["empty", "answer"]) {
        await check(`${scene}/${lang}/${width} and drawer`, async () => {
          await visit(scene, lang, width);
          await page.screenshot({ path: `${evidence}${scene}-${lang}-${width}.png` });
          const trigger = page.getByRole("button", { name: lang === "es" ? "Mostrar conversaciones" : "Show conversations", exact: true });
          await trigger.click();
          const dialog = page.getByRole("dialog");
          await dialog.waitFor();
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
          await page.screenshot({ path: `${evidence}${scene}-${lang}-${width}-drawer.png` });
          await page.keyboard.press("Escape");
          await dialog.waitFor({ state: "detached" });
          await page.waitForTimeout(200);
          assert.equal(await trigger.evaluate(element => element === document.activeElement), true, "Drawer restores trigger focus");
        });
      }
    }
  }
  await check("Local send creates only a preview conversation", async () => {
    await visit("noHistory");
    await page.getByRole("textbox").fill("Consulta de prueba local");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await page.locator(".conversation-select", { hasText: "Consulta de prueba local" }).waitFor();
    await page.getByText("Esta es una respuesta de muestra para revisar el diseño.", { exact: false }).waitFor();
  });
  await check("Bounded pages use the shared pager and URL", async () => {
    await visit("empty");
    assert.equal(await page.locator(".conversation-select").count(), 6);
    await page.getByRole("button", { name: "Página siguiente", exact: true }).click();
    assert.equal(new URL(page.url()).searchParams.get("page"), "2");
    assert.equal(await page.locator(".conversation-select").count(), 6);
    await page.screenshot({ path: `${evidence}empty-es-1440-page-2.png` });
    await page.getByRole("button", { name: "Página anterior", exact: true }).click();
    assert.equal(new URL(page.url()).searchParams.get("page"), "1");
  });
  await check("Native thread list keyboard and menu keep selection and draft", async () => {
    await visit("empty");
    const first = page.locator(".conversation-select").first();
    const second = page.locator(".conversation-select").nth(1);
    await first.focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(await second.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press("Enter");
    await page.locator('.conversation-list-row[data-active="true"]').waitFor();
    await page.getByRole("textbox").fill("Borrador a conservar");
    const menuTrigger = page.getByRole("button", { name: "Más acciones: ¿Qué permisos tiene el rol Soporte?", exact: true });
    await menuTrigger.click();
    await page.getByRole("menu").waitFor();
    await page.screenshot({ path: `${evidence}row-actions-es-1440.png` });
    await page.keyboard.press("Escape");
    assert.equal(await menuTrigger.evaluate(element => element === document.activeElement), true);
    assert.equal(await page.getByRole("textbox").inputValue(), "Borrador a conservar");
    await menuTrigger.click();
    await page.getByRole("menuitem", { name: "Eliminar", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar", exact: true }).click();
    assert.equal(await menuTrigger.evaluate(element => element === document.activeElement), true, "Cancel deletion restores its row action trigger");
    assert.equal(await page.getByRole("textbox").inputValue(), "Borrador a conservar");
    await page.getByRole("button", { name: "Nueva conversación", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Seguir acá", exact: true }).click();
    assert.equal(await page.getByRole("textbox").inputValue(), "Borrador a conservar");
  });
  await check("Mobile native row menu works inside the drawer", async () => {
    await visit("empty", "es", 320);
    await page.getByRole("button", { name: "Mostrar conversaciones", exact: true }).click();
    const drawer = page.getByRole("dialog");
    const trigger = drawer.getByRole("button", { name: "Más acciones: ¿Cuántos usuarios activos e inactivos hay?", exact: true });
    assert.ok((await trigger.boundingBox()).height >= 44);
    await trigger.click();
    await page.getByRole("menuitem", { name: "Eliminar", exact: true }).click();
    await page.getByRole("dialog").filter({ hasText: "¿Eliminar esta conversación?" }).getByRole("button", { name: "Cancelar", exact: true }).click();
    await drawer.locator(".conversation-select").first().click();
    await drawer.waitFor({ state: "detached" });
    await page.getByText("Hay 3 usuarios activos y 1 inactivo.", { exact: false }).waitFor();
  });
  await check("Uncertain acceptance freezes navigation and composer", async () => {
    await visit("uncertain");
    assert.equal(await page.getByRole("button", { name: "Nueva conversación", exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole("textbox").isDisabled(), true);
    await page.getByRole("button", { name: "Consultar estado", exact: true }).click();
    assert.equal(await page.getByRole("textbox").isDisabled(), false);
  });
  assert.deepEqual(errors, [], "Unhandled browser errors");
  assert.deepEqual(consoleMessages, [], "Browser console warnings and caught rendering errors");
  assert.deepEqual(assistantRequests, [], "Preview must not contact the assistant API");
} finally {
  await browser.close();
  await writeFile(`${evidence}verification.json`, JSON.stringify({ results, failures, errors, consoleMessages, assistantRequests }, null, 2));
}
process.stdout.write(JSON.stringify({ passed: results.length, failures, errors, consoleMessages: [...new Set(consoleMessages.map(message => message.text))], assistantRequests }, null, 2) + "\n");
if (failures.length) process.exitCode = 1;
