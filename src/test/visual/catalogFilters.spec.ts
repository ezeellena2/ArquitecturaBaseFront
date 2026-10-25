import { expect, test } from "@playwright/test";
import seedOptions from "../fixtures/catalogs-http/filters/options.json" with { type: "json" };
import seedDetail from "../fixtures/catalogs-http/filters/detail.json" with { type: "json" };
import seedPreviewRequest from "../fixtures/catalogs-http/filters/preview-request.json" with { type: "json" };
import seedPreview from "../fixtures/catalogs-http/filters/preview.json" with { type: "json" };
import { visualCatalogId } from "./catalogFixtures";

// Production routes and UI with the existing simulated HTTP/persistence fixture.
// PostgreSQL/Redis and SQL filtering are qualified by backend tests separately.
// Independent journeys preserve every assertion and the default timeout; one test does not accumulate eight reloads.
for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test("Filters catalog " + language + " " + width, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 }); const english = language === "en";
    const label = (es: string, en: string) => english ? en : es;
    const enter = async (screen: string, scenario = "catalogs-filters") => {
      await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen, lang: language, scenario }));
      await page.getByRole("heading", { name: screen === "/catalogos" ? label("Catálogos", "Catalogs") : seedDetail.name[language], exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
    };
    const geometry = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const sample = async () => { await page.getByRole("combobox", { name: label("Como si lo recibiera", "As if received by"), exact: true }).click(); await page.getByRole("option", { name: seedOptions.sampleUsers.items.find(person => person.id === seedPreviewRequest.sampleUserId)!.name, exact: true }).click(); };
    await enter("/catalogos");
    await expect(page.getByRole("button", { name: label("Todos (1)", "All (1)"), exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: label("De la base (1)", "From the database (1)"), exact: true })).toBeVisible();
    await page.getByRole("button", { name: label("Nuevo catálogo", "New catalog"), exact: true }).click();
    await page.getByRole("radio", { name: label("Tomarlas de la base, con filtros", "Use database options with filters"), exact: true }).click();
    await page.getByRole("button", { name: label("Continuar", "Continue"), exact: true }).click();
    await page.getByRole("heading", { name: label("Nuevo catálogo", "New catalog"), exact: true }).waitFor();
    // No language selector: the catalog is written in the menu language, which is its original.
    await expect(page.getByRole("button", { name: /^(Español|Inglés|Spanish|English)\b/ })).toHaveCount(0);
    await page.getByRole("textbox", { name: label("Nombre", "Name"), exact: true }).fill(label("Responsables", "Assignees"));
    await page.getByRole("textbox", { name: label("Descripción", "Description"), exact: true }).fill(label("Personas disponibles", "Available people"));
    await sample(); await page.getByRole("button", { name: label("Guardar", "Save"), exact: true }).click();
    await page.getByRole("heading", { name: label("Responsables", "Assignees"), exact: true }).waitFor();
    await geometry(); await page.screenshot({ path: info.outputPath("filters-created.png"), fullPage: true });
    const creation = await page.evaluate(() => (globalThis as unknown as { catalogsFixture: { writes: { method: string; body: object }[] } }).catalogsFixture.writes);
    expect(creation).toHaveLength(1); expect(creation[0]!.method).toBe("POST"); expect(creation[0]!.body).not.toHaveProperty("sampleUserId"); expect(creation[0]!.body).not.toHaveProperty("items");
  });
  test("Filters catalog preview and editing " + language + " " + width, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 }); const english = language === "en";
    const label = (es: string, en: string) => english ? en : es;
    const enter = async (screen: string, scenario = "catalogs-filters") => {
      await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen, lang: language, scenario }));
      await page.getByRole("heading", { name: screen === "/catalogos" ? label("Catálogos", "Catalogs") : seedDetail.name[language], exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
    };
    const geometry = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const sample = async () => { await page.getByRole("combobox", { name: label("Como si lo recibiera", "As if received by"), exact: true }).click(); await page.getByRole("option", { name: seedOptions.sampleUsers.items.find(person => person.id === seedPreviewRequest.sampleUserId)!.name, exact: true }).click(); };
    await enter("/catalogos/" + visualCatalogId);
    await expect(page.getByRole("button", { name: label("Guardar", "Save"), exact: true })).toBeDisabled();
    await page.getByRole("button", { name: label("Página siguiente", "Next page"), exact: true }).click();
    await expect(page.getByText(label("Página 2 de 2", "Page 2 of 2"), { exact: true })).toBeVisible();
    await page.getByRole("button", { name: label("Página anterior", "Previous page"), exact: true }).click();
    const sampleInput = page.getByRole("combobox", { name: label("Como si lo recibiera", "As if received by"), exact: true });
    await sampleInput.fill("Persona de muestra 22"); await expect(page.getByRole("option", { name: "Persona de muestra 22", exact: true })).toBeVisible();
    await sampleInput.fill(""); await sample(); await page.getByRole("button", { name: label("Probar", "Test"), exact: true }).click();
    await expect(page.getByText(seedPreview.items[0]!.text, { exact: true })).toBeVisible();
    await geometry(); await page.screenshot({ path: info.outputPath("filters-preview.png"), fullPage: true });
    await page.getByRole("combobox", { name: label("Detalle", "Detail"), exact: true }).selectOption("active");
    await page.getByRole("button", { name: label("Probar", "Test"), exact: true }).click();
    const preview = page.getByRole("region", { name: label("Vista previa", "Preview"), exact: true });
    await expect(preview.getByText(label("Activo", "Active"), { exact: true })).toBeVisible();
    await expect(preview.getByText("true", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: label("Guardar", "Save"), exact: true }).click();
    await expect(page.getByText(label("Catálogo guardado.", "Catalog saved."), { exact: true })).toBeVisible();
    const updates = await page.evaluate(() => (globalThis as unknown as { catalogsFixture: { writes: { body: { expectedRevision?: number; filters: { conditions: object[] } } }[]; previews: object[] } }).catalogsFixture);
    expect(updates.writes).toHaveLength(1); expect(updates.writes[0]!.body.expectedRevision).toBe(1); expect(updates.previews).toHaveLength(3);
    for (const condition of updates.writes[0]!.body.filters.conditions) expect(condition).not.toHaveProperty("localId");
  });
  test("Filters catalog conflict and limits " + language + " " + width, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 }); const english = language === "en";
    const label = (es: string, en: string) => english ? en : es;
    const enter = async (screen: string, scenario = "catalogs-filters") => {
      await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen, lang: language, scenario }));
      await page.getByRole("heading", { name: screen === "/catalogos" ? label("Catálogos", "Catalogs") : seedDetail.name[language], exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
    };
    const geometry = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const sample = async () => { await page.getByRole("combobox", { name: label("Como si lo recibiera", "As if received by"), exact: true }).click(); await page.getByRole("option", { name: seedOptions.sampleUsers.items.find(person => person.id === seedPreviewRequest.sampleUserId)!.name, exact: true }).click(); };
    await enter("/catalogos/" + visualCatalogId, "catalogs-filters-conflict"); await sample();
    await page.getByRole("textbox", { name: label("Nombre", "Name"), exact: true }).fill("Mi borrador");
    await page.getByRole("button", { name: label("Guardar", "Save"), exact: true }).click();
    // Review goes in the band of the catalog review, beside its title.
    await page.getByRole("region", { name: label("Revisión del catálogo", "Catalog review"), exact: true }).getByRole("button", { name: label("Revisar", "Review"), exact: true }).click();
    await page.getByRole("button", { name: label("Releer", "Reread"), exact: true }).click();
    const dialog = page.getByRole("dialog", { name: label("Revisión del catálogo", "Catalog review"), exact: true });
    // The review shows each revision in the menu language.
    await expect(dialog.getByText("Mi borrador", { exact: true })).toBeVisible(); await expect(dialog.getByText(label("Personas actuales", "Current people"), { exact: true })).toBeVisible();
    await geometry(); await page.screenshot({ path: info.outputPath("filters-conflict.png"), fullPage: true });
    await dialog.getByRole("button", { name: label("Usar la revisión actual", "Use the current revision"), exact: true }).click();
    await expect(page.getByRole("textbox", { name: label("Nombre", "Name"), exact: true })).toHaveValue(label("Personas actuales", "Current people"));
    await enter("/catalogos/" + visualCatalogId, "catalogs-filters-limit");
    // Save does not wait for the sample person: trying it without one marks the person and sends nothing.
    await page.getByRole("textbox", { name: label("Nombre", "Name"), exact: true }).fill(label("Personas con límite", "People with a limit"));
    await page.getByRole("button", { name: label("Guardar", "Save"), exact: true }).click();
    const person = page.getByRole("combobox", { name: label("Como si lo recibiera", "As if received by"), exact: true });
    await expect(person).toBeFocused(); await expect(person).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText(label("Elegí una persona de ejemplo para guardar.", "Choose a sample person to save."), { exact: true })).toBeVisible();
    expect(await page.evaluate(() => (globalThis as unknown as { catalogsFixture: { previews: unknown[] } }).catalogsFixture.previews)).toHaveLength(0);
    await sample(); await page.getByRole("button", { name: label("Guardar", "Save"), exact: true }).click();
    await expect(page.getByText(label("Hay más de 200 opciones. Ajustá los filtros antes de guardar.", "There are more than 200 options. Adjust the filters before saving."), { exact: true })).toBeVisible();
    expect(await page.evaluate(() => (globalThis as unknown as { catalogsFixture: { writes: unknown[] } }).catalogsFixture.writes)).toHaveLength(0);
    await page.screenshot({ path: info.outputPath("filters-limit.png"), fullPage: true });
  });
  test("Filters catalog permissions and missing role " + language + " " + width, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 }); const english = language === "en";
    const label = (es: string, en: string) => english ? en : es;
    const enter = async (screen: string, scenario = "catalogs-filters") => {
      await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen, lang: language, scenario }));
      await page.getByRole("heading", { name: screen === "/catalogos" ? label("Catálogos", "Catalogs") : seedDetail.name[language], exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
    };
    const geometry = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const sample = async () => { await page.getByRole("combobox", { name: label("Como si lo recibiera", "As if received by"), exact: true }).click(); await page.getByRole("option", { name: seedOptions.sampleUsers.items.find(person => person.id === seedPreviewRequest.sampleUserId)!.name, exact: true }).click(); };
    await enter("/catalogos/" + visualCatalogId, "catalogs-filters-read");
    await expect(page.getByRole("combobox", { name: label("Texto de cada opción", "Option text"), exact: true })).toBeDisabled(); await expect(page.getByRole("button", { name: label("Guardar", "Save"), exact: true })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: label("Como si lo recibiera", "As if received by"), exact: true })).toHaveCount(0);
    await geometry(); await page.screenshot({ path: info.outputPath("filters-read.png"), fullPage: true });
    await enter("/catalogos/" + visualCatalogId, "catalogs-filters-missing-role");
    const savedRole = page.getByRole("combobox", { name: label("Valor de la condición 1", "Value for condition 1"), exact: true });
    await expect(savedRole).toHaveValue("01990000-0000-7000-8000-000000000699");
    await expect(savedRole.getByRole("option", { name: label("Valor no disponible", "Unavailable value"), exact: true })).toBeAttached();
    await expect(page.getByText("01990000-0000-7000-8000-000000000699", { exact: true })).toHaveCount(0);
    await sample(); await expect(page.getByRole("button", { name: label("Probar", "Test"), exact: true })).toBeEnabled();
    await savedRole.scrollIntoViewIfNeeded(); await geometry(); await page.screenshot({ path: info.outputPath("filters-missing-role.png"), fullPage: true });

  });
}

