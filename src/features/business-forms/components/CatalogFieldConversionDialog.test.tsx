import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { CatalogFieldConversionDialog } from "./CatalogFieldConversionDialog";

const rows = [
  { itemId: "01990000-0000-7000-8000-000000000037", code: "P-37", row: 37, value: "30 días", reason: "invalid" as const },
  { itemId: "01990000-0000-7000-8000-000000000052", code: "P-52", row: 52, value: null, reason: "required" as const },
];
const term = { type: "integer" as const, min: null, max: null, maxLength: null };

it("lists row, value and reason with the remaining count and offers to show those rows", async () => {
  const onClose = vi.fn(), onShowRows = vi.fn();
  await act(async () => { renderWithProviders(<CatalogFieldConversionDialog name="Plazo de pago (días)" from="text" field={term} culture="es" convertedCount={1188} invalidCount={12} rows={rows} onClose={onClose} onShowRows={onShowRows} />); });
  const dialog = screen.getByRole("dialog", { name: "Cambiar el tipo de «Plazo de pago (días)»" });
  expect(within(dialog).getByText("De texto a entero")).toBeInTheDocument();
  expect(within(dialog).getByText("Se revisan los 1.200 valores cargados: 1.188 se convierten y 12 no.")).toBeInTheDocument();
  expect(within(dialog).getAllByRole("columnheader").map(cell => cell.textContent)).toEqual(["Fila", "Qué pasa"]);
  const [first, second] = within(dialog).getAllByRole("row").slice(1).map(row => within(row).getAllByRole("cell").map(cell => cell.textContent));
  expect(first).toEqual(["37", "«30 días» no es un número entero."]);
  expect(second).toEqual(["52", "Falta: es obligatorio."]);
  expect(within(dialog).getByText("Y 10 más.")).toBeInTheDocument();
  expect(within(dialog).getByText("Corregilos en la tabla, o exportá, corregí el Excel e importalo. El tipo cambia al guardar, cuando todos entran.")).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "Ver los 2 en la tabla" }));
  expect(onShowRows).toHaveBeenCalledTimes(1);
  await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
  expect(onClose).toHaveBeenCalled();
});

it("shows at most five rows and leaves out the types when only the source changed", async () => {
  const many = Array.from({ length: 7 }, (_, index) => ({ itemId: `01990000-0000-7000-8000-00000000010${index}`, code: "Z" + index, row: index + 1, value: "Sur " + index, reason: "invalid" as const }));
  await act(async () => { renderWithProviders(<CatalogFieldConversionDialog name="Zona" from="catalog" field={{ type: "catalog", min: null, max: null, maxLength: null }} culture="es" convertedCount={0} invalidCount={7} rows={many} onClose={() => {}} onShowRows={() => {}} />); });
  const dialog = screen.getByRole("dialog", { name: "Cambiar el tipo de «Zona»" });
  expect(within(dialog).getAllByRole("row")).toHaveLength(6);
  expect(within(dialog).getByText("Y 2 más.")).toBeInTheDocument();
  expect(within(dialog).queryByText(/^De /)).not.toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Ver los 7 en la tabla" })).toBeInTheDocument();
});

it("speaks English with the same counts", async () => {
  await act(async () => { await i18n.changeLanguage("en"); });
  try {
    await act(async () => { renderWithProviders(<CatalogFieldConversionDialog name="Term" from="text" field={term} culture="es" convertedCount={0} invalidCount={1} rows={rows.slice(0, 1)} onClose={() => {}} onShowRows={() => {}} />); });
    const dialog = screen.getByRole("dialog", { name: "Change the type of “Term”" });
    expect(within(dialog).getByText("From text to whole number")).toBeInTheDocument();
    expect(within(dialog).getByText("1 loaded value is checked: 0 convert and 1 doesn't.")).toBeInTheDocument();
    expect(within(dialog).queryByText(/more\.$/)).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Show the row in the table" })).toBeInTheDocument();
  } finally { await act(async () => { await i18n.changeLanguage("es"); }); }
});

it("groups thousands in every count", async () => {
  await act(async () => { await i18n.changeLanguage("en"); });
  try {
    await act(async () => { renderWithProviders(<CatalogFieldConversionDialog name="Term" from="text" field={term} culture="es" convertedCount={1188} invalidCount={1200} rows={rows} onClose={() => {}} onShowRows={() => {}} />); });
    const dialog = screen.getByRole("dialog", { name: "Change the type of “Term”" });
    expect(within(dialog).getByText("All 2,388 loaded values are checked: 1,188 convert and 1,200 don't.")).toBeInTheDocument();
    expect(within(dialog).getByText("And 1,198 more.")).toBeInTheDocument();
  } finally { await act(async () => { await i18n.changeLanguage("es"); }); }
});
