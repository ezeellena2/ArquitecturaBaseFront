import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import type { FormEntry } from "../api/entries";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));

const id = (value: number) => "0199a0c0-0000-7000-8000-" + String(value).padStart(12, "0");
const formId = id(501);
const lots = ["Lote 1", "Lote 2", "Lote 3", "Lote 4"].map((title, index) => ({ id: id(521 + index), title, description: index === 0 ? "Campo Norte" : null }));
// Synthetic behavior DTO; the bodies exported by the backend qualify the contract in entriesHttpContract.
function entry(multiple: boolean): FormEntry {
  return { definitionId: formId, versionId: id(502), versionNumber: 1, prefix: "LOT", name: "Recorrida", culture: "es", submitLabel: "Enviar", maxFileSizeMiB: 25,
    questions: [{ fieldId: id(511), type: multiple ? "multiChoice" : "choice", label: "Lotes", help: null, required: false, maxLength: null, options: null,
      selection: multiple ? { minSelected: 0, maxSelected: 2 } : null, files: null, catalog: { onlyOption: null, issue: null, missingData: null } }] };
}

function setup(multiple = false) {
  const requests: URLSearchParams[] = [];
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.create"] })),
    http.get("/api/forms/entries/:formId", () => HttpResponse.json(entry(multiple))),
    http.get("/api/forms/entries/:formId/versions/:versionId/questions/:fieldId/options", ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      const search = params.get("search")?.toLowerCase() ?? "";
      const page = Number(params.get("page"));
      const matching = lots.filter(lot => lot.title.toLowerCase().includes(search));
      // Two per page here, so «Mostrar 50 más» has something to bring without fifty fixtures.
      const items = matching.slice((page - 1) * 2, page * 2);
      return HttpResponse.json({ items, page, pageSize: 50, totalCount: matching.length, totalPages: Math.ceil(matching.length / 2),
        hasPrevious: page > 1, hasNext: page * 2 < matching.length });
    }),
  );
  return { requests };
}

beforeEach(() => queryClient.clear());
afterEach(() => vi.restoreAllMocks());

describe("a catalog question while loading", () => {
  it("asks for the options when the list opens, searches in the server and brings fifty more", async () => {
    const { requests } = setup();
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    const field = await screen.findByRole("combobox", { name: "Lotes" });
    expect(requests).toHaveLength(0);
    await user.click(field);
    const list = await screen.findByRole("listbox", { name: "Lotes" });
    expect(within(list).getByText("4 opciones")).toBeVisible();
    expect(within(list).getAllByRole("option")).toHaveLength(2);
    expect(requests[0].get("pageSize")).toBe("50");
    await user.click(within(list).getByRole("button", { name: "Mostrar 50 más" }));
    await waitFor(() => expect(within(list).getAllByRole("option")).toHaveLength(4));
    expect(within(list).queryByRole("button", { name: "Mostrar 50 más" })).not.toBeInTheDocument();
    await user.type(field, "zzz");
    expect(await within(await screen.findByRole("listbox")).findByText("Ninguna opción coincide con «zzz».")).toBeVisible();
    expect(requests.at(-1)?.get("search")).toBe("zzz");
    await user.clear(field);
    await user.type(field, "3");
    await user.click(await screen.findByRole("option", { name: "Lote 3" }));
    expect(field).toHaveValue("Lote 3");
    await user.click(screen.getByRole("button", { name: "Quitar Lote 3" }));
    expect(field).toHaveValue("");
  });

  // The limit is in the label (decision of 2026-10-31); «Elegiste N de N.» stays as the count once it is reached.
  it("chooses up to the maximum of a multiple choice and shows each choice as a chip", async () => {
    setup(true);
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    expect(await screen.findByText("hasta 2")).toBeVisible();
    expect(screen.queryByText("Elegí hasta 2.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Lotes" }));
    await user.click(await screen.findByRole("option", { name: /^Lote 1/ }));
    await user.click(screen.getByRole("option", { name: "Lote 2" }));
    expect(screen.getByText("Elegiste 2 de 2.")).toBeVisible();
    expect(screen.getByRole("option", { name: /^Lote 1/ })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("button", { name: "Mostrar 50 más" }));
    expect(await screen.findByRole("option", { name: "Lote 3" })).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("button", { name: "Quitar Lote 1" }));
    expect(screen.queryByText("Elegiste 2 de 2.")).not.toBeInTheDocument();
    expect(screen.queryByText("Elegí hasta 2.")).not.toBeInTheDocument();
  });

  it("opens the list full screen on the phone and applies several choices with «Listo»", async () => {
    vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(width < 640px)", media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    setup(true);
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    await user.click(await screen.findByRole("button", { name: "Lotes hasta 2" }));
    const dialog = await screen.findByRole("dialog", { name: "Lotes hasta 2" });
    expect(within(dialog).queryByText("Elegí hasta 2.")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("textbox", { name: "Buscar en Lotes" })).toHaveFocus();
    await user.click(await within(dialog).findByRole("option", { name: /^Lote 1/ }));
    await user.click(within(dialog).getByRole("option", { name: "Lote 2" }));
    await user.click(within(dialog).getByRole("button", { name: "Listo · 2 elegidos" }));
    expect(screen.queryByRole("dialog", { name: "Lotes hasta 2" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quitar Lote 1" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Quitar Lote 2" })).toBeVisible();
  });

  it("says Cargando… on «Mostrar 50 más» while the next options arrive", async () => {
    setup();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    server.use(http.get("/api/forms/entries/:formId/versions/:versionId/questions/:fieldId/options", async ({ request }) => {
      const page = Number(new URL(request.url).searchParams.get("page"));
      if (page > 1) await gate;
      const items = lots.slice((page - 1) * 2, page * 2);
      return HttpResponse.json({ items, page, pageSize: 50, totalCount: lots.length, totalPages: 2, hasPrevious: page > 1, hasNext: page < 2 });
    }));
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    await user.click(await screen.findByRole("combobox", { name: "Lotes" }));
    const list = await screen.findByRole("listbox", { name: "Lotes" });
    await user.click(within(list).getByRole("button", { name: "Mostrar 50 más" }));
    expect(within(list).getByRole("button", { name: "Cargando…" })).toHaveAttribute("aria-busy", "true");
    await act(async () => release());
    await waitFor(() => expect(within(list).getAllByRole("option")).toHaveLength(4));
  });
});

