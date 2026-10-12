import { act, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import listEs from "@/test/fixtures/catalogs-http/manual-current/list-es.json";
import listEn from "@/test/fixtures/catalogs-http/manual-current/list-en.json";
import { readCatalogPage } from "../api/catalogResponse";
import { CatalogListTable, type CatalogListRow } from "./CatalogListTable";

const rows: CatalogListRow[] = [
  { id: "manual", name: "Clientes", description: "A quiénes se visita", origin: "Manual", optionsCount: 46, usageCount: 3, state: "Active", stateReason: null, canEdit: true },
  { id: "filters", name: "Supervisores activos", description: null, origin: "Filters", optionsCount: 7, usageCount: 2, state: "Active", stateReason: null, canEdit: true },
  { id: "invalid", name: "Responsables", description: null, origin: "Filters", optionsCount: null, usageCount: 1, state: "Unavailable", stateReason: "La vista Usuarios cambió", canEdit: true },
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
      expect(screen.getByText("La vista Usuarios cambió")).toBeInTheDocument();
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
  for (const [language, raw] of [["es", listEs], ["en", listEn]] as const) it("renders the real localized page without exposing hidden usage or unauthorized edits in " + language, async () => {
    await i18n.changeLanguage(language); const actualPage = readCatalogPage(raw); const onPageChange = vi.fn();
    await act(async () => { renderWithProviders(<MemoryRouter><CatalogListTable page={actualPage} canManage hasFilters={false} onPageChange={onPageChange} onViewUsage={() => {}} onEdit={() => {}} /></MemoryRouter>); });
    const row = screen.getByRole("row", { name: new RegExp(actualPage.items[0]!.name) });
    expect(within(row).getAllByRole("cell")[3]).toHaveTextContent("—");
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(language === "es" ? "2–2 de 3" : "2–2 of 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: language === "es" ? "Página siguiente" : "Next page" }));
    expect(onPageChange).toHaveBeenCalledExactlyOnceWith(3);
    expect(screen.getByRole("link", { name: actualPage.items[0]!.name })).toHaveAttribute("href", "/catalogos/" + actualPage.items[0]!.id);
  });
});
