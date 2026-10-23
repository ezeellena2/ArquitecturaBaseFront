import { MemoryRouter } from "react-router";
import { act, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { CatalogQuestionSettings } from "./CatalogQuestionSettings";

it("keeps a catalog reference readonly without reading catalogs when the author lacks permission", async () => {
  const onCatalogChange = vi.fn();
  await act(async () => { renderWithProviders(<MemoryRouter><CatalogQuestionSettings scope={{ actorId: "author", culture: "es", permissions: ["formtemplates.manage"] }} source={{ catalog: "01990000-0000-7000-8000-000000000091" }} readOnly={false} error="Revisá el catálogo." onCatalogChange={onCatalogChange} /></MemoryRouter>); });
  expect(screen.getByRole("combobox", { name: "Catálogo" })).toBeDisabled();
  expect(screen.getByText("Revisá el catálogo.")).toBeInTheDocument();
  expect(onCatalogChange).not.toHaveBeenCalled();
});
