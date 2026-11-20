import { expect, test, type Page } from "@playwright/test";

// «Asistente» of the WhatsApp panel with the boards AS1-A, AS2, AS3 and AS5 (adjusted on 2026-11-11): the cases with the editor at
// the side, a new agent in Perfil with its notice, Límites, Conocimiento and Probar with a result, in es/en at 1440, 390 and 320.
// The clock is fixed: the times of a test do not change.
const words = {
  es: { title: "Agente principal", cases: "Casos", profile: "Perfil", limits: "Límites", knowledge: "Conocimiento", edit: "Editar el caso 3", editor: "Caso 3", done: "Listo",
    test: "Probar", panel: "Probar el asistente", recipient: "Como si escribiera", messages: "Mensajes", actions: "Acciones, en orden (3)", notice: "El agente principal todavía no tiene perfil.",
    save: "Guardar", discard: "Descartar", tabs: "Partes del agente principal", menu: "Menú de Ana Pérez" },
  en: { title: "Main agent", cases: "Cases", profile: "Profile", limits: "Limits", knowledge: "Knowledge", edit: "Edit case 3", editor: "Case 3", done: "Done",
    test: "Test", panel: "Test the assistant", recipient: "As if written by", messages: "Messages", actions: "Actions, in order (3)", notice: "The main agent doesn't have a profile yet.",
    save: "Save", discard: "Discard", tabs: "Parts of the main agent", menu: "Ana Pérez's menu" },
} as const;

async function open(page: Page, language: "es" | "en", width: number, scenario = "agent-cases", tab?: string) {
  await page.setViewportSize({ width, height: width < 768 ? 900 : 1100 });
  await page.clock.setFixedTime(new Date("2026-11-11T15:42:00Z"));
  await page.goto(`/src/test/visual/index.html?screen=${encodeURIComponent("/whatsapp/asistente" + (tab ? "?pestana=" + tab : ""))}&scenario=${scenario}&lang=${language}`);
  await page.getByRole("button", { name: words[language].menu, exact: true }).waitFor({ state: "visible" });
  await expect(page.getByRole("heading", { level: 1, name: words[language].title })).toBeVisible();
  await expect(page.getByRole("tablist", { name: words[language].tabs })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
const fitsWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
// On the phone Descartar and Guardar go at the bottom, fixed; on the desktop, in the band of the screen.
async function expectSaveInPlace(page: Page, language: "es" | "en", width: number) {
  const save = page.getByRole("button", { name: words[language].save, exact: true });
  await expect(save).toBeVisible();
  const box = (await save.boundingBox())!;
  const header = (await page.getByRole("heading", { level: 1, name: words[language].title }).boundingBox())!;
  if (width < 640) expect(box.y).toBeGreaterThan(header.y + 200);
  else expect(Math.abs(box.y - header.y)).toBeLessThan(40);
}

for (const language of ["es", "en"] as const) {
  const text = words[language];
  for (const width of [1440, 390, 320]) {
    test(`assistant cases in ${language} at ${width}px`, async ({ page }) => {
      await open(page, language, width);
      await expect(page.getByRole("tab", { name: new RegExp(text.cases) })).toHaveAttribute("aria-selected", "true");
      await expectSaveInPlace(page, language, width);
      // The tabs scroll sideways inside their own row; the page never does.
      expect(await fitsWidth(page)).toBe(true);
      await expect(page).toHaveScreenshot(`assistant-agent-cases-${language}-${width}.png`, { fullPage: true });
      await page.getByRole("button", { name: text.edit, exact: true }).click();
      const editor = page.getByRole("dialog", { name: text.editor });
      await expect(editor).toBeVisible();
      await expect(editor.getByRole("button", { name: text.done, exact: true })).toBeVisible();
      expect(await fitsWidth(page)).toBe(true);
      await expect(page).toHaveScreenshot(`assistant-agent-case-editor-${language}-${width}.png`, { fullPage: true });
      await page.keyboard.press("Escape");
      await expect(editor).toHaveCount(0);
      await expect(page.getByRole("button", { name: text.edit, exact: true })).toBeFocused();
    });

    test(`a new assistant opens in its profile in ${language} at ${width}px`, async ({ page }) => {
      await open(page, language, width, "agent-empty");
      await expect(page.getByRole("tab", { name: text.profile })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("status").filter({ hasText: text.notice })).toBeVisible();
      await expect(page.getByRole("button", { name: text.save, exact: true })).toBeDisabled();
      expect(await fitsWidth(page)).toBe(true);
      await expect(page).toHaveScreenshot(`assistant-agent-profile-empty-${language}-${width}.png`, { fullPage: true });
    });

    test(`assistant limits in ${language} at ${width}px`, async ({ page }) => {
      await open(page, language, width, "agent-cases", "limites");
      await expect(page.getByRole("tab", { name: text.limits })).toHaveAttribute("aria-selected", "true");
      expect(await fitsWidth(page)).toBe(true);
      await expect(page).toHaveScreenshot(`assistant-agent-limits-${language}-${width}.png`, { fullPage: true });
    });

    test(`assistant knowledge in ${language} at ${width}px`, async ({ page }) => {
      await open(page, language, width, "agent-cases", "conocimiento");
      await expect(page.getByRole("tab", { name: text.knowledge })).toHaveAttribute("aria-selected", "true");
      expect(await fitsWidth(page)).toBe(true);
      await expect(page).toHaveScreenshot(`assistant-agent-knowledge-${language}-${width}.png`, { fullPage: true });
    });

    test(`testing the assistant in ${language} at ${width}px`, async ({ page }) => {
      await open(page, language, width);
      await page.getByRole("button", { name: text.test, exact: true }).click();
      const panel = page.getByRole("dialog", { name: text.panel });
      // DS1-A: the account is the only piece to choose, its e-mail in grey under its name; on the phone the list takes the screen.
      await panel.getByRole("button", { name: new RegExp("^" + text.recipient) }).click();
      await page.getByRole("listbox", { name: text.recipient }).getByRole("option", { name: "Juan Gómez", exact: true }).click();
      await panel.getByRole("textbox", { name: text.messages }).fill(language === "es" ? "Hola\nEstoy en la sucursal Centro\nSe rompió la heladera y necesito un repuesto" : "Hi\nI'm at the Centro branch\nThe fridge broke and I need a part");
      await panel.getByRole("button", { name: text.test, exact: true }).click();
      await expect(panel.getByText(text.actions, { exact: true })).toBeVisible();
      expect(await fitsWidth(page)).toBe(true);
      await expect(page).toHaveScreenshot(`assistant-agent-test-${language}-${width}.png`, { fullPage: true });
    });
  }
}
