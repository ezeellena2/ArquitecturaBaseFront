import { act, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { cellUnder } from "@/test/utils/tableCells";
import { CatalogListTable, type CatalogListRow } from "./CatalogListTable";

const rows: CatalogListRow[] = [
  { valueType: "Text" as const, id: "manual", name: "Clientes", description: "A quiénes se visita", origin: "Manual", optionsCount: 46, usageCount: 3, state: "Active", stateReason: null, canEdit: true },
  { valueType: "Text" as const, id: "filters", name: "Supervisores activos", description: null, origin: "Filters", optionsCount: 7, usageCount: 2, state: "Active", stateReason: null, canEdit: true },
  { valueType: "Text" as const, id: "invalid", name: "Responsables", description: null, origin: "Filters", optionsCount: null, usageCount: 1, state: "Unavailable", stateReason: "El catálogo tiene una configuración no válida.", canEdit: true },
];
const page = { items: rows, page: 2, pageSize: 3, totalCount: 7, totalPages: 3, hasPrevious: true, hasNext: true };
afterEach(async () => { cleanup(); await act(async () => { await i18n.changeLanguage("es"); }); });
async function mount(language: "es" | "en", canManage = true) {
  await i18n.changeLanguage(language);
  const onPageChange = vi.fn(); const onViewUsage = vi.fn(); const onEdit = vi.fn();
  const props = { page, canManage, onPageChange, onViewUsage, onEdit, hasFilters: false };
  let rendered: ReturnType<typeof renderWithProviders>;
  await act(async () => { rendered = renderWithProviders(<MemoryRouter><CatalogListTable {...props} /></MemoryRouter>); });
  return { ...rendered!, props, onPageChange, onViewUsage, onEdit, user: userEvent.setup() };
}
describe("Chosen catalog list board K1", () => {
  it("says where the options come from with one value, without a grey line under it (UD3)", async () => {
    await mount("es");
    const table = screen.getByRole("table");
    expect(cellUnder(table, screen.getByRole("row", { name: /Supervisores activos/ }), "De dónde salen")).toHaveTextContent(/^De la base$/);
    expect(cellUnder(table, screen.getByRole("row", { name: /Clientes/ }), "De dónde salen")).toHaveTextContent(/^Escritas a mano$/);
    expect(within(table).queryByText("Usuarios, con filtros")).not.toBeInTheDocument();
  });
  it("names a catalog a module keeps by where it comes from and opens it from its name, without the pencil (CA1)", async () => {
    await i18n.changeLanguage("es");
    const external: CatalogListRow = { valueType: "Integer", id: "external", name: "Condición frente al IVA", description: null, origin: "External", optionsCount: 9, usageCount: 0, state: "Active", stateReason: null, canEdit: true };
    await act(async () => { renderWithProviders(<MemoryRouter><CatalogListTable page={{ ...page, items: [external] }} canManage onPageChange={vi.fn()} onViewUsage={vi.fn()} onEdit={vi.fn()} hasFilters={false} /></MemoryRouter>); });
    const row = screen.getByRole("row", { name: /Condición frente al IVA/ });
    expect(cellUnder(screen.getByRole("table"), row, "De dónde salen")).toHaveTextContent(/^De otro sistema$/);
    expect(within(row).getByRole("link", { name: "Condición frente al IVA" })).toHaveAttribute("href", "/catalogos/external");
    expect(within(row).queryByRole("button", { name: "Editar Condición frente al IVA" })).not.toBeInTheDocument();
  });
  for (const language of ["es", "en"] as const) {
    it("uses supplied page and option counts without recounting the visible rows in " + language, async () => {
      const { user, onPageChange, onViewUsage, onEdit } = await mount(language);
      const row = screen.getByRole("row", { name: /Clientes/ });
      expect(within(row).getByRole("cell", { name: "46" })).toBeInTheDocument();
      expect(screen.getByText(language === "es" ? "4–6 de 7" : "4–6 of 7")).toBeInTheDocument();
      await user.click(within(row).getByRole("button", { name: language === "es" ? "Ver formularios que usan Clientes" : "View forms using Clientes" }));
      expect(onViewUsage).toHaveBeenCalledExactlyOnceWith("manual");
      await user.click(within(row).getByRole("button", { name: language === "es" ? "Editar Clientes" : "Edit Clientes" }));
      expect(onEdit).toHaveBeenCalledExactlyOnceWith("manual");
      await user.click(screen.getByRole("button", { name: language === "es" ? "Página siguiente" : "Next page" }));
      expect(onPageChange).toHaveBeenCalledExactlyOnceWith(3);
      expect(screen.getByText("El catálogo tiene una configuración no válida.")).toBeInTheDocument();
      expect(screen.getByRole("row", { name: /Responsables/ })).toHaveTextContent("—");
    });
  }
  it("preserves loaded rows and actions after a failed refresh", async () => {
    const { rerender, props } = await mount("es");
    rerender(<MemoryRouter><CatalogListTable {...props} loading error="No pudimos cargar los catálogos." /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Clientes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar Clientes" })).toBeInTheDocument();
    expect(screen.queryByText("Todavía no hay catálogos.")).not.toBeInTheDocument();
  });
  it("does not show edit actions without Manage while retaining readable detail links", async () => {
    await mount("es", false);
    expect(screen.getByRole("link", { name: "Clientes" })).toHaveAttribute("href", "/catalogos/manual");
    expect(screen.queryByRole("button", { name: "Editar Clientes" })).not.toBeInTheDocument();
  });
  it("aligns the number of options to the right, as every column of numbers", async () => {
    await mount("es");
    expect(screen.getByRole("columnheader", { name: "Opciones" })).toHaveClass("text-right");
    expect(screen.getByRole("cell", { name: "46" })).toHaveClass("text-right");
    expect(screen.getByRole("columnheader", { name: "De dónde salen" })).not.toHaveClass("text-right");
  });
});