describe("a list that depends on another answer (CW7)", () => {
  const field = id(512), ombu = id(531), esperanza = id(532);
  const question = (fieldId: string, label: string, dependsOn?: string[]): FormEntry["questions"][number] => ({ fieldId, type: "choice", label, help: null, required: true,
    maxLength: null, options: null, selection: null, files: null, catalog: { onlyOption: null, issue: null, missingData: null, ...(dependsOn ? { dependsOn } : {}) } });

  it("waits for the field, lists only its lots with the field in the count and is cleared when the field changes", async () => {
    const requests: URLSearchParams[] = [];
    server.use(
      http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.create"] })),
      http.get("/api/forms/entries/:formId", () => HttpResponse.json({ ...entry(false), questions: [question(field, "Campo"), question(id(511), "Lote", [field])] })),
      http.get("/api/forms/entries/:formId/versions/:versionId/questions/:fieldId/options", ({ request, params }) => {
        const query = new URL(request.url).searchParams;
        if (params.fieldId !== field) requests.push(query);
        const items = params.fieldId === field ? [{ id: ombu, title: "El Ombú", description: null }, { id: esperanza, title: "La Esperanza", description: null }]
          : query.get(`answers[${field}]`) === ombu ? lots.slice(0, 2) : lots.slice(2);
        return HttpResponse.json({ items, page: 1, pageSize: 50, totalCount: items.length, totalPages: 1, hasPrevious: false, hasNext: false });
      }),
    );
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    const lot = await screen.findByRole("combobox", { name: "Lote" });
    expect(lot).toBeDisabled();
    expect(lot).toHaveAttribute("placeholder", "Elegí primero «Campo»");
    const campo = screen.getByRole("combobox", { name: "Campo" });
    await user.click(campo);
    await user.click(await screen.findByRole("option", { name: "El Ombú" }));
    await waitFor(() => expect(lot).toBeEnabled());
    await user.click(lot);
    const list = await screen.findByRole("listbox", { name: "Lote" });
    expect(within(list).getByText("2 opciones de El Ombú")).toBeVisible();
    await user.click(within(list).getByRole("option", { name: "Lote 2" }));
    expect(lot).toHaveValue("Lote 2");
    expect(requests.at(-1)?.get(`answers[${field}]`)).toBe(ombu);
    // Another field clears the lot chosen for the first one.
    await user.click(campo);
    await user.click(await screen.findByRole("option", { name: "La Esperanza" }));
    expect(lot).toHaveValue("");
    await user.click(lot);
    expect(await within(await screen.findByRole("listbox", { name: "Lote" })).findByRole("option", { name: "Lote 3" })).toBeVisible();
    expect(requests.at(-1)?.get(`answers[${field}]`)).toBe(esperanza);
  });
});
