import { expect, test, type Page } from "@playwright/test";
import { formAmendmentFixtureIds as ids } from "./formAmendmentFixtures";

// Evidence of correcting and voiding (CW10-A and CW11-A), without goldens: each capture is compared with its board.
type Language = "es" | "en";
const text = (language: Language, es: string, en: string) => language === "es" ? es : en;
const sheet = "/formularios/" + ids.form + "/respuestas";
async function open(page: Page, language: Language, width: number, screen: string, scenario: string) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/src/test/visual/index.html?" + new URLSearchParams({ screen, scenario, lang: language }));
}
async function closeMenu(page: Page, language: Language, width: number) {
  if (width >= 768) return;
  const menu = page.getByRole("button", { name: text(language, "Menú de navegación", "Navigation menu"), exact: true });
  if (await menu.getAttribute("aria-expanded") === "true") await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
}
const noPageScroll = async (page: Page, width: number) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
const capture = (page: Page, name: string) => page.screenshot({ path: "test-results/" + name + ".png", fullPage: true });
// On the computer the response opens in D2, next to the sheet; on the phone, in the full view.
const response = (recordId: string, phone: boolean) => sheet + "/" + recordId + (phone ? "/completa" : "");

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  const phone = width < 640;
  const suffix = "-" + language + "-" + width;
  const correct = text(language, "Corregir", "Correct");

  test("CW10-A correcting a response " + language + " " + width, async ({ page }) => {
    await open(page, language, width, response(ids.pending, phone), "responses-full-amend");
    await expect(page.getByRole("heading", { name: "TEST-000002", exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await closeMenu(page, language, width);
    await page.getByRole("button", { name: correct, exact: true }).click();
    // Where D2 was on the computer; from the full view and on the phone, on its own page.
    const scope = phone ? page.locator("body")
      : page.getByRole("region", { name: text(language, "Corregir TEST-000002 de Informe de entregas", "Correct TEST-000002 of Delivery report"), exact: true });
    if (phone) await expect(page.getByRole("heading", { name: text(language, "Corregir TEST-000002", "Correct TEST-000002"), level: 1 })).toBeVisible();
    const amount = scope.getByLabel(new RegExp("^" + text(language, "Importe", "Amount")));
    await expect(amount).toHaveValue(text(language, "1250,5", "1250.5"));
    // The files stay unless they are removed.
    await expect(scope.getByText("entrega.jpg", { exact: true })).toBeVisible();
    await expect(scope.getByText(text(language, "Antes:", "Before:"), { exact: false })).toHaveCount(0);
    await amount.fill(text(language, "1350,5", "1350.5"));
    await expect(scope.getByText(text(language, "Antes: 1250,5", "Before: 1250.5"), { exact: true })).toBeVisible();
    // On the phone the page scrolls: first its top, with the title and what changed.
    if (phone) await expect(page.getByRole("navigation", { name: text(language, "Migas de pan", "Breadcrumb") })).toContainText(text(language, "Corregir TEST-000002", "Correct TEST-000002"));
    if (phone) await capture(page, "cw10-correction-top" + suffix);
    await scope.getByLabel(new RegExp("^" + text(language, "Motivo de la corrección", "Reason for the correction")))
      .fill(text(language, "El importe era 1350,5, no 1250,5.", "The amount was 1350.5, not 1250.5."));
    await expect(scope.getByRole("button", { name: text(language, "Guardar corrección", "Save correction"), exact: true })).toBeEnabled();
    await noPageScroll(page, width);
    await capture(page, "cw10-correction" + suffix);
  });

  test("CW10-A after correcting " + language + " " + width, async ({ page }) => {
    await open(page, language, width, response(ids.pendingCorrection, phone), "responses-full-amend-corrected");
    await expect(page.getByRole("heading", { name: "TEST-000002", exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await closeMenu(page, language, width);
    // «Corregida» in the row and in the detail; the story tells who, when and why.
    await expect(page.getByText(text(language, "Ana Pérez · «El importe era 1350,5, no 1250,5.»", "Ana Pérez · “The amount was 1350.5, not 1250.5.”"), { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: text(language, "Ver la versión anterior", "See the previous version"), exact: true })).toBeVisible();
    if (!phone) await expect(page.getByRole("row", { name: /TEST-000002/ }).getByText(text(language, "Corregida", "Corrected"), { exact: true })).toBeVisible();
    await noPageScroll(page, width);
    await capture(page, "cw10-corrected" + suffix);
    // If it was approved it goes back to be approved: the earlier decision keeps its PDF and the new one comes out on approval.
    if (phone) await open(page, language, width, response(ids.approvedCorrection, phone), "responses-full-amend-corrected");
    else await page.getByRole("link", { name: "TEST-000001", exact: true }).click();
    await expect(page.getByRole("heading", { name: "TEST-000001", exact: true })).toBeVisible();
    await expect(page.getByText(text(language, "Por aprobar otra vez", "To approve again"), { exact: true }).first()).toBeVisible();
    await expect(page.getByText(text(language, "el PDF nuevo sale al aprobarla", "the new PDF comes out when approved"), { exact: true })).toBeVisible();
    await expect(page.getByText(new RegExp("^Laura Ríos · " + text(language, "PDF del", "PDF of")))).toBeVisible();
    await noPageScroll(page, width);
    await capture(page, "cw10-corrected-approved" + suffix);
    // The previous version reads as it was, marked «Reemplazada», and leads to the current one.
    await page.getByRole("link", { name: text(language, "Ver la versión anterior y su PDF", "See the previous version and its PDF"), exact: true }).click();
    await expect(page.getByText(text(language, "Reemplazada", "Replaced"), { exact: true })).toBeVisible();
    await expect(page.getByText(new RegExp("^" + text(language, "Versión anterior de TEST-000001: la reemplazó la corrección del ", "Previous version of TEST-000001: the correction of ")))).toBeVisible();
    await expect(page.getByRole("link", { name: text(language, "Ver la actual", "See the current one"), exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: correct, exact: true })).toHaveCount(0);
    await noPageScroll(page, width);
    await capture(page, "cw10-previous" + suffix);
  });

  test("CW11-A voiding a response " + language + " " + width, async ({ page }) => {
    await open(page, language, width, response(ids.pending, phone), "responses-full-amend");
    await expect(page.getByRole("heading", { name: "TEST-000002", exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await closeMenu(page, language, width);
    // «Anular», at the end of «⋯», in red.
    await page.getByRole("button", { name: text(language, "Más acciones", "More actions"), exact: true }).click();
    const item = page.getByRole("menuitem", { name: text(language, "Anular", "Void"), exact: true });
    await expect(item).toBeVisible();
    await capture(page, "cw11-menu" + suffix);
    await item.click();
    const dialog = page.getByRole("dialog", { name: text(language, "¿Anular TEST-000002?", "Void TEST-000002?"), exact: true });
    await expect(dialog.getByText(text(language, "TEST-000002 queda en la planilla como anulada, con su número; deja de contar y no sale en el Excel.",
      "TEST-000002 stays in the sheet as voided, with its number; it no longer counts and is left out of the Excel."), { exact: true })).toBeVisible();
    // Without a reason it does not void and says why, also from the full view, where the texts of loading are not loaded yet.
    await dialog.getByRole("button", { name: text(language, "Anular respuesta", "Void response"), exact: true }).click();
    await expect(dialog.getByText(text(language, "Escribí el motivo.", "Write the reason."), { exact: true })).toBeVisible();
    await dialog.getByLabel(new RegExp("^" + text(language, "Motivo", "Reason"))).fill(text(language, "Cargada dos veces: es la misma que TEST-000001.", "Loaded twice: it is the same as TEST-000001."));
    await noPageScroll(page, width);
    await capture(page, "cw11-dialog" + suffix);
    await dialog.getByRole("button", { name: text(language, "Anular respuesta", "Void response"), exact: true }).click();
    // The row leaves the view; the notice confirms it.
    await expect(page.getByText(text(language, "Se anuló TEST-000002", "TEST-000002 was voided"), { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "TEST-000001", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "TEST-000002", exact: true })).toHaveCount(0);
    await noPageScroll(page, width);
    await capture(page, "cw11-after" + suffix);
    // The Excel leaves them out unless asked.
    await page.getByRole("button", { name: text(language, "Exportar a Excel", "Export to Excel"), exact: true }).click();
    const excel = page.getByRole("dialog", { name: text(language, "Exportar respuestas a Excel", "Export responses to Excel"), exact: true });
    await expect(excel.getByRole("checkbox", { name: text(language, "Incluir las anuladas", "Include voided responses"), exact: true })).not.toBeChecked();
    await noPageScroll(page, width);
    await capture(page, "cw11-excel" + suffix);
    await page.keyboard.press("Escape");
    await expect(excel).toHaveCount(0);
    // With «Estado: Anulada» it shows again, with who, when and why in its detail.
    await page.getByRole("combobox", { name: text(language, "Estado", "State"), exact: true }).selectOption({ label: text(language, "Anulada", "Voided") });
    await page.getByRole("link", { name: "TEST-000002", exact: true }).click();
    await expect(page.getByRole("heading", { name: "TEST-000002", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: text(language, "Anulada", "Voided"), level: 3 })).toBeVisible();
    await expect(page.getByText(text(language, "Ana Pérez · «Cargada dos veces: es la misma que TEST-000001.»", "Ana Pérez · “Loaded twice: it is the same as TEST-000001.”"), { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: correct, exact: true })).toHaveCount(0);
    await noPageScroll(page, width);
    await capture(page, "cw11-voided" + suffix);
  });

  test("CW10-A whoever loaded it corrects their own " + language + " " + width, async ({ page }) => {
    await open(page, language, width, response(ids.pending, phone), "responses-full-amend-own");
    await expect(page.getByRole("heading", { name: "TEST-000002", exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await closeMenu(page, language, width);
    await expect(page.getByRole("button", { name: correct, exact: true })).toBeVisible();
    await noPageScroll(page, width);
    await capture(page, "cw10-own" + suffix);
    // Once decided, it is no longer theirs to change.
    if (phone) await open(page, language, width, response(ids.approved, phone), "responses-full-amend-own");
    else await page.getByRole("link", { name: "TEST-000001", exact: true }).click();
    await expect(page.getByRole("heading", { name: "TEST-000001", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: correct, exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: text(language, "Más acciones", "More actions"), exact: true })).toHaveCount(0);
  });

  test("CW10-A and CW11-A the chat card says what happened later " + language + " " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/src/test/visual/index.html?screen=/form-replies&lang=" + language);
    await page.evaluate(() => document.fonts.ready);
    // What arrived stays as it was; the foot of the card says it was corrected or voided afterwards.
    const card = (number: string) => page.getByRole("group", { name: text(language, "Respuesta del formulario Registrar visita, guardada como ", "Form reply Register visit, saved as ") + number, exact: true });
    const corrected = card("VIS-000005"), voided = card("VIS-000006");
    await corrected.scrollIntoViewIfNeeded();
    await expect(corrected.getByText(text(language, "Después se corrigió: VIS-000005 quedó reemplazada por su corrección.", "VIS-000005 was corrected later: its correction replaced it."), { exact: true })).toBeVisible();
    await expect(voided.getByText(text(language, "Después se anuló VIS-000006.", "VIS-000006 was voided later."), { exact: true })).toBeVisible();
    await noPageScroll(page, width);
    await corrected.screenshot({ path: "test-results/cw10-chat-corrected" + suffix + ".png" });
    await voided.screenshot({ path: "test-results/cw11-chat-voided" + suffix + ".png" });
  });
}
