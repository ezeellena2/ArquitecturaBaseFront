import { act, cleanup, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { cellUnder } from "@/test/utils/tableCells";
import type { CatalogManualItemValue } from "../catalogItemEdits";
import { CatalogItemsTable } from "./CatalogItemsTable";

const urea: CatalogManualItemValue = { localId: "urea", itemId: "0199a0c0-0000-7000-8000-000000000301", label: { es: "Urea granulada" },
  detail: { es: "Bolsa de 50 kg" }, code: "URE-46", value: null, isActive: true, position: 1 };
function mount(props: Partial<Parameters<typeof CatalogItemsTable>[0]> = {}) {
  return renderWithProviders(<CatalogItemsTable items={[urea]} culture="es" original="es" valueType="Text" canManage={false} busy={false}
    hasPendingMoves={false} inline={false} selected={[]} onSelect={vi.fn()} onSelectAll={vi.fn()} onEdit={vi.fn()} onChange={vi.fn()} {...props} />);
}
afterEach(async () => { cleanup(); await act(async () => { await i18n.changeLanguage("es"); }); });

describe("The options of a catalog, one piece of data per column (UD3)", () => {
  it("shows the text and the code in two columns also without permission to edit", () => {
    mount();
    const table = screen.getByRole("table");
    expect(within(table).queryByRole("columnheader", { name: "Texto y código" })).not.toBeInTheDocument();
    const row = within(table).getAllByRole("row")[1];
    expect(cellUnder(table, row, "Texto")).toHaveTextContent(/^Urea granulada$/);
    expect(cellUnder(table, row, "Código")).toHaveTextContent(/^URE-46$/);
  });

  it("says an option deleted on Save in its state and leaves only Restore among the actions", () => {
    mount({ canManage: true, inline: true, deletedItemIds: [urea.itemId!], onRestore: vi.fn(), onDelete: vi.fn() });
    const table = screen.getByRole("table");
    const row = within(table).getAllByRole("row")[1];
    expect(cellUnder(table, row, "Estado")).toHaveTextContent(/^Se elimina al guardar$/);
    const actions = cellUnder(table, row, "Acciones");
    expect(within(actions).getByRole("button", { name: "Restaurar Urea granulada" })).toBeVisible();
    // A table row carries no text buttons: restoring is an icon with its name in the tooltip.
    expect(actions).toHaveTextContent(/^$/);
  });

  it("reactivates an inactive option from an icon of its row", () => {
    const onChange = vi.fn();
    mount({ canManage: true, items: [{ ...urea, isActive: false }], onChange });
    const table = screen.getByRole("table");
    const actions = cellUnder(table, within(table).getAllByRole("row")[1], "Acciones");
    expect(actions).toHaveTextContent(/^$/);
    within(actions).getByRole("button", { name: "Reactivar Urea granulada" }).click();
    expect(onChange).toHaveBeenCalledWith({ ...urea, isActive: true });
  });
});
