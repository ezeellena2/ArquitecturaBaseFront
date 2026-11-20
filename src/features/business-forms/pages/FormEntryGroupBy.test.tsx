import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import type { FormEntry, FormEntryCorrection, FormEntryQuestion } from "../api/entries";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));

const id = (value: number) => "0199a0c0-0000-7000-8000-" + String(value).padStart(12, "0");
const formId = id(701), recordId = id(751);
const fields = { block: id(712), article: id(713), quantity: id(714), category: id(715) };
const herbicides = [{ id: id(721), title: "2,4-D 100 %", description: null }, { id: id(722), title: "Glifosato 66,2 %", description: null }];
const groups = [{ id: "Herbicidas", text: "Herbicidas" }, { id: "Insecticidas", text: "Insecticidas" }];
const article = (repeated: boolean): FormEntryQuestion => ({ fieldId: fields.article, type: "choice", label: "Artículo", help: null, required: true, maxLength: null,
  options: null, selection: null, files: null, catalog: { onlyOption: null, issue: null, missingData: null, groupBy: { fieldId: fields.category, name: "Rubro" } },
  ...repeated ? { repeated: true as const } : {} });
const base = { definitionId: formId, versionId: id(702), versionNumber: 1, prefix: "PED", name: "Pedido de insumos", culture: "es" as const, submitLabel: "Enviar", maxFileSizeMiB: 25 };
// Synthetic behavior DTOs, with the shape of the backend's (LD1-A); the exported bodies qualify the contract when the cohorts are exported.
const withBlock: FormEntry = { ...base, questions: [
  { fieldId: fields.block, type: "group", label: "Artículos", help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null, rows: { minRows: 2, maxRows: 3 } },
  article(true),
  { fieldId: fields.quantity, type: "decimal", label: "Cantidad", help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null, repeated: true },
] };
const loose: FormEntry = { ...base, questions: [article(false)] };

function setup(entry: FormEntry, correction?: FormEntryCorrection) {
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.create", "formrecords.amend"] })),
    http.get("/api/forms/entries/:formId", () => HttpResponse.json(entry)),
    http.get("/api/forms/entries/:formId/records/:recordId", () => HttpResponse.json(correction)),
    http.get("/api/forms/entries/:formId/versions/:versionId/questions/:fieldId/groups", () => HttpResponse.json({ groups })),
    http.get("/api/forms/entries/:formId/records/:recordId/versions/:versionId/questions/:fieldId/groups", () => HttpResponse.json({ groups })),
    http.get("/api/forms/entries/:formId/records/:recordId/versions/:versionId/questions/:fieldId/options", () =>
      HttpResponse.json({ items: herbicides, page: 1, pageSize: 50, totalCount: 2, totalPages: 1, hasPrevious: false, hasNext: false })),
    http.get("/api/forms/entries/:formId/versions/:versionId/questions/:fieldId/options", () =>
      HttpResponse.json({ items: herbicides, page: 1, pageSize: 50, totalCount: 2, totalPages: 1, hasPrevious: false, hasNext: false })),
  );
}

beforeEach(() => queryClient.clear());
afterEach(() => vi.restoreAllMocks());

describe("choosing first by a field while loading (LD1-A)", () => {
  it("gives the field and the question a column each in the table, and each item chooses its own value", async () => {
    setup(withBlock);
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Ítem", "Rubro *", "Artículo *", "Cantidad *", "Acciones"]);
    const first = screen.getByRole("button", { name: /^Ítem 1 · Artículo / }), second = screen.getByRole("button", { name: /^Ítem 2 · Artículo / });
    expect(first).toBeDisabled();
    const trigger = screen.getByRole("button", { name: "Ítem 1 · Rubro Elegí una opción" });
    await act(async () => { trigger.focus(); });
    await user.keyboard("{Enter}");
    await user.click(await within(await screen.findByRole("listbox", { name: "Ítem 1 · Rubro" })).findByRole("option", { name: "Herbicidas" }));
    await waitFor(() => expect(first).toBeEnabled());
    expect(second).toBeDisabled();
    expect(second).toHaveAccessibleName("Ítem 2 · Artículo Elegí primero «Rubro»");
  });

  it("starts a correction with the value of the saved option", async () => {
    setup(loose, { entry: loose, recordId, number: "PED-000003", files: [], answers: [
      { fieldId: fields.article, value: herbicides[1].id, choiceIds: null, options: [herbicides[1]], group: { id: "Herbicidas", text: "Herbicidas" } }] });
    renderRouteWithProviders(`/formularios/${formId}/respuestas/${recordId}/corregir`);
    expect(await screen.findByRole("button", { name: "Rubro Herbicidas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Artículo Glifosato 66,2 %" })).toBeEnabled();
  });
});
