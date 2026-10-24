import { expect, test, type Locator } from "@playwright/test";
import { fixtureFormId } from "./formFixtures";
import { responseFormId } from "../responseFixtures";
for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("PDF design preview and independent save " + language + " at " + width, async ({ page }) => {
    const en = language === "en";
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/src/test/visual/index.html?screen=/formularios/" + fixtureFormId + "/pdf&scenario=forms-pdf&lang=" + language);
    // No language selector: the name is edited in the menu language; in English it is the translation, with the original as a reference.
    const name = page.getByRole("textbox", { name: en ? "PDF name" : "Nombre del PDF", exact: true });
    await expect(name).toBeVisible();
    await expect(name).toHaveValue(en ? "" : "Comprobante de visita");
    if (en) await expect(name).toHaveAccessibleDescription("Original (Spanish): Comprobante de visita");
    await page.evaluate(() => {
      const revoke = URL.revokeObjectURL.bind(URL);
      const revoked: string[] = [];
      Object.assign(window, { pdfRevokedUrls: revoked });
      URL.revokeObjectURL = url => { revoked.push(url); revoke(url); };
    });
    const preview = page.getByRole("region", { name: en ? "Preview" : "Vista previa", exact: true });
    await preview.getByRole("button", { name: en ? "Preview" : "Vista previa", exact: true }).click();
    await expect(preview.getByText(en ? "English is incomplete. The preview uses all content in Spanish." : "Contenido en Español", { exact: true })).toBeVisible();
    const frame = preview.locator("iframe");
    await expect(frame).toHaveAttribute("src", /^blob:/);
    await expect(frame).not.toHaveAttribute("sandbox");
    const firstUrl = await frame.getAttribute("src");
    const alternative = preview.getByRole("link", { name: en ? "Download" : "Descargar", exact: true });
    await expect(alternative).toHaveAttribute("href", firstUrl!);
    const exampleDownload = page.waitForEvent("download");
    await alternative.click();
    expect((await exampleDownload).suggestedFilename()).toBe("example.pdf");
    const photos = page.getByRole("checkbox", { name: en ? "Include photos" : "Incluir las fotos", exact: true });
    await photos.focus();
    await page.keyboard.press("Space");
    await expect(photos).not.toBeChecked();
    await expect(frame).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { pdfRevokedUrls: string[] }).pdfRevokedUrls)).toContain(firstUrl);
    await page.getByRole("button", { name: en ? "Save design" : "Guardar diseño", exact: true }).click();
    await expect(page.getByText(en ? /Revision 1/ : /Revisión 1/)).toBeVisible();
    expect(await page.evaluate(() => (globalThis as unknown as { pdfsFixture: { writes: Array<{ design: { includePhotos: boolean } }> } }).pdfsFixture.writes.map(item => item.design.includePhotos))).toEqual([false]);
    await preview.getByRole("button", { name: en ? "Preview" : "Vista previa", exact: true }).click();
    await expect(frame).toHaveAttribute("src", /^blob:/);
    await expect(frame).not.toHaveAttribute("sandbox");
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: "test-results/pdf-design-" + language + "-" + width + ".png", fullPage: true });
  });
  test("issued PDF fixed copy " + language + " at " + width, async ({ page }) => {
    const en = language === "en";
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/src/test/visual/index.html?screen=/formularios/" + responseFormId + "/respuestas&scenario=responses-pdf&lang=" + language);
    const marker = page.getByRole("button", { name: en ? "View PDF for TEST-000002" : "Ver PDF de TEST-000002", exact: true });
    await expect(marker).toBeVisible();
    await page.evaluate(() => {
      const original = window.fetch;
      const reads: string[] = [];
      const revoked: string[] = [];
      const revoke = URL.revokeObjectURL.bind(URL);
      Object.assign(window, { fixedPdfReads: reads, fixedPdfRevokedUrls: revoked });
      URL.revokeObjectURL = url => { revoked.push(url); revoke(url); };
      window.fetch = (input, init) => {
        const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
        const url = new URL(request.url);
        if (url.pathname.includes("/documents/")) reads.push(url.searchParams.get("download")!);
        return original(input, init);
      };
    });
    await marker.click();
    const mobile = width < 640;
    const panel = mobile ? page.getByRole("main") : page.getByRole("region", { name: en ? "Response details" : "Detalle de la respuesta", exact: true });
    let documents: Locator;
    let miniUrl: string | null = null;
    if (mobile) {
      await expect(panel.getByRole("heading", { name: "TEST-000002", level: 1, exact: true })).toBeVisible();
      const activity = panel.getByRole("region", { name: en ? "Activity" : "Actividad", exact: true });
      const collapse = activity.getByRole("button", { name: en ? "Collapse activity" : "Plegar actividad", exact: true });
      await expect(collapse).toHaveAttribute("aria-expanded", "true");
      documents = activity.getByRole("listitem").filter({ has: page.getByText(en ? "Generate PDF" : "Armar el PDF", { exact: true }) }).last();
      await expect(documents.getByText("Visita-VIS-000024.pdf", { exact: true })).toBeVisible();
      const mini = documents.locator("iframe");
      await expect(mini).toHaveAttribute("src", /^blob:/);
      await expect(mini).not.toHaveAttribute("sandbox");
      miniUrl = await mini.getAttribute("src");
      expect(await page.evaluate(() => (window as unknown as { fixedPdfReads: string[] }).fixedPdfReads)).toEqual(["false"]);
      await page.screenshot({ path: "test-results/pdf-panel-" + language + "-" + width + ".png", fullPage: true });
    } else {
      await expect(panel.getByRole("tab", { name: "PDF", exact: true })).toHaveAttribute("aria-selected", "true");
      documents = panel.getByRole("region", { name: en ? "Response PDF" : "PDF de la respuesta", exact: true });
      await expect(documents.getByText("Visita-VIS-000024.pdf", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => (window as unknown as { fixedPdfReads: string[] }).fixedPdfReads)).toEqual([]);
      await page.screenshot({ path: "test-results/pdf-panel-" + language + "-" + width + ".png", fullPage: true });
    }
    const view = documents.getByRole("button", { name: en ? "View PDF" : "Ver PDF", exact: true });
    await view.click();
    const dialog = page.getByRole("dialog", { name: en ? "Fixed copy" : "Copia fija", exact: true });
    await expect(dialog.getByRole("heading", { name: en ? "Fixed copy" : "Copia fija", exact: true })).toBeVisible();
    const frame = dialog.locator("iframe");
    await expect(frame).toHaveAttribute("src", /^blob:/);
    await expect(frame).not.toHaveAttribute("sandbox");
    const fixedUrl = await frame.getAttribute("src");
    if (mobile) expect(fixedUrl).toBe(miniUrl);
    const alternative = dialog.getByRole("link", { name: en ? "Download" : "Descargar", exact: true });
    await expect(alternative).toHaveAttribute("href", fixedUrl!);
    const fallbackDownload = page.waitForEvent("download");
    await alternative.click();
    expect((await fallbackDownload).suggestedFilename()).toBe("Visita-VIS-000024.pdf");
    expect(await page.evaluate(() => (window as unknown as { fixedPdfReads: string[] }).fixedPdfReads)).toEqual(["false"]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: "test-results/pdf-fixed-" + language + "-" + width + ".png", fullPage: true });
    await dialog.getByRole("button", { name: en ? "Close" : "Cerrar", exact: true }).first().click();
    await expect(view).toBeFocused();
    if (mobile) {
      expect(await page.evaluate(() => (window as unknown as { fixedPdfRevokedUrls: string[] }).fixedPdfRevokedUrls)).not.toContain(fixedUrl);
      const activity = panel.getByRole("region", { name: en ? "Activity" : "Actividad", exact: true });
      await activity.getByRole("button", { name: en ? "Collapse activity" : "Plegar actividad", exact: true }).click();
      await activity.getByRole("button", { name: en ? "Expand activity" : "Expandir actividad", exact: true }).click();
      await expect(documents.locator("iframe")).toHaveAttribute("src", fixedUrl!);
      expect(await page.evaluate(() => (window as unknown as { fixedPdfReads: string[] }).fixedPdfReads)).toEqual(["false"]);
      expect(await page.evaluate(() => (window as unknown as { fixedPdfRevokedUrls: string[] }).fixedPdfRevokedUrls)).not.toContain(fixedUrl);
      await panel.getByRole("button", { name: en ? "Download" : "Descargar", exact: true, expanded: false }).click();
      const download = page.waitForEvent("download");
      await page.getByRole("menuitem", { name: "Visita-VIS-000024.pdf", exact: true }).click();
      expect((await download).suggestedFilename()).toBe("Visita-VIS-000024.pdf");
      expect(await page.evaluate(() => (window as unknown as { fixedPdfReads: string[] }).fixedPdfReads)).toEqual(["false", "true"]);
      await panel.getByRole("link", { name: en ? "Back to responses" : "Volver a las respuestas", exact: true }).click();
      await expect(marker).toBeVisible();
      await expect.poll(() => page.evaluate(() => (window as unknown as { fixedPdfRevokedUrls: string[] }).fixedPdfRevokedUrls)).toContain(fixedUrl);
    } else {
      expect(await page.evaluate(() => (window as unknown as { fixedPdfRevokedUrls: string[] }).fixedPdfRevokedUrls)).toContain(fixedUrl);
      const download = page.waitForEvent("download");
      await documents.getByRole("button", { name: en ? "Download" : "Descargar", exact: true }).click();
      expect((await download).suggestedFilename()).toBe("Visita-VIS-000024.pdf");
      expect(await page.evaluate(() => (window as unknown as { fixedPdfReads: string[] }).fixedPdfReads)).toEqual(["false", "true"]);
    }
    expect(await page.evaluate(() => (globalThis as unknown as { pdfsFixture: { writes: unknown[] } }).pdfsFixture.writes)).toEqual([]);
  });
}
