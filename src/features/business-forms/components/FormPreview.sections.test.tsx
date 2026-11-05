import userEvent from "@testing-library/user-event";
import { act, screen } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { FormPreview } from "./FormPreview";
import type { DraftEditorValue, DraftQuestion } from "../model";

// CW15-B in the preview: each section title is a subtitle right before its first question, on that question's screen, as in WhatsApp.
const question = (localId: string, label: string): DraftQuestion =>
  ({ localId, fieldId: null, replacesFieldId: null, type: "shortText", label: { es: label }, help: null, required: false, maxLength: 80 });
const photo: DraftQuestion = { localId: "photo", fieldId: null, replacesFieldId: null, type: "photo", label: { es: "Fotos del lote" }, help: null, required: false,
  files: { minFiles: 0, maxFiles: 3, photoSource: "cameraOrGallery" } };
const form: DraftEditorValue = { offerWhen: null, name: { es: "Aplicación" }, prefix: "APL", draft: { format: 1, culture: "es", submitLabel: { es: "Enviar" },
  fields: [question("lot", "Lote"), question("product", "Producto 1"), photo],
  sections: [{ localId: "s1", start: 0, title: { es: "Lote" } }, { localId: "s2", start: 1, title: { es: "Productos" } }, { localId: "s3", start: 2, title: { es: "Fotos" } }] } };
beforeEach(async () => { await i18n.changeLanguage("es"); });

it("shows each title as a subtitle before the first question of its section, on its screen", async () => {
  await act(async () => { renderWithProviders(<FormPreview value={form} culture="es" />); });

  expect(screen.getAllByRole("heading", { level: 3 }).map(heading => heading.textContent)).toEqual(["Lote", "Productos"]);
  const products = screen.getByRole("heading", { level: 3, name: "Productos" });
  expect(products.compareDocumentPosition(screen.getByRole("textbox", { name: "Lote" })) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  expect(products.compareDocumentPosition(screen.getByRole("textbox", { name: "Producto 1" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

  expect(screen.getAllByRole("heading", { level: 3 }).map(heading => heading.textContent)).toEqual(["Fotos"]);
});
