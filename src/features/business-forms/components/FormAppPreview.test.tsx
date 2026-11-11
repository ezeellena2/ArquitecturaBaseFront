import type { ReactElement } from "react";
import userEvent from "@testing-library/user-event";
import { act, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { DraftEditorValue, DraftQuestion } from "../model";
import { FormAppPreview } from "./FormAppPreview";

const question = (localId: string, label: string, extra: Partial<DraftQuestion> = {}) =>
  ({ localId, fieldId: null, replacesFieldId: null, type: "shortText", label: { es: label }, help: null, required: false, maxLength: 80, ...extra }) as DraftQuestion;
const value = (fields: DraftQuestion[]): DraftEditorValue => ({ offerWhen: null, name: { es: "Remito de prueba" }, prefix: "REM",
  draft: { format: 1, culture: "es", submitLabel: { es: "Enviar remito" }, fields, appOnly: true } });

// SA2-A (2026-11-09): the app's «Nueva respuesta» instead of the phone, with a box per item of the block.
it("shows the draft as the app loads it, with a box per item and the final button off", async () => {
  await act(async () => { renderWithProviders(<FormAppPreview culture="es" value={value([question("client", "Cliente"),
    question("items", "Artículos", { type: "group", required: true, rows: { minRows: 1, maxRows: 5 } } as Partial<DraftQuestion>),
    question("article", "Artículo", { repeated: true } as Partial<DraftQuestion>)])} />); });
  const preview = screen.getByRole("region", { name: "Vista previa" });
  expect(within(preview).getByRole("textbox", { name: "Cliente" })).toBeEnabled();
  expect(within(preview).getByText("Ítem 1")).toBeInTheDocument();
  expect(within(preview).getByRole("button", { name: "Enviar remito" })).toBeDisabled();
  expect(within(preview).queryByText("Vista previa orientativa. La vista oficial de WhatsApp estará disponible al publicar.")).not.toBeInTheDocument();
  await userEvent.click(within(preview).getByRole("button", { name: "Más información sobre Vista previa" }));
  expect(await screen.findAllByText(/Vista previa orientativa de la carga en la app/)).not.toHaveLength(0);
});

it("leaves a catalog question waiting for its options, without asking the server for them", async () => {
  await act(async () => { renderWithProviders(<FormAppPreview culture="es" value={value([question("client", "Cliente", { type: "choice", source: { catalog: "01990000-0000-7000-8000-000000000001" } } as Partial<DraftQuestion>)])} />); });
  expect(screen.getByRole("combobox", { name: "Cliente" })).toBeDisabled();
});

// UB3-A (2026-11-11): as in the app, nothing is asked until «Usar mi ubicación» is pressed; the point stays in the preview, which
// sends nothing.
it("shows a location question as the app loads it, asking the browser nothing until its button is pressed", async () => {
  const getCurrentPosition = vi.fn((success: PositionCallback) =>
    success({ coords: { latitude: -34.6037224, longitude: -58.3815916, accuracy: 15 } } as GeolocationPosition));
  Object.defineProperty(globalThis.navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
  try {
    await act(async () => { renderWithProviders(<FormAppPreview culture="es" value={value([question("where", "Dónde estás", { type: "location" } as Partial<DraftQuestion>)])} />); });
    const preview = screen.getByRole("region", { name: "Vista previa" });
    expect(getCurrentPosition).not.toHaveBeenCalled();
    await userEvent.click(within(preview).getByRole("button", { name: "Usar mi ubicación" }));
    expect(await within(preview).findByText("-34.603722, -58.381592")).toBeVisible();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  } finally {
    delete (globalThis.navigator as { geolocation?: Geolocation }).geolocation;
  }
});

it("keeps what was typed while the draft changes", async () => {
  const fields = [question("client", "Cliente")];
  let rerender: (ui: ReactElement) => void = () => {};
  await act(async () => { ({ rerender } = renderWithProviders(<FormAppPreview culture="es" value={value(fields)} />)); });
  await userEvent.type(screen.getByRole("textbox", { name: "Cliente" }), "Ana Ruiz");
  await act(async () => { rerender(<FormAppPreview culture="es" value={value([...fields, question("notes", "Notas")])} />); });
  expect(screen.getByRole("textbox", { name: "Cliente" })).toHaveValue("Ana Ruiz");
  expect(screen.getByRole("textbox", { name: "Notas" })).toHaveValue("");
});
