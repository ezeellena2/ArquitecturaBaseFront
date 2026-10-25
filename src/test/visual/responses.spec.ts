import { expect, test } from "@playwright/test";
import { responseFormId, responseRecordId } from "../responseFixtures";
const root = `/formularios/${responseFormId}/respuestas`;
for (const language of ["es", "en"] as const)
  for (const width of [1440, 390, 320]) {
    test(`response sheet, filters, detail and export ${language} at ${width}px`, async ({
      page,
    }) => {
      const en = language === "en";
      await page.setViewportSize({ width, height: 900 });
      await page.goto(
        `/src/test/visual/index.html?screen=${root}&scenario=responses-files&lang=${language}`,
      );
      await expect(
        page.getByRole("link", { name: "TEST-000002", exact: true }),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      const table = page.getByRole("table", { includeHidden: true });
      await expect(table.getByText("0", { exact: true }).first()).toBeVisible();
      await expect(
        table.getByText(en ? "No" : "No", { exact: true }).first(),
      ).toBeVisible();
      await expect(
        table.getByText(en ? "Unanswered" : "Sin respuesta", { exact: true }),
      ).toBeVisible();
      await expect(table.getByText("—", { exact: true })).toBeVisible();
      await page.screenshot({
        path: `test-results/responses-t1-${language}-${width}.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", { name: en ? "Columns" : "Columnas", exact: true })
        .click();
      await expect(page.getByRole("menu")).toBeVisible();
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", {
          name: en ? "More filters" : "Más filtros",
          exact: true,
        })
        .click();
      const filters = page.getByRole("dialog");
      await expect(filters).toBeVisible();
      expect((await filters.boundingBox())!.width).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: `test-results/responses-t2-${language}-${width}.png`,
        fullPage: true,
      });
      await filters.press("Escape");
      await expect(
        page.getByRole("button", {
          name: en ? "More filters" : "Más filtros",
          exact: true,
        }),
      ).toBeFocused();
      await page
        .getByRole("button", {
          name: en ? "Export to Excel" : "Exportar a Excel",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("dialog", {
          name: en
            ? "Export responses to Excel"
            : "Exportar respuestas a Excel",
        }),
      ).toBeVisible();
      await page.screenshot({
        path: `test-results/responses-t5-${language}-${width}.png`,
        fullPage: true,
      });
      await page.keyboard.press("Escape");
      const privateSearch = page.getByRole("searchbox", { name: en ? "Search long text answers" : "Buscar en textos largos" });
      await privateSearch.fill("completo");
      await expect(privateSearch).toHaveValue("completo");
      await expect(page.getByText((en ? "Search long text answers" : "Buscar en textos largos") + ": completo", { exact: true })).toBeVisible();
      await page
        .getByRole("link", { name: "TEST-000002", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "TEST-000002", exact: true }),
      ).toBeVisible();
      if (width < 640) {
        const full = page.getByRole("main");
        await expect(page.getByRole("dialog", { name: en ? "Response details" : "Detalle de la respuesta", exact: true })).toHaveCount(0);
        await expect(table).toHaveCount(0);
        await expect(full.getByRole("button", { name: en ? "Collapse response" : "Plegar respuesta", exact: true })).toBeVisible();
        await expect(full.getByText("comprobante.pdf", { exact: true })).toBeVisible();
        await page.screenshot({ path: `test-results/responses-t3-${language}-${width}.png`, fullPage: true });
        const thumbnail = full.getByRole("button", { name: /entrega\.jpg/ }).first();
        await thumbnail.click();
        const viewer = page.getByRole("dialog", { name: en ? "Response photos" : "Fotos de la respuesta", exact: true });
        await expect(viewer.getByRole("img", { name: "entrega.jpg", exact: true })).toBeVisible();
        await viewer.press("Escape");
        await expect(thumbnail).toBeFocused();
        await full.getByRole("button", { name: en ? "Expand activity" : "Expandir actividad", exact: true }).click();
        await expect(full.getByRole("region", { name: en ? "Activity" : "Actividad", exact: true }).first()).toBeVisible();
        await page.screenshot({ path: `test-results/responses-dc-activity-${language}-${width}.png`, fullPage: true });
        await full.getByRole("button", { name: en ? "Next" : "Siguiente", exact: true }).click();
        await expect(full.getByRole("heading", { name: "TEST-000001", exact: true })).toBeVisible();
        await expect(full.getByRole("button", { name: en ? "Next" : "Siguiente", exact: true })).toBeDisabled();
        const container = full.getByRole("heading", { name: "TEST-000001", exact: true }).locator('xpath=ancestor::*[@tabindex="-1"][1]');
        await expect(container).toBeFocused();
        await container.press("ArrowUp");
        await expect(full.getByRole("heading", { name: "TEST-000002", exact: true })).toBeVisible();
        await full.getByRole("link", { name: en ? "Back to responses" : "Volver a las respuestas", exact: true }).click();
        await expect(page.getByRole("link", { name: "TEST-000002", exact: true })).toBeFocused();
        await expect(privateSearch).toHaveValue("completo");
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        return;
      }
      const panel = page.getByRole("region", { name: en ? "Response details" : "Detalle de la respuesta", exact: true });
      await expect(table).toBeAttached();
      await expect(panel.getByRole("tab", { name: en ? "Response" : "Respuesta", exact: true })).toHaveAttribute("aria-selected", "true");
      await expect(panel.getByText("comprobante.pdf", { exact: true })).toBeVisible();
      await page.screenshot({
        path: `test-results/responses-t3-${language}-${width}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await panel.getByRole("tab", { name: en ? "Photos (2)" : "Fotos (2)", exact: true }).click();
      const photosTab = panel.getByRole("tabpanel", { name: en ? "Photos (2)" : "Fotos (2)", exact: true });
      const thumbnail = photosTab.getByRole("button", { name: /entrega\.jpg/ }).first();
      await expect(thumbnail).toBeVisible();
      await page.screenshot({ path: "test-results/responses-d2-photos-" + language + "-" + width + ".png", fullPage: true });
      await thumbnail.click();
      const viewer = page.getByRole("dialog", { name: en ? "Response photos" : "Fotos de la respuesta", exact: true });
      await expect(viewer.getByRole("img", { name: "entrega.jpg", exact: true })).toBeVisible();
      await viewer.press("Escape");
      await expect(thumbnail).toBeFocused();
      await panel.getByRole("tab", { name: en ? "Activity" : "Actividad", exact: true }).click();
      await expect(panel.getByRole("region", { name: en ? "Activity" : "Actividad", exact: true })).toBeVisible();
      await page.screenshot({ path: "test-results/responses-d2-activity-" + language + "-" + width + ".png", fullPage: true });
      const next = panel.getByRole("button", { name: en ? "Next" : "Siguiente", exact: true });
      await next.focus();
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("heading", { name: "TEST-000001", exact: true }),
      ).toBeVisible();
      await expect(next).toBeDisabled();
      await expect(panel).toBeFocused();
      await panel.focus();
      await page.keyboard.press("ArrowUp");
      await expect(panel.getByRole("heading", { name: "TEST-000002", exact: true })).toBeVisible();
      await panel.getByRole("tab", { name: en ? "Response" : "Respuesta", exact: true }).focus();
      await page.keyboard.press("ArrowDown");
      await expect(panel.getByRole("heading", { name: "TEST-000002", exact: true })).toBeVisible();
      await panel.focus();
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
      const returned = page.getByRole("link", { name: "TEST-000002", exact: true });
      await expect(returned).toBeFocused();
      await expect(table).toBeAttached();
      await expect(privateSearch).toHaveValue("completo");
      expect(await returned.getAttribute("href")).not.toContain("completo");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
for (const [scenario, text] of [
  ["responses-empty", "Todavía no hay respuestas"],
  ["responses-missing", "No encontramos esa respuesta o no está disponible"],
  ["responses-revoked", "No tenés permiso"],
  ["responses-limit", "Podés exportar hasta 10.000 respuestas."],
] as const) {
  test(`response state ${scenario}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    const screen =
      scenario === "responses-missing" ? `${root}/${responseRecordId}` : root;
    await page.goto(
      `/src/test/visual/index.html?screen=${screen}&scenario=${scenario}&lang=es`,
    );
    if (scenario === "responses-limit") {
      await page
        .getByRole("button", { name: "Exportar a Excel", exact: true })
        .click();
      // The limit is the reason of the disabled download (tooltip and description), not a text in the dialog;
      // the disabled button does not receive the pointer, its wrapper does.
      const download = page
        .getByRole("dialog")
        .getByRole("button", { name: "Exportar a Excel", exact: true });
      await expect(download).toBeDisabled();
      await download.locator("..").hover();
      await expect(page.getByRole("tooltip")).toContainText(text);
    } else
      await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: `test-results/${scenario}.png`,
      fullPage: true,
    });
  });
}
test("private search stays out of URL and shows no matches", async ({
  page,
}) => {
  await page.goto(
    `/src/test/visual/index.html?screen=${root}&scenario=responses-files&lang=es`,
  );
  await page.getByRole("link", { name: "TEST-000002", exact: true }).waitFor();
  await page
    .getByRole("searchbox", { name: "Buscar en textos largos" })
    .fill("dato privado inexistente");
  await expect(
    page.getByText("Ninguna respuesta coincide", { exact: true }),
  ).toBeVisible();
  expect(page.url()).not.toContain("privado");
  await page
    .getByRole("button", { name: "Limpiar todo", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("link", { name: "TEST-000002", exact: true }),
  ).toBeVisible();
});
test("form overview pages server results instead of the retired response navigation", async ({ page }) => {
  const screen = encodeURIComponent("/formularios/respuestas?pageSize=2");
  await page.goto("/src/test/visual/index.html?screen=" + screen + "&scenario=forms-overview&lang=en");
  await expect(page.getByRole("heading", { name: "Forms", level: 1, exact: true })).toBeVisible();
  const table = page.getByRole("table");
  await expect(table.getByRole("link", { name: "Register visit", exact: true })).toBeVisible();
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(page.getByText("Page 1 of 3", { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    const original = window.fetch;
    const reads: string[] = [];
    Object.assign(window, { overviewPageReads: reads });
    window.fetch = (input, init) => {
      const request = input instanceof Request ? input : new Request(new URL(String(input), location.href), init);
      if (new URL(request.url).pathname === "/api/forms/overview") reads.push(request.url);
      return original(input, init);
    };
  });
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(table.getByRole("link", { name: "Site survey", exact: true })).toBeVisible();
  await expect(table.getByRole("link", { name: "Register visit", exact: true })).toHaveCount(0);
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(page.getByText("Page 2 of 3", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { overviewPageReads: string[] }).overviewPageReads.some(read => {
    const query = new URL(read).searchParams;
    return query.get("page") === "2" && query.get("pageSize") === "2";
  }))).toBe(true);
});

test("sheet photo opens the shared viewer with every photo and restores focus", async ({
  page,
}) => {
  await page.goto(
    `/src/test/visual/index.html?screen=${root}&scenario=responses-files&lang=es`,
  );
  const trigger = page
    .getByRole("button", { name: /^Ver entrega\.jpg(?: · .+)?$/ })
    .first();
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Fotos de la respuesta",
    exact: true,
  });
  await expect(
    dialog.getByRole("img", { name: "entrega.jpg", exact: true }),
  ).toBeVisible();
  await dialog.press("ArrowRight");
  await expect(
    dialog.getByRole("img", { name: "detalle.jpg", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/responses-gallery.png",
    fullPage: true,
  });
  await dialog.press("Escape");
  await expect(trigger).toBeFocused();
});

for (const language of ["es", "en"] as const)
  for (const width of [390, 320]) {
    test(`response loading, error recovery and type change ${language} ${width}`, async ({
      page,
    }) => {
      const en = language === "en";
      await page.setViewportSize({ width, height: 900 });
      const enter = (scenario: string) =>
        page.goto(
          `/src/test/visual/index.html?screen=${root}&scenario=${scenario}&lang=${language}`,
        );
      await enter("responses-loading");
      await expect(
        page
          .getByRole("main")
          .getByText(en ? "Loading…" : "Cargando…", { exact: true })
          .first(),
      ).toBeVisible();
      await page.screenshot({
        path: `test-results/responses-loading-${language}-${width}.png`,
        fullPage: true,
      });
      await enter("responses-error");
      await expect(
        page
          .getByRole("main")
          .getByText(
            en
              ? "We could not load the responses."
              : "No pudimos cargar las respuestas.",
            { exact: true },
          ),
      ).toBeVisible();
      await page
        .getByRole("main")
        .getByRole("button", {
          name: en ? "Retry" : "Reintentar",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("link", { name: "TEST-000002", exact: true }),
      ).toBeVisible();
      await enter("responses-type-change");
      await expect(
        page
          .getByRole("table")
          .getByText(en ? "Earlier text" : "Texto anterior", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: en ? "Columns" : "Columnas", exact: true })
        .click();
      const menu = page.getByRole("menu");
      await expect(
        menu.getByRole("menuitemcheckbox", {
          name: en ? "Amount (since v2)" : "Importe (desde v2)",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        menu.getByRole("menuitemcheckbox", {
          name: en ? "Amount" : "Importe",
          exact: true,
        }),
      ).toBeVisible();
      await menu.press("Escape");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: `test-results/responses-type-change-${language}-${width}.png`,
        fullPage: true,
      });
    });
  }
