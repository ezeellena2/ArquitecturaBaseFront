import { test, expect } from "@playwright/test";

for (const lang of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test(`internal assistant conversations ${lang} ${width}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.clock.install({ time: new Date("2026-10-04T15:00:00Z") });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/src/test/visual/index.html?${new URLSearchParams({ screen: "/", lang, scenario: "assistant-history" })}`);
    const field = page.getByRole("textbox", { name: lang === "es" ? "Tu pregunta" : "Your question", exact: true });
    await expect(field).toBeVisible();
    await expect(page.getByRole("heading", { name: lang === "es" ? "¿Qué querés consultar?" : "What would you like to know?", exact: true })).toBeVisible();
    await field.fill("Private unsent draft");
    const show = page.getByRole("button", { name: lang === "es" ? "Mostrar conversaciones" : "Show conversations", exact: true });
    if (width < 1024) await show.click();
    const panel = width < 1024 ? page.getByRole("dialog", { name: lang === "es" ? "Conversaciones" : "Conversations", exact: true }) : page.getByRole("complementary", { name: lang === "es" ? "Conversaciones" : "Conversations", exact: true });
    await expect(panel.getByText(lang === "es" ? "Hoy" : "Today", { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`assistant-conversations-${lang}-${width}.png`);
    const next = panel.getByRole("button", { name: lang === "es" ? "Página siguiente" : "Next page", exact: true });
    await next.click();
    await expect(panel.getByText(lang === "es" ? "21–24 de 24" : "21–24 of 24", { exact: true })).toBeVisible();
    const listRequests = await page.evaluate(() => window.assistantHistoryTestState.reads.filter(url => new URL(url).pathname.endsWith("/conversations")));
    expect(listRequests.some(url => new URL(url).searchParams.get("page") === "2")).toBe(true);
    expect(listRequests.every(url => new URL(url).searchParams.get("pageSize") === "20")).toBe(true);
    await panel.getByRole("button", { name: lang === "es" ? "Página anterior" : "Previous page", exact: true }).click();
    const row = panel.getByRole("button", { name: lang === "es" ? "¿Cuántos usuarios activos e inactivos hay?" : "How many active and inactive users are there?", exact: true });
    await row.click();
    const decision = page.getByRole("dialog", { name: lang === "es" ? "¿Empezar otra conversación?" : "Start another conversation?", exact: true });
    await decision.getByRole("button", { name: lang === "es" ? "Seguir editando" : "Keep editing", exact: true }).click();
    await expect(row).toBeFocused();
    // A drawer traps focus; close it before reading/focusing its underlying editor.
    if (width < 1024) await page.keyboard.press("Escape");
    await expect(field).toHaveValue("Private unsent draft");
    await field.fill("");
    if (width < 1024) await show.click();
    await row.click();
    await expect(page.getByRole("heading", { name: lang === "es" ? "Fuentes verificadas" : "Verified sources", exact: true })).toBeVisible();
    if (width < 1024) { await expect(panel).not.toBeVisible(); await show.click(); }
    const more = panel.getByRole("button", { name: lang === "es" ? /^Acciones de ¿Cuántos/ : /^Actions for How many/ });
    if (width < 1024) expect((await more.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await more.focus();
    await page.keyboard.press("Enter");
    const remove = page.getByRole("menuitem", { name: lang === "es" ? "Eliminar conversación" : "Delete conversation", exact: true });
    await expect(remove).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(more).toBeFocused();
    await page.keyboard.press("Enter");
    await remove.click();
    const confirm = page.getByRole("dialog", { name: lang === "es" ? "¿Eliminar esta conversación?" : "Delete this conversation?", exact: true });
    await confirm.getByRole("button", { name: lang === "es" ? "Cancelar" : "Cancel", exact: true }).click();
    await expect(more).toBeFocused();
    expect(await page.evaluate(() => window.assistantHistoryTestState.writes)).toBe(0);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
