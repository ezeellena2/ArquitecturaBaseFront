import { MemoryRouter } from "react-router";
import { useState } from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { CatalogQuestionSettings } from "./CatalogQuestionSettings";
import type { DraftQuestionSource } from "../model";
const ids = vi.hoisted(() => ({ catalog: "01990000-0000-7000-8000-000000000001", field: "01990000-0000-7000-8000-000000000002", branch: "01990000-0000-7000-8000-000000000003", attribute: "01990000-0000-7000-8000-000000000004", south: "01990000-0000-7000-8000-000000000005" }));
const options = vi.hoisted(() => ({ page: [] as unknown[], presentation: { title: ["text"], description: ["detail"] } as { title: string[]; description: string[] } }));
const option = (id: string, text: string, position: number) => ({ id, code: "Z" + position, text: { es: text, en: null }, detail: {}, value: null, position, isActive: true, fields: {}, fieldTexts: {} });
vi.mock("./CatalogQuestionSelector", () => ({ CatalogQuestionSelector: () => <p>Catálogo Equipos</p> }));
vi.mock("../hooks/useCatalogQueries", () => ({ useCatalogDetail: () => ({ data: { id: ids.catalog, kind: "Manual", valueType: "Text", fields: [{ id: ids.field, key: "branch", name: { es: "Sucursal" }, type: "catalog", sourceCatalogId: ids.branch, required: true, unique: false, min: null, max: null, maxLength: null, role: "filter", position: 1, isActive: true, valuesCount: 1, usedBy: [] }, { id: "data-field", key: "price", name: { es: "Precio" }, type: "decimal", sourceCatalogId: null, required: false, unique: false, min: null, max: null, maxLength: null, role: "data", position: 2, isActive: true, valuesCount: 1, usedBy: [] }], presentation: options.presentation, presentationCheck: { cultures: [{ culture: "es", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }, { culture: "en", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }] }, revision: 1, isActive: true }, isError: false }), useCatalogItems: () => ({ data: { items: options.page, hasNext: options.page.length > 0 } }), useCatalogPresentationCheck: () => ({ data: undefined, isError: false }), useCatalogItemsById: (_scope: unknown, catalogId: string, itemIds: readonly string[]) => ({ data: catalogId === ids.branch && itemIds.includes(ids.south) ? { items: [{ id: ids.south, code: "S", text: { es: "Sur", en: "South" }, detail: {}, value: null, position: 37, isActive: true, fields: {}, fieldTexts: {} }] } : undefined }) }));
vi.mock("../hooks/usePersonData", () => ({ usePersonAttributes: () => ({ data: { items: [{ id: ids.attribute, name: { es: "Sucursal de la persona" }, type: "Catalog", sourceCatalogId: ids.branch, isActive: true }, { id: "wrong", name: { es: "Otra fuente" }, type: "Catalog", sourceCatalogId: "other", isActive: true }] }, isError: false }) }));
vi.mock("../hooks/useRecipientPreview", () => ({ useRecipientPreview: () => ({ person: null, result: null, error: null, busy: false, denied: false, complete: true, available: true, select: vi.fn() }), useRecipientSamples: () => ({ data: { items: [] }, isError: false }) }));
beforeEach(() => { options.page = []; options.presentation = { title: ["text"], description: ["detail"] }; });
function Harness({ changed, initial = { catalog: ids.catalog }, readOnly = false }: { changed: (source: DraftQuestionSource) => void; initial?: DraftQuestionSource; readOnly?: boolean }) { const [source, setSource] = useState<DraftQuestionSource>(initial); return <MemoryRouter><CatalogQuestionSettings scope={{ actorId: "author", culture: "es", permissions: ["formtemplates.read", "formtemplates.manage", "formcatalogs.read"] }} source={source} type="multiChoice" questionId="q" definitionId="form" readOnly={readOnly} onCatalogChange={vi.fn()} onSourceChange={value => { changed(value); setSource(value); }} /></MemoryRouter>; }
it("filters only eligible extra fields and matches person data from the same source", async () => { const changed = vi.fn(); renderWithProviders(<Harness changed={changed}/>); await userEvent.click(screen.getByRole("button", { name: "Agregar filtro según quien lo recibe" })); const row = screen.getByRole("group", { name: "Condición 1" }); expect(within(row).queryByRole("option", { name: "Precio" })).not.toBeInTheDocument(); expect(within(row).queryByRole("option", { name: "Otra fuente" })).not.toBeInTheDocument(); fireEvent.change(within(row).getByRole("combobox", { name: "Dato de la persona" }), { target: { value: ids.attribute } }); expect(changed).toHaveBeenLastCalledWith({ catalog: ids.catalog, match: [{ fieldId: ids.field, personAttributeId: ids.attribute }] }); });
it("keeps inherited presentation absent until the author explicitly chooses their own", async () => { const changed = vi.fn(); renderWithProviders(<Harness changed={changed}/>); expect(screen.getByRole("radio", { name: /Como en el catálogo/ })).toBeChecked(); expect(changed).not.toHaveBeenCalled(); await userEvent.click(screen.getByRole("radio", { name: /Propio de esta pregunta/ })); expect(changed).toHaveBeenLastCalledWith({ catalog: ids.catalog, presentation: { title: ["text"], description: ["detail"] } }); await userEvent.click(screen.getByRole("radio", { name: /Como en el catálogo/ })); expect(changed).toHaveBeenLastCalledWith({ catalog: ids.catalog }); });
it("names the catalog fields used by «Como en el catálogo»", () => {
  options.presentation = { title: ["text"], description: [ids.field, "data-field"] };
  renderWithProviders(<Harness changed={vi.fn()}/>);
  expect(screen.getByRole("radio", { name: /Como en el catálogo/ })).toHaveAccessibleDescription("Texto · Sucursal · Precio. Cambia si cambia el catálogo.");
});
it("shows a fixed catalog value outside the first twenty options, also read-only", () => {
  options.page = Array.from({ length: 20 }, (_, index) => option("01990000-0000-7000-8000-0000000001" + String(index).padStart(2, "0"), "Zona " + (index + 1), index + 1));
  const initial: DraftQuestionSource = { catalog: ids.catalog, match: [{ fieldId: ids.field, value: ids.south }] };
  const editable = renderWithProviders(<Harness changed={vi.fn()} initial={initial}/>);
  expect(screen.getByRole("combobox", { name: "Valor fijo" })).toHaveValue("Sur");
  editable.unmount();
  renderWithProviders(<Harness changed={vi.fn()} initial={initial} readOnly/>);
  expect(screen.getByRole("textbox", { name: "Valor fijo" })).toHaveValue("Sur");
  expect(document.body).not.toHaveTextContent(ids.south);
});
