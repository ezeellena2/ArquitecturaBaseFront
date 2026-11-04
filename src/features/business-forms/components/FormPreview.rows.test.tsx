import userEvent from "@testing-library/user-event";
import { act, screen } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { FormPreview } from "./FormPreview";
import type { DraftEditorValue, DraftQuestion } from "../model";

// The preview of the block of rows (RG1-A, RG3-A, RG8-A): the WhatsApp screen of a row, and the question before the
// first row with a minimum of 0.
const question = (localId: string, label: string, repeated = false): DraftQuestion =>
  ({ localId, fieldId: null, replacesFieldId: null, type: "shortText", label: { es: label }, help: null, required: false, maxLength: 80, ...(repeated ? { repeated: true } : {}) } as DraftQuestion);
const form = (minRows: number): DraftEditorValue => ({ offerWhen: null, name: { es: "Recepción" }, prefix: "REC", draft: { format: 1, culture: "es", submitLabel: { es: "Enviar" }, fields: [
  question("supplier", "Proveedor"),
  { localId: "items", fieldId: null, replacesFieldId: null, type: "group", label: { es: "Artículos" }, help: null, required: minRows > 0, rows: { minRows, maxRows: 20 } },
  question("quantity", "Cantidad", true),
  question("remito", "Remito"),
] } });
beforeEach(async () => { await i18n.changeLanguage("es"); });

it("shows a row as WhatsApp does, with «¿Agregás otro renglón?», between what comes before and after the block", async () => {
  await act(async () => { renderWithProviders(<FormPreview value={form(1)} culture="es" />); });

  expect(screen.getByText("Vista previa · pantalla 1 de 3")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Proveedor" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

  expect(screen.getByText("Artículos · renglón 1")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Cantidad" })).toBeInTheDocument();
  expect(screen.getByRole("radiogroup", { name: "¿Agregás otro renglón?" })).toBeInTheDocument();
});
it("goes to the row when the block or one of its questions opens in the editor", async () => {
  let rerender: (ui: React.ReactElement) => void = () => {};
  await act(async () => { ({ rerender } = renderWithProviders(<FormPreview value={form(1)} culture="es" />)); });

  await act(async () => { rerender(<FormPreview value={form(1)} culture="es" openQuestion="quantity" />); });

  expect(screen.getByText("Artículos · renglón 1")).toBeInTheDocument();
});
it("asks «¿Agregás un renglón?» before the first row with a minimum of 0", async () => {
  await act(async () => { renderWithProviders(<FormPreview value={form(0)} culture="es" />); });

  expect(screen.getByText("Vista previa · pantalla 1 de 4")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

  expect(screen.getByRole("radiogroup", { name: "¿Agregás un renglón?" })).toBeInTheDocument();
  expect(screen.queryByRole("textbox", { name: "Cantidad" })).not.toBeInTheDocument();
});
