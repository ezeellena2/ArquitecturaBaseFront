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

/** The list of a catalog question opens with the keyboard, like the other Radix lists in the tests. */
async function openList(user: ReturnType<typeof userEvent.setup>, name: string) {
  const trigger = await screen.findByRole("button", { name });
  await act(async () => { trigger.focus(); });
  await user.keyboard("{Enter}");
  return screen.findByRole("listbox");
}

/** The width of a phone, where the list opens full screen. */
const phone = () => vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(width < 640px)", media: query, onchange: null,
  addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));

describe("a catalog question while loading", () => {
  it("asks for the options when the list opens, searches in the server and brings fifty more", async () => {
    const { requests } = setup();
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    expect(await screen.findByRole("button", { name: "Lotes Elegí una opción" })).toBeInTheDocument();
    expect(requests).toHaveLength(0);
    const list = await openList(user, "Lotes Elegí una opción");
    expect(list).toHaveAccessibleName("Lotes");
    expect(await screen.findByText("4 opciones")).toBeVisible();
    expect(within(list).getAllByRole("option")).toHaveLength(2);
    expect(within(list).getByRole("option", { name: "Lote 1" })).toHaveAccessibleDescription("Campo Norte");
    expect(requests[0].get("pageSize")).toBe("50");
    await user.click(screen.getByRole("button", { name: "Mostrar 50 más" }));
    await waitFor(() => expect(within(list).getAllByRole("option")).toHaveLength(4));
    expect(screen.queryByRole("button", { name: "Mostrar 50 más" })).not.toBeInTheDocument();
    const search = screen.getByRole("combobox", { name: "Buscar en Lotes" });
    expect(search).toHaveFocus();
    await user.type(search, "zzz");
    expect(await screen.findByText("Ninguna opción coincide con «zzz».")).toBeVisible();
    expect(requests.at(-1)?.get("search")).toBe("zzz");
    await user.clear(search);
    await user.type(search, "3");
    await user.click(await within(list).findByRole("option", { name: "Lote 3" }));
    expect(await screen.findByRole("button", { name: "Lotes Lote 3" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar Lote 3" }));
    expect(screen.getByRole("button", { name: "Lotes Elegí una opción" })).toBeInTheDocument();
  });

  // The limit is in the label (decision of 2026-10-31) and the list says it too (DS1-A): «Hasta 2» and, once reached, «Elegiste 2 de 2».
  it("chooses up to the maximum of a multiple choice and says the chosen ones by their names", async () => {
    setup(true);
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    expect(await screen.findByText("hasta 2")).toBeVisible();
    const list = await openList(user, "Lotes Elegí una opción");
    expect(list).toHaveAttribute("aria-multiselectable", "true");
    expect(screen.getByText("Hasta 2")).toBeVisible();
    await user.click(await within(list).findByRole("option", { name: "Lote 1" }));
    await user.click(within(list).getByRole("option", { name: "Lote 2" }));
    expect(screen.getByText("Elegiste 2 de 2")).toBeVisible();
    expect(within(list).getByRole("option", { name: "Lote 1" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("button", { name: "Mostrar 50 más" }));
    expect(await within(list).findByRole("option", { name: "Lote 3" })).toHaveAttribute("aria-disabled", "true");
    await user.click(within(list).getByRole("option", { name: "Lote 1" }));
    expect(screen.queryByText("Elegiste 2 de 2")).not.toBeInTheDocument();
    expect(within(list).getByRole("option", { name: "Lote 3" })).not.toHaveAttribute("aria-disabled");
    await user.keyboard("{Escape}");
    // DS2-A: no chips; the field says the chosen ones, and its name says all of them.
    expect(await screen.findByRole("button", { name: "Lotes Lote 2" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Quitar/ })).not.toBeInTheDocument();
  });

  it("opens the list full screen on the phone and applies several choices with «Listo», also after another search", async () => {
    phone();
    setup(true);
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    await user.click(await screen.findByRole("button", { name: "Lotes Elegí una opción" }));
    const dialog = await screen.findByRole("dialog", { name: "Lotes" });
    expect(within(dialog).getByRole("combobox", { name: "Buscar en Lotes" })).toHaveFocus();
    await user.click(await within(dialog).findByRole("option", { name: "Lote 1" }));
    // One marked in another search keeps its title until «Listo» applies both.
    await user.type(within(dialog).getByRole("combobox", { name: "Buscar en Lotes" }), "3");
    await user.click(await within(dialog).findByRole("option", { name: "Lote 3" }));
    await user.click(within(dialog).getByRole("button", { name: "Listo (2)" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Lotes" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Lotes Lote 1, Lote 3" })).toBeVisible();
  });

  // DL (2026-11-11): the title is the question alone. Under the search, one fixed row reads both counts: the options on one side
  // and, on the other, the limit, which says «Elegiste N de N» once it is reached.
  it("keeps the limit out of the title on the phone and reads both counts in one row", async () => {
    phone();
    setup(true);
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    await user.click(await screen.findByRole("button", { name: "Lotes Elegí una opción" }));
    const dialog = await screen.findByRole("dialog", { name: "Lotes" });
    expect(within(dialog).getByRole("heading", { name: "Lotes" })).toHaveTextContent(/^Lotes$/);
    const row = (await within(dialog).findByText("4 opciones")).parentElement!;
    expect(within(row).getByText("Hasta 2")).toBeVisible();
    await user.click(within(dialog).getByRole("option", { name: "Lote 1" }));
    await user.click(within(dialog).getByRole("option", { name: "Lote 2" }));
    expect(within(row).getByText("4 opciones")).toBeVisible();
    expect(within(row).getByText("Elegiste 2 de 2")).toBeVisible();
    expect(within(dialog).queryByText("Hasta 2")).not.toBeInTheDocument();
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
    const list = await openList(user, "Lotes Elegí una opción");
    await user.click(await screen.findByRole("button", { name: "Mostrar 50 más" }));
    expect(screen.getByRole("button", { name: "Cargando…" })).toHaveAttribute("aria-busy", "true");
    await act(async () => release());
    await waitFor(() => expect(within(list).getAllByRole("option")).toHaveLength(4));
  });

  it("says inside the list that the options failed and asks for them again with «Reintentar»", async () => {
    setup();
    let calls = 0;
    server.use(http.get("/api/forms/entries/:formId/versions/:versionId/questions/:fieldId/options", () => {
      calls++;
      return calls === 1 ? HttpResponse.json({ code: "Unexpected.Error" }, { status: 500 })
        : HttpResponse.json({ items: lots.slice(0, 2), page: 1, pageSize: 50, totalCount: 2, totalPages: 1, hasPrevious: false, hasNext: false });
    }));
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    const list = await openList(user, "Lotes Elegí una opción");
    expect(await screen.findByText("No se pudieron traer las opciones.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await within(list).findByRole("option", { name: "Lote 2" })).toBeVisible();
    expect(screen.queryByText("No se pudieron traer las opciones.")).not.toBeInTheDocument();
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
    const lot = await screen.findByRole("button", { name: "Lote Elegí primero «Campo»" });
    expect(lot).toBeDisabled();
    await user.click(await within(await openList(user, "Campo Elegí una opción")).findByRole("option", { name: "El Ombú" }));
    await waitFor(() => expect(lot).toBeEnabled());
    const list = await openList(user, "Lote Elegí una opción");
    expect(await screen.findByText("2 opciones de El Ombú")).toBeVisible();
    await user.click(within(list).getByRole("option", { name: "Lote 2" }));
    expect(await screen.findByRole("button", { name: "Lote Lote 2" })).toBe(lot);
    expect(requests.at(-1)?.get(`answers[${field}]`)).toBe(ombu);
    // Another field clears the lot chosen for the first one.
    await user.click(await within(await openList(user, "Campo El Ombú")).findByRole("option", { name: "La Esperanza" }));
    expect(await screen.findByRole("button", { name: "Lote Elegí una opción" })).toBe(lot);
    expect(await within(await openList(user, "Lote Elegí una opción")).findByRole("option", { name: "Lote 3" })).toBeVisible();
    expect(requests.at(-1)?.get(`answers[${field}]`)).toBe(esperanza);
  });
});

// LD1-A (2026-11-07): the question is two lists, the field's first («Rubro») and then its own with only the options of that value.
describe("choosing first by a field (LD1-A)", () => {
  const article: FormEntry["questions"][number] = { fieldId: id(511), type: "choice", label: "Artículo", help: null, required: true, maxLength: null, options: null,
    selection: null, files: null, catalog: { onlyOption: null, issue: null, missingData: null, groupBy: { fieldId: id(513), name: "Rubro" } } };
  const products: Record<string, { id: string; title: string; description: null }[]> = {
    Herbicidas: [{ id: id(541), title: "2,4-D 100 %", description: null }, { id: id(542), title: "Glifosato 66,2 %", description: null }],
    none: [{ id: id(543), title: "Sin clasificar", description: null }],
  };
  function serve(groups: { id: string | null; text: string }[]) {
    const requests: URLSearchParams[] = [];
    server.use(
      http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.create"] })),
      http.get("/api/forms/entries/:formId", () => HttpResponse.json({ ...entry(false), questions: [article] })),
      http.get("/api/forms/entries/:formId/versions/:versionId/questions/:fieldId/groups", () => HttpResponse.json({ groups })),
      http.get("/api/forms/entries/:formId/versions/:versionId/questions/:fieldId/options", ({ request }) => {
        const query = new URL(request.url).searchParams;
        requests.push(query);
        const items = query.get("withoutGroup") === "true" ? products.none : products[query.get("group") ?? ""] ?? [];
        return HttpResponse.json({ items, page: 1, pageSize: 50, totalCount: items.length, totalPages: 1, hasPrevious: false, hasNext: false });
      }),
    );
    return requests;
  }

  it("waits for the value, lists only its options with the value in the count and is cleared when the value changes", async () => {
    const requests = serve([{ id: "Herbicidas", text: "Herbicidas" }, { id: null, text: "Sin rubro" }]);
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    const option = await screen.findByRole("button", { name: "Artículo Elegí primero «Rubro»" });
    expect(option).toBeDisabled();
    const values = await openList(user, "Rubro Elegí una opción");
    expect(values).toHaveAccessibleName("Rubro");
    await waitFor(() => expect(within(values).getAllByRole("option").map(item => item.textContent)).toEqual(["Herbicidas", "Sin rubro"]));
    // Two values: no search in their list.
    expect(screen.queryByRole("combobox", { name: "Buscar en Rubro" })).not.toBeInTheDocument();
    await user.click(within(values).getByRole("option", { name: "Herbicidas" }));
    await waitFor(() => expect(option).toBeEnabled());
    const list = await openList(user, "Artículo Elegí una opción");
    expect(await screen.findByText("2 opciones de Herbicidas")).toBeVisible();
    await user.click(within(list).getByRole("option", { name: "Glifosato 66,2 %" }));
    expect(await screen.findByRole("button", { name: "Artículo Glifosato 66,2 %" })).toBe(option);
    expect(requests.at(-1)?.get("group")).toBe("Herbicidas");
    // Another value clears the option chosen for the first one; the options without a value are asked as such.
    await user.click(await within(await openList(user, "Rubro Herbicidas")).findByRole("option", { name: "Sin rubro" }));
    expect(await screen.findByRole("button", { name: "Artículo Elegí una opción" })).toBe(option);
    expect(await within(await openList(user, "Artículo Elegí una opción")).findByRole("option", { name: "Sin clasificar" })).toBeVisible();
    expect(requests.at(-1)?.get("withoutGroup")).toBe("true");
    expect(requests.at(-1)?.has("group")).toBe(false);
  });

  it("brings the search of its list with more than ten values", async () => {
    serve(Array.from({ length: 11 }, (_, index) => ({ id: `Rubro ${index + 1}`, text: `Rubro ${index + 1}` })));
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    const values = await openList(user, "Rubro Elegí una opción");
    await user.type(await screen.findByRole("combobox", { name: "Buscar en Rubro" }), "11");
    expect(within(values).getAllByRole("option").map(item => item.textContent)).toEqual(["Rubro 11"]);
  });

  it("comes with the only value already chosen", async () => {
    serve([{ id: "Herbicidas", text: "Herbicidas" }]);
    renderRouteWithProviders("/formularios/" + formId + "/cargar");
    expect(await screen.findByRole("button", { name: "Rubro Herbicidas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Artículo Elegí una opción" })).toBeEnabled();
  });
});
