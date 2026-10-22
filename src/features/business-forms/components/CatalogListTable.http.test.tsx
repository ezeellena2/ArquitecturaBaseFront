import { act, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import listEs from "@/test/fixtures/catalogs-http/manual-current/list-es.json";
import listEn from "@/test/fixtures/catalogs-http/manual-current/list-en.json";
import { readCatalogPage } from "../api/catalogResponse";
import { CatalogListTable } from "./CatalogListTable";

afterEach(async () => { cleanup(); await act(async () => { await i18n.changeLanguage("es"); }); });
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
