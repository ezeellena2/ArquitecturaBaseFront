import { expect, test } from "@playwright/test";
import { responseFormId, responseRecordId } from "../responseFixtures";
import { expectNoSideScroll } from "./chartGeometry";

// W3 (UC2, UC3 and UC6): the activity of a response that went by WhatsApp says, in grey under «Llegó la ubicación» and «Llegó el
// contacto», which questions the shared place and contact completed, and each «Se volvió a mandar el formulario» goes without repeating
// who sent it; nothing around those rows scrolls sideways (every box that scrolls or cuts, up to the document). The quick view (D2) at
// 1440 and the full page (DC1) in the celular. Evidence es/en at 1440, 390 and 320 px without golden, like the other scenes of the
// activity (`formWorkflow`), in `test-results/shared-content`.
for (const language of ["es", "en"] as const)
  for (const width of [1440, 390, 320]) {
    test(`shared location and contact in the activity ${language} ${width}`, async ({ page }) => {
      const en = language === "en";
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/src/test/visual/index.html?screen=/formularios/${responseFormId}/respuestas/${responseRecordId}&scenario=responses-shared-content&lang=${language}`);
      await expect(page.getByRole("heading", { name: "TEST-000002", exact: true })).toBeVisible();
      const panel = width < 640 ? page.getByRole("main") : page.getByRole("region", { name: en ? "Response details" : "Detalle de la respuesta", exact: true });
      if (width < 640) await panel.getByRole("button", { name: en ? "Expand activity" : "Expandir actividad", exact: true }).click();
      else await panel.getByRole("tab", { name: en ? "Activity" : "Actividad", exact: true }).click();
      const history = width < 640 ? panel.getByRole("region", { name: en ? "Activity" : "Actividad", exact: true }) : panel.getByRole("tabpanel", { name: en ? "Activity" : "Actividad", exact: true });
      const received = history.getByRole("listitem", { name: en ? "On receipt" : "Al recibirla", exact: true });
      const location = received.getByText(en ? "Filled in “Delivery address”" : "Completó «Dirección de entrega»", { exact: true });
      const contact = received.getByText(en ? "Filled in “Received by” and “Recipient's phone”" : "Completó «Recibió» y «Teléfono de quien recibe»", { exact: true });
      await expect(location).toBeVisible();
      await expect(contact).toBeVisible();
      await expect(received.getByText(en ? "Form sent again" : "Se volvió a mandar el formulario", { exact: true })).toHaveCount(2);
      // Who sent the form goes once, under «Se mandó el formulario».
      await expect(received.getByText("Ana", { exact: true })).toHaveCount(1);
      await page.evaluate(() => document.fonts.ready);
      for (const row of [location, contact]) await expectNoSideScroll(row);
      await history.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/shared-content/activity-${language}-${width}.png`, fullPage: true });
    });
  }