for (const language of ["es","en"] as const) for (const width of [1440,390,320]) {
  test(`Filters incompatible option stays complete ${language} ${width}`,async({page},info)=>{
    await page.setViewportSize({width,height:900});
    const es=language==="es";
    await page.goto("/src/test/visual/index.html?"+new URLSearchParams({screen:"/catalogos/"+visualCatalogId,lang:language,scenario:"catalogs-filters-long"}));
    await page.getByRole("combobox",{name:es?"Como si lo recibiera":"As if received by",exact:true}).click();
    await page.getByRole("option",{name:seedOptions.sampleUsers.items.find(person=>person.id===seedPreviewRequest.sampleUserId)!.name,exact:true}).click();
    await page.getByRole("button",{name:es?"Probar":"Test",exact:true}).click();
    await expect(page.getByText("Long display name that exceeds WhatsApp limits",{exact:true})).toBeVisible();
    const warning=page.getByText(es?"No entra en WhatsApp: máximo 30 caracteres de texto y 300 de detalle.":"Does not fit in WhatsApp: up to 30 characters of text and 300 of detail.",{exact:true});
    await expect(warning).toBeVisible();
    await warning.evaluate(element=>element.scrollIntoView({block:"center"}));
    await expect(warning).toBeInViewport({ratio:1});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({path:info.outputPath("filters-unrepresentable.png"),fullPage:true});
  });
}
