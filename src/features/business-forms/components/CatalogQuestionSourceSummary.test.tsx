import { act, cleanup, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { CatalogQuestionSourceSummary } from "./CatalogQuestionSourceSummary";
const field = vi.hoisted(() => ({ id: "field", name: { es: "Sucursal" } as Readonly<Record<string, string>>, type: "catalog", sourceCatalogId: "branches", isActive: true }));
const south = vi.hoisted(() => ({ id: "01990000-0000-7000-8000-000000000077", code: "S", text: { es: "Sur", en: "South" } as Readonly<Record<string, string>>, detail: {}, value: null, position: 37, isActive: false, fields: {}, fieldTexts: {} }));
const typedFields = vi.hoisted(() => [{ id: "amount", name: { es: "Importe" }, type: "decimal", sourceCatalogId: null, isActive: true }, { id: "units", name: { es: "Unidades" }, type: "integer", sourceCatalogId: null, isActive: true }]);
const byId = vi.hoisted(() => ({ read: "done" as "done" | "loading" | "failed" }));
vi.mock("../hooks/useCatalogQueries", () => ({ useCatalogDetail: () => ({ data: { fields: [field, ...typedFields] } }), useCatalogItemsById: (_scope: unknown, catalogId: string, itemIds: readonly string[]) =>
  byId.read === "loading" ? { data: undefined, isLoading: true, isError: false } : byId.read === "failed" ? { data: undefined, isLoading: false, isError: true }
  : { data: catalogId === "branches" ? { items: itemIds.includes(south.id) ? [south] : [] } : undefined, isLoading: false, isError: false } }));
const attributes = vi.hoisted(() => ({ items: [] as unknown[] }));
vi.mock("../hooks/usePersonData", () => ({ usePersonAttributes: () => ({ data: attributes }) }));
beforeEach(() => { field.type = "catalog"; field.name = { es: "Sucursal" }; south.text = { es: "Sur", en: "South" }; attributes.items = []; byId.read = "done"; });
it("explains changed catalog values and selected presentation without exposing option identities", async () => {
  const id = south.id;
  await act(async () => { renderWithProviders(<CatalogQuestionSourceSummary scope={{ actorId: "actor", culture: "es", permissions: ["formcatalogs.read"] }} source={{ catalog: "catalog", match: [{ fieldId: "field", value: id }], presentation: { title: ["text"], description: ["field"] } }} compared={{ catalog: "catalog", match: [{ fieldId: "field", value: "other" }] }}/>); });
  expect(screen.getByText(/Sucursal: Sur/)).toBeInTheDocument();
  expect(screen.getByText(/Cambió el valor elegido/)).toBeInTheDocument();
  expect(screen.getByText(/Propio de esta pregunta/)).toBeInTheDocument();
  expect(screen.getByText(/Descripción.*Sucursal/)).toBeInTheDocument();
  expect(document.body).not.toHaveTextContent(id);
});

it("does not call an incomplete boolean filter No", async () => { field.type = "boolean"; await act(async () => { renderWithProviders(<CatalogQuestionSourceSummary scope={{ actorId: "actor", culture: "es", permissions: ["formcatalogs.read"] }} source={{ catalog: "catalog", match: [{ fieldId: "field", value: null }] }}/>); }); expect(document.body).not.toHaveTextContent("Sucursal: No"); });

it("shows fixed typed filter values with the shared format", async () => {
  await act(async () => { renderWithProviders(<CatalogQuestionSourceSummary scope={{ actorId: "actor", culture: "es", permissions: ["formcatalogs.read"] }} source={{ catalog: "catalog", match: [{ fieldId: "amount", value: "1500.5" }, { fieldId: "units", value: "15000" }] }}/>); });
  expect(screen.getByText("Importe: 1.500,5")).toBeInTheDocument();
  expect(screen.getByText("Unidades: 15.000")).toBeInTheDocument();
});

it("names a field, its fixed option and the person data written only in the other language", async () => {
  field.name = { en: "Branch" }; south.text = { en: "South" }; attributes.items = [{ id: "zone", name: { en: "Customer branch" } }];
  const scope = { actorId: "actor", culture: "es" as const, permissions: ["formcatalogs.read"] };
  await act(async () => { renderWithProviders(<CatalogQuestionSourceSummary scope={scope} source={{ catalog: "catalog", match: [{ fieldId: "field", value: south.id }] }} compared={{ catalog: "catalog", match: [{ fieldId: "field", value: south.id }] }}/>); });
  expect(screen.getByText("Branch: South")).toBeInTheDocument();
  cleanup();
  await act(async () => { renderWithProviders(<CatalogQuestionSourceSummary scope={scope} source={{ catalog: "catalog", match: [{ fieldId: "field", personAttributeId: "zone" }] }}/>); });
  expect(screen.getByText("Branch: Customer branch")).toBeInTheDocument();
});

// A fixed option that is still loading, cannot be read or is not an option of the source never leaves «Sucursal:» empty,
// which would read as no value chosen.
it.each([
  ["loading", "loading", "Sucursal: …"],
  ["failed", "failed", "Sucursal: Valor no disponible"],
  ["not an option of the source", "done", "Sucursal: Valor no disponible"],
] as const)("names a fixed catalog value that is %s", async (_case, read, text) => {
  byId.read = read;
  await act(async () => { renderWithProviders(<CatalogQuestionSourceSummary scope={{ actorId: "actor", culture: "es", permissions: ["formcatalogs.read"] }} source={{ catalog: "catalog", match: [{ fieldId: "field", value: "01990000-0000-7000-8000-000000000078" }] }}/>); });
  expect(screen.getByText(new RegExp("^" + text))).toBeInTheDocument();
  expect(document.body).not.toHaveTextContent("01990000-0000-7000-8000-000000000078");
});
