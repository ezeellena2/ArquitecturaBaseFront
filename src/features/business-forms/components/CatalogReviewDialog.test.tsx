import { act, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { CatalogFilterColumn, CatalogFiltersEditorValue } from "./CatalogFiltersEditor";
import { CatalogReviewDialog } from "./CatalogReviewDialog";

afterEach(async () => { cleanup(); await act(async () => { await i18n.changeLanguage("es"); }); });

const role = "01990000-0000-7000-8000-000000000601";
const columns: CatalogFilterColumn[] = [
  { key: "name", label: "Nombre", operators: [{ key: "contains", label: "Contiene" }, { key: "equals", label: "Es" }] },
  { key: "role", label: "Rol", operators: [{ key: "has", label: "Tiene el rol" }], choices: [{ key: role, label: "Operario" }] },
];
const draftFilters: CatalogFiltersEditorValue = { textColumn: "name", detailColumn: "role", conditions: [{ localId: "a", column: "role", operator: "has", value: role }, { localId: "b", column: "name", operator: "contains", value: "Ana" }], excludeRecipient: true, sortColumn: "name", sortDescending: false };
const currentFilters: CatalogFiltersEditorValue = { textColumn: "name", detailColumn: null, conditions: [], excludeRecipient: false, sortColumn: "name", sortDescending: true };
const mine = { name: { es: "Mi catálogo", en: "" }, description: { es: "Visitas", en: "" } };

function mount(props: Partial<Parameters<typeof CatalogReviewDialog>[0]> = {}) {
  const onOpenChange = vi.fn(), onReread = vi.fn(), onAdopt = vi.fn();
  renderWithProviders(<CatalogReviewDialog open culture="es" mine={mine} current={null} rereading={false} busy={false} onOpenChange={onOpenChange} onReread={onReread} onAdopt={onAdopt} {...props} />);
  return { dialog: screen.getByRole("dialog", { name: props.culture === "en" ? "Catalog review" : "Revisión del catálogo" }), onOpenChange, onReread, onAdopt };
}
// The row of a datum, whose name is its header: the two versions in their own cells.
const versions = (dialog: HTMLElement, datum: string) => within(within(dialog).getByRole("rowheader", { name: datum }).closest("tr")!).getAllByRole("cell");
// The filters of a version read as the data of a record: each part once, in grey, with its value.
const parts = (cell: HTMLElement) => Object.fromEntries(within(cell).getAllByRole("term").map(term => [term.textContent, term.nextElementSibling?.textContent]));

// LR2-A, as «Revisión del borrador» (2026-11-11): the datum once and both versions side by side, the saved one first, without
// a legend.
it("compares the current revision with the draft side by side, each datum once and without a legend", () => {
  const { dialog } = mount({ current: { name: { es: "Catálogo actual", en: null }, description: { es: null, en: null } } });
  expect(dialog).not.toHaveAccessibleDescription();
  expect(within(dialog).queryByText(/descarta los cambios sin guardar/)).not.toBeInTheDocument();
  expect(within(dialog).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Dato", "La revisión actual", "Tu borrador"]);
  expect(within(dialog).getAllByRole("rowheader").map(header => header.textContent)).toEqual(["Nombre", "Descripción"]);
  expect(versions(dialog, "Nombre").map(cell => cell.textContent)).toEqual(["Catálogo actual", "Mi catálogo"]);
  // What a version lacks says so in grey.
  expect(versions(dialog, "Descripción").map(cell => cell.textContent)).toEqual(["—", "Visitas"]);
  // Cancel goes next to the main action, which goes last.
  expect(within(dialog).getAllByRole("button").filter(button => button.closest("[data-slot='dialog-footer']")).map(button => button.textContent)).toEqual(["Releer", "Cerrar", "Usar la revisión actual"]);
});

it("reads the filters of each version in their row, with the labels of the editor", () => {
  const { dialog } = mount({ current: mine, filters: { mine: draftFilters, current: currentFilters, columns } });
  // The name and the description did not change: only the filters enter.
  expect(within(dialog).getAllByRole("rowheader").map(header => header.textContent)).toEqual(["Filtros"]);
  const [current, draft] = versions(dialog, "Filtros");
  expect(parts(draft!)).toEqual({ "Texto de cada opción": "Nombre", "Detalle": "Rol", "Qué filas entran": "Rol tiene el rol OperarioNombre contiene Ana", "Sin incluir a quien lo recibe": "Sí", "Orden": "Nombre, A → Z" });
  expect(within(draft!).getAllByRole("listitem").map(item => item.textContent)).toEqual(["Rol tiene el rol Operario", "Nombre contiene Ana"]);
  expect(parts(current!)).toEqual({ "Texto de cada opción": "Nombre", "Detalle": "Sin detalle", "Qué filas entran": "—", "Sin incluir a quien lo recibe": "No", "Orden": "Nombre, Z → A" });
});

it("says «—» in the current revision until it is read, and waits in its place while rereading", async () => {
  const { dialog, onReread, onAdopt } = mount({ filters: { mine: draftFilters, current: null, columns } });
  // Nothing to compare yet: every datum, with the current revision in grey.
  expect(within(dialog).getAllByRole("rowheader").map(header => header.textContent)).toEqual(["Nombre", "Descripción", "Filtros"]);
  expect(versions(dialog, "Nombre")[0]).toHaveTextContent(/^—$/);
  expect(versions(dialog, "Filtros")[0]).toHaveTextContent(/^—$/);
  expect(within(dialog).getByRole("button", { name: "Usar la revisión actual" })).toBeDisabled();
  await userEvent.click(within(dialog).getByRole("button", { name: "Releer" }));
  expect(onReread).toHaveBeenCalledOnce();
  expect(onAdopt).not.toHaveBeenCalled();
  cleanup();
  const rereading = mount({ rereading: true, busy: true }).dialog;
  expect(within(rereading).getByRole("button", { name: "Releyendo…" })).toHaveAttribute("aria-busy", "true");
  expect(within(rereading).getByRole("status")).toBeInTheDocument();
  expect(versions(rereading, "Nombre")[0]).not.toHaveTextContent("—");
  expect(within(rereading).getByRole("button", { name: "Usar la revisión actual" })).toBeDisabled();
});

it("uses the current revision and closes, or only closes", async () => {
  const { dialog, onOpenChange, onAdopt } = mount({ current: { name: { es: "Catálogo actual" }, description: { es: "Otra" } } });
  await userEvent.click(within(dialog).getByRole("button", { name: "Usar la revisión actual" }));
  expect(onAdopt).toHaveBeenCalledOnce();
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  onOpenChange.mockClear();
  // The footer's, not the × of the dialog, which is also named «Cerrar».
  await userEvent.click(within(dialog.querySelector<HTMLElement>("[data-slot='dialog-footer']")!).getByRole("button", { name: "Cerrar" }));
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  expect(onAdopt).toHaveBeenCalledOnce();
});

it("reads both versions in the menu language and, without a translation, in their original", async () => {
  await act(async () => { await i18n.changeLanguage("en"); });
  const { dialog } = mount({ culture: "en", current: { name: { es: "Catálogo actual", en: "Current catalog" }, description: { es: "Solo en español", en: null } } });
  expect(within(dialog).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Field", "The current revision", "Your draft"]);
  expect(versions(dialog, "Name").map(cell => cell.textContent)).toEqual(["Current catalog", "Mi catálogo"]);
  expect(versions(dialog, "Description").map(cell => cell.textContent)).toEqual(["Solo en español", "Visitas"]);
  expect(within(dialog).getByRole("button", { name: "Use the current revision" })).toBeEnabled();
});

it("shows only what differs once the current revision is read, and every datum when none of them changed", () => {
  const { dialog } = mount({ current: { name: mine.name, description: { es: "Otra descripción", en: "" } } });
  expect(within(dialog).getAllByRole("rowheader").map(header => header.textContent)).toEqual(["Descripción"]);
  expect(versions(dialog, "Descripción").map(cell => cell.textContent)).toEqual(["Otra descripción", "Visitas"]);
  cleanup();
  // The options may be what changed: the table keeps both data, equal on both sides, and is never empty.
  const same = mount({ current: mine }).dialog;
  expect(within(same).getAllByRole("rowheader").map(header => header.textContent)).toEqual(["Nombre", "Descripción"]);
});
