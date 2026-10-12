import { act, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { FormPreview } from "./FormPreview";
import type { DraftEditorValue } from "../model";

it("shows a catalog question without resolving or offering options", async () => {
  const value: DraftEditorValue = { name: { es: "Visita" }, prefix: "VIS", draft: { format: 1, culture: "es", submitLabel: { es: "Enviar" }, fields: [{ localId: "catalog", fieldId: null, replacesFieldId: null, type: "choice", source: { catalog: "01990000-0000-7000-8000-000000000091" }, label: { es: "Cliente" }, help: null, required: true }] } };
  await act(async () => { renderWithProviders(<FormPreview value={value} culture="es" />); });
  const question = screen.getByRole("combobox", { name: "Cliente" });
  expect(question).toBeDisabled(); expect(within(question).getAllByRole("option")).toHaveLength(1);
  expect(screen.getByText("Las opciones se preparan al mandar el formulario, para cada persona.")).toBeInTheDocument();
});
