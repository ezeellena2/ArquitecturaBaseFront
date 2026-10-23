import { act, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { CatalogQuestionSourceSummary } from "./CatalogQuestionSourceSummary";
const field = vi.hoisted(() => ({ id: "field", name: { es: "Sucursal" }, type: "catalog", sourceCatalogId: "branches", isActive: true }));
const south = vi.hoisted(() => ({ id: "01990000-0000-7000-8000-000000000077", code: "S", text: { es: "Sur", en: "South" }, detail: {}, value: null, position: 37, isActive: false, fields: {}, fieldTexts: {} }));
vi.mock("../hooks/useCatalogQueries", () => ({ useCatalogDetail: () => ({ data: { fields: [field] } }), useCatalogItemsById: (_scope: unknown, catalogId: string, itemIds: readonly string[]) => ({ data: catalogId === "branches" && itemIds.includes(south.id) ? { items: [south] } : undefined }) }));
vi.mock("../hooks/usePersonData", () => ({ usePersonAttributes: () => ({ data: { items: [] } }) }));
beforeEach(() => { field.type = "catalog"; });
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
