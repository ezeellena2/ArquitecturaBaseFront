import { act, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { CatalogConditionValue, CatalogFieldName, CatalogName, CatalogPresentationValue } from "./CatalogSourceValues";
const field = vi.hoisted(() => ({ id: "field", name: { es: "Sucursal" } as Readonly<Record<string, string>>, type: "catalog", sourceCatalogId: "branches", isActive: true }));
const south = vi.hoisted(() => ({ id: "01990000-0000-7000-8000-000000000077", code: "S", text: { es: "Sur", en: "South" } as Readonly<Record<string, string>>, detail: {}, value: null, position: 37, isActive: false, fields: {}, fieldTexts: {} }));
const typedFields = vi.hoisted(() => [{ id: "amount", name: { es: "Importe" }, type: "decimal", sourceCatalogId: null, isActive: true }, { id: "units", name: { es: "Unidades" }, type: "integer", sourceCatalogId: null, isActive: true }]);
const byId = vi.hoisted(() => ({ read: "done" as "done" | "loading" | "failed" }));
vi.mock("../hooks/useCatalogQueries", () => ({ useCatalogDetail: () => ({ data: { name: { es: "Clientes" }, fields: [field, ...typedFields] } }), useCatalogItemsById: (_scope: unknown, catalogId: string, itemIds: readonly string[]) =>
  byId.read === "loading" ? { data: undefined, isLoading: true, isError: false } : byId.read === "failed" ? { data: undefined, isLoading: false, isError: true }
  : { data: catalogId === "branches" ? { items: itemIds.includes(south.id) ? [south] : [] } : undefined, isLoading: false, isError: false } }));
const attributes = vi.hoisted(() => ({ items: [] as unknown[] }));
vi.mock("../hooks/usePersonData", () => ({ usePersonAttributes: () => ({ data: attributes }) }));
const scope = { actorId: "actor", culture: "es" as const, permissions: ["formcatalogs.read"] };
beforeEach(() => { field.type = "catalog"; field.name = { es: "Sucursal" }; south.text = { es: "Sur", en: "South" }; attributes.items = []; byId.read = "done"; });

it("names the catalog, the field of a filter, its fixed option and the presentation fields without exposing option identities", async () => {
  await act(async () => { renderWithProviders(<>
    <span data-testid="catalog"><CatalogName scope={scope} id="catalog" /></span>
    <span data-testid="field"><CatalogFieldName scope={scope} catalogId="catalog" fieldId="field" /></span>
    <span data-testid="value"><CatalogConditionValue scope={scope} catalogId="catalog" condition={{ fieldId: "field", value: south.id }} /></span>
    <span data-testid="parts"><CatalogPresentationValue scope={scope} catalogId="catalog" parts={["text", "field"]} /></span>
  </>); });
  expect(screen.getByTestId("catalog")).toHaveTextContent(/^Clientes$/);
  expect(screen.getByTestId("field")).toHaveTextContent(/^Sucursal$/);
  expect(screen.getByTestId("value")).toHaveTextContent(/^Sur$/);
  expect(screen.getByTestId("parts")).toHaveTextContent(/^Texto · Sucursal$/);
  expect(document.body).not.toHaveTextContent(south.id);
});

it("does not call an incomplete boolean filter No", async () => {
  field.type = "boolean";
  await act(async () => { renderWithProviders(<CatalogConditionValue scope={scope} catalogId="catalog" condition={{ fieldId: "field", value: null }} />); });
  expect(document.body).not.toHaveTextContent("No");
});

it("shows fixed typed filter values with the shared format", async () => {
  await act(async () => { renderWithProviders(<>
    <span data-testid="amount"><CatalogConditionValue scope={scope} catalogId="catalog" condition={{ fieldId: "amount", value: "1500.5" }} /></span>
    <span data-testid="units"><CatalogConditionValue scope={scope} catalogId="catalog" condition={{ fieldId: "units", value: "15000" }} /></span>
  </>); });
  expect(screen.getByTestId("amount")).toHaveTextContent(/^1\.500,5$/);
  expect(screen.getByTestId("units")).toHaveTextContent(/^15\.000$/);
});

it("names a field, its fixed option and the person data written only in the other language", async () => {
  field.name = { en: "Branch" }; south.text = { en: "South" }; attributes.items = [{ id: "zone", name: { en: "Customer branch" } }];
  await act(async () => { renderWithProviders(<>
    <span data-testid="field"><CatalogFieldName scope={scope} catalogId="catalog" fieldId="field" /></span>
    <span data-testid="value"><CatalogConditionValue scope={scope} catalogId="catalog" condition={{ fieldId: "field", value: south.id }} /></span>
    <span data-testid="person"><CatalogConditionValue scope={scope} catalogId="catalog" condition={{ fieldId: "field", personAttributeId: "zone" }} /></span>
  </>); });
  expect(screen.getByTestId("field")).toHaveTextContent(/^Branch$/);
  expect(screen.getByTestId("value")).toHaveTextContent(/^South$/);
  expect(screen.getByTestId("person")).toHaveTextContent(/^Customer branch$/);
});

// A fixed option that is still loading, cannot be read or is not an option of the source never leaves its cell empty, which
// would read as no value chosen.
it.each([
  ["loading", "loading", "…"],
  ["failed", "failed", "Valor no disponible"],
  ["not an option of the source", "done", "Valor no disponible"],
] as const)("names a fixed catalog value that is %s", async (_case, read, text) => {
  byId.read = read;
  await act(async () => { renderWithProviders(<CatalogConditionValue scope={scope} catalogId="catalog" condition={{ fieldId: "field", value: "01990000-0000-7000-8000-000000000078" }} />); });
  expect(document.body).toHaveTextContent(new RegExp("^" + text + "$"));
  expect(document.body).not.toHaveTextContent("01990000-0000-7000-8000-000000000078");
});
