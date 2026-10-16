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
      const table = page.getByRole("table");
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
      await page
        .getByRole("link", { name: "TEST-000002", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "TEST-000002", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("comprobante.pdf", { exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `test-results/responses-t3-${language}-${width}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await page
        .getByRole("button", { name: en ? "Next" : "Siguiente", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "TEST-000001", exact: true }),
      ).toBeVisible();
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
    if (scenario === "responses-limit")
      await page
        .getByRole("button", { name: "Exportar a Excel", exact: true })
        .click();
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
test("all response forms are paged from the backend", async ({ page }) => {
  await page.goto(
    "/src/test/visual/index.html?screen=/formularios/respuestas&scenario=responses-many&lang=en",
  );
  await expect(
    page.getByRole("link", { name: "Delivery report", exact: true }).last(),
  ).toBeVisible();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(21);
});

test("sheet photo opens the shared viewer with every photo and restores focus", async ({
  page,
}) => {
  await page.goto(
    `/src/test/visual/index.html?screen=${root}&scenario=responses-files&lang=es`,
  );
  const trigger = page
    .getByRole("button", { name: "Ver entrega.jpg", exact: true })
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
