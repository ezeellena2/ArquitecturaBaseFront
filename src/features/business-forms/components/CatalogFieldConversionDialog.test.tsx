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
// The type and the counts read as the data of a record (lista de chequeo, 2026-11-11): each datum once, with its value.
const data = (dialog: HTMLElement) => within(dialog).getAllByRole("term").map(term => [term.textContent, term.nextElementSibling?.textContent]);

it("lists row, value and reason with the remaining count and offers to show those rows", async () => {
  const onClose = vi.fn(), onShowRows = vi.fn();
  await act(async () => { renderWithProviders(<CatalogFieldConversionDialog name="Plazo de pago (días)" from="text" field={term} culture="es" convertedCount={1188} invalidCount={12} rows={rows} onClose={onClose} onShowRows={onShowRows} />); });
  const dialog = screen.getByRole("dialog", { name: "Cambiar el tipo de «Plazo de pago (días)»" });
  expect(data(dialog)).toEqual([["Tipo guardado", "Texto"], ["Tipo nuevo", "Entero"], ["Valores cargados", "1.200"], ["Se convierten", "1.188"], ["No se convierten", "12"]]);
  expect(dialog).not.toHaveAccessibleDescription();
  expect(within(dialog).queryByText(/^De texto a entero$|Se revisan/)).not.toBeInTheDocument();
  expect(within(dialog).getAllByRole("columnheader").map(cell => cell.textContent)).toEqual(["Fila", "Qué pasa"]);
  const [first, second] = within(dialog).getAllByRole("row").slice(1).map(row => within(row).getAllByRole("cell").map(cell => cell.textContent));
  expect(first).toEqual(["37", "«30 días» no es un número entero."]);
  expect(second).toEqual(["52", "Falta: es obligatorio."]);
  expect(within(dialog).getByText("Y 10 más.")).toBeInTheDocument();
  // «Ver los N en la tabla» is the way: no banner explains how to fix them (2026-10-31).
  expect(within(dialog).queryByText(/Corregilos en la tabla/)).not.toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "Ver los 2 en la tabla" }));
  expect(onShowRows).toHaveBeenCalledTimes(1);
  await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
  expect(onClose).toHaveBeenCalled();
});

it("aligns the row number to the right, as every column of numbers", async () => {
  await act(async () => { renderWithProviders(<CatalogFieldConversionDialog name="Plazo de pago (días)" from="text" field={term} culture="es" convertedCount={1188} invalidCount={12} rows={rows} onClose={vi.fn()} onShowRows={vi.fn()} />); });
  const dialog = screen.getByRole("dialog", { name: "Cambiar el tipo de «Plazo de pago (días)»" });
  expect(within(dialog).getByRole("columnheader", { name: "Fila" })).toHaveClass("text-right");
  expect(within(dialog).getByRole("cell", { name: "37" })).toHaveClass("text-right");
  expect(within(dialog).getByRole("columnheader", { name: "Qué pasa" })).not.toHaveClass("text-right");
});

it("quotes each saved value as its cell showed it, in the previous type", async () => {
  await act(async () => { renderWithProviders(<CatalogFieldConversionDialog name="Importe" from="decimal" field={term} culture="es" convertedCount={0} invalidCount={1} rows={[{ ...rows[0]!, value: "1500.5" }]} onClose={() => {}} onShowRows={() => {}} />); });
  expect(within(screen.getByRole("dialog")).getByRole("cell", { name: "«1.500,5» no es un número entero." })).toBeInTheDocument();
});
it("quotes a saved yes/no as Sí or No", async () => {
  await act(async () => { renderWithProviders(<CatalogFieldConversionDialog name="Con GPS" from="boolean" field={term} culture="es" convertedCount={0} invalidCount={1} rows={[{ ...rows[0]!, value: "true" }]} onClose={() => {}} onShowRows={() => {}} />); });
  expect(within(screen.getByRole("dialog")).getByRole("cell", { name: "«Sí» no es un número entero." })).toBeInTheDocument();
});

it("shows at most five rows and leaves out the types when only the source changed", async () => {
  const many = Array.from({ length: 7 }, (_, index) => ({ itemId: `01990000-0000-7000-8000-00000000010${index}`, code: "Z" + index, row: index + 1, value: "Sur " + index, reason: "invalid" as const }));
  await act(async () => { renderWithProviders(<CatalogFieldConversionDialog name="Zona" from="catalog" field={{ type: "catalog", min: null, max: null, maxLength: null }} culture="es" convertedCount={0} invalidCount={7} rows={many} onClose={() => {}} onShowRows={() => {}} />); });
  const dialog = screen.getByRole("dialog", { name: "Cambiar el tipo de «Zona»" });
  expect(within(dialog).getAllByRole("row")).toHaveLength(6);
  expect(within(dialog).getByText("Y 2 más.")).toBeInTheDocument();
  expect(data(dialog).map(([label]) => label)).toEqual(["Valores cargados", "Se convierten", "No se convierten"]);
  expect(within(dialog).getByRole("button", { name: "Ver los 7 en la tabla" })).toBeInTheDocument();
});

it("speaks English with the same counts", async () => {
  await act(async () => { await i18n.changeLanguage("en"); });
  try {
    await act(async () => { renderWithProviders(<CatalogFieldConversionDialog name="Term" from="text" field={term} culture="es" convertedCount={0} invalidCount={1} rows={rows.slice(0, 1)} onClose={() => {}} onShowRows={() => {}} />); });
    const dialog = screen.getByRole("dialog", { name: "Change the type of “Term”" });
    expect(data(dialog)).toEqual([["Saved type", "Text"], ["New type", "Whole number"], ["Loaded values", "1"], ["Convert", "0"], ["Don't convert", "1"]]);
    expect(within(dialog).queryByText(/more\.$/)).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Show the row in the table" })).toBeInTheDocument();
  } finally { await act(async () => { await i18n.changeLanguage("es"); }); }
});

it("groups thousands in every count", async () => {
  await act(async () => { await i18n.changeLanguage("en"); });
  try {
    await act(async () => { renderWithProviders(<CatalogFieldConversionDialog name="Term" from="text" field={term} culture="es" convertedCount={1188} invalidCount={1200} rows={rows} onClose={() => {}} onShowRows={() => {}} />); });
    const dialog = screen.getByRole("dialog", { name: "Change the type of “Term”" });
    expect(data(dialog).slice(2)).toEqual([["Loaded values", "2,388"], ["Convert", "1,188"], ["Don't convert", "1,200"]]);
    expect(within(dialog).getByText("And 1,198 more.")).toBeInTheDocument();
  } finally { await act(async () => { await i18n.changeLanguage("es"); }); }
});
