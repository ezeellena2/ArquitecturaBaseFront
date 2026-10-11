import { expect, test } from "@playwright/test";
for (const lang of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("R1 R2 R3 pure form replies " + lang + " at " + width + "px", async ({ page }) => {
    const en = lang === "en";
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/src/test/visual/index.html?screen=/form-replies&lang=" + lang);
    await expect(page.getByRole("heading", { name: en ? "R1–R3 · simulated presentation" : "R1–R3 · presentación simulada" })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const card = page.getByRole("group", { name: en ? "Form reply Register visit, saved as VIS-000001" : "Respuesta del formulario Registrar visita, guardada como VIS-000001", exact: true });
    const toggle = card.getByRole("button");
    await expect(toggle).toHaveAccessibleName(en ? "View all 7 answers" : "Ver las 7 respuestas");
    await toggle.scrollIntoViewIfNeeded();
    const before = await card.evaluate(node => node.getBoundingClientRect().top);
    await toggle.focus(); await page.keyboard.press("Enter");
    await expect(card.getByText(en ? "125,500.00" : "125.500,00", { exact: true })).toBeVisible();
    await expect(card.getByText("0", { exact: true })).toBeVisible();
    await expect(card.getByText("No", { exact: true })).toBeVisible();
    await expect(card.getByText(en ? "No answer" : "Sin respuesta", { exact: true })).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(Math.abs(await card.evaluate(node => node.getBoundingClientRect().top) - before)).toBeLessThanOrEqual(2);
    await expect(toggle).toBeFocused();
    await card.screenshot({path: "test-results/form-replies-values-" + lang + "-" + width + ".png"});
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    const longCard = page.getByRole("group", { name: en ? "Form reply Register visit, saved as VIS-000002" : "Respuesta del formulario Registrar visita, guardada como VIS-000002", exact: true });
    const longToggle = longCard.getByRole("button");
    await expect(longToggle).toHaveAccessibleName(en ? "View the complete answer" : "Ver la respuesta completa");
    await longToggle.scrollIntoViewIfNeeded(); await longToggle.click();
    await expect(longToggle).toHaveAttribute("aria-expanded", "true");
    expect(await longCard.getByText(/Private long answer/).textContent()).toContain("The client signed, please deliver the remaining boxes on Monday.");
    await page.getByRole("button", { name: en ? "Revoke answer access" : "Revocar lectura de respuestas" }).click();
    await expect(page.getByText(/Private long answer/)).toHaveCount(0);
    await expect(page.getByText("All good, the client signed.", { exact: true })).toHaveCount(0);
    await expect(page.getByText(en ? "You no longer have permission to view these answers." : "Ya no tenés permiso para ver estas respuestas.")).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: "test-results/form-replies-revoked-" + lang + "-" + width + ".png", fullPage: true });
  });
}
