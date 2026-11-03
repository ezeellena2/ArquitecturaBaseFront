import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { savePrivateBlob } from "@/shared/hooks/usePrivateFormFile";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { responseFormId } from "@/test/responseFixtures";
import type { ResponseColumn, ResponseQuery } from "../responses";
import { ResponseFiltersMenu } from "./ResponseFiltersMenu";
import { ResponseExportDialog } from "./ResponseExportDialog";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/hooks/usePrivateFormFile", async () => ({ ...await vi.importActual<typeof import("@/shared/hooks/usePrivateFormFile")>("@/shared/hooks/usePrivateFormFile"), savePrivateBlob: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => vi.restoreAllMocks());
const failures: ResponseColumn = { fieldId: "01990000-0000-7000-8000-000000000910", type: "multiChoice", label: "Fallas",
  introducedInVersion: 1, options: [{ id: "01990000-0000-7000-8000-000000000911", label: "Frío" }, { id: "01990000-0000-7000-8000-000000000912", label: "Ruido" }] };
// A catalog question: its column has no options, they come from the server.
const article: ResponseColumn = { fieldId: "01990000-0000-7000-8000-000000000930", type: "choice", label: "Artículo", introducedInVersion: 1, options: [] };
const atrazine = "01990000-0000-7000-8000-000000000931", glyphosate = "01990000-0000-7000-8000-000000000932";
const delivered: ResponseColumn = { fieldId: "01990000-0000-7000-8000-000000000940", type: "boolean", label: "¿Llegó completo?", introducedInVersion: 1, options: [] };
const dose: ResponseColumn = { fieldId: "01990000-0000-7000-8000-000000000920", type: "decimal", label: "Dosis", introducedInVersion: 1, options: [] };
const photo: ResponseColumn = { fieldId: "01990000-0000-7000-8000-000000000950", type: "photo", label: "Foto del remito", introducedInVersion: 1, options: [] };
const ana = "01990000-0000-7000-8000-0000000009a1", version3 = "01990000-0000-7000-8000-0000000009b3";
function setup({ gate }: { gate?: Promise<void> } = {}) {
  const counts: unknown[] = [];
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read"] })),
    http.post("/api/forms/definitions/:id/records/filter-counts/search", async ({ request }) => {
      const body = await request.json() as { dimension: string; fieldId?: string; search?: string };
      counts.push(body);
      if (body.search && gate) await gate;
      const all = body.dimension === "actor" ? [{ id: ana, label: "Ana Pérez", count: 2 }]
        : body.dimension === "version" ? [{ id: version3, label: "3", count: 2 }]
          : body.fieldId === failures.fieldId ? failures.options.map(option => ({ ...option, count: option.label === "Ruido" ? 0 : 2 }))
            : body.fieldId === article.fieldId ? [{ id: atrazine, label: "Atrazina 50%", count: 1 }, { id: glyphosate, label: "Glifosato 48%", count: 3 }]
              : body.fieldId === delivered.fieldId ? [{ id: "true", label: "true", count: 1 }, { id: "false", label: "false", count: 1 }] : [];
      const items = all.filter(item => !body.search || item.label.toLowerCase().includes(body.search.toLowerCase()));
      return HttpResponse.json({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: items.length ? 1 : 0, hasPrevious: false, hasNext: false });
    }),
  );
  return counts;
}
const selected: ResponseQuery = { page: 3, pageSize: 20, state: "Approved", search: "visit" };
const menu = (query: ResponseQuery, apply = vi.fn(), names: Record<string, string> = {}) => renderWithProviders(<ResponseFiltersMenu formId={responseFormId} query={query}
  columns={[failures, article, delivered, dose, photo]} zone="UTC" names={names} onApply={apply}/>);
const open = async () => { await userEvent.click(screen.getByRole("button", { name: /^Filtros/ })); return within(await screen.findByRole("dialog", { name: "Filtros" })); };
const openCombo = async (panel: ReturnType<typeof within>, name: string) => { await userEvent.click(panel.getByRole("combobox", { name })); return within(await screen.findByRole("listbox", { name })); };

// Board PL1-A: the list on the left (Recibida, each question in order, Cargó and Versión) and what is chosen on the right.
// A photo or a document has nothing to filter since «Respuesta» is gone (PL2-A), so it is not in the list.
it("lists what can be filtered and starts with Recibida, without Apply, Cancelar nor a count", async () => {
  setup();
  menu(selected);
  const panel = await open();
  expect(panel.getAllByRole("button").filter(button => button.closest("ul")).map(button => button.textContent)).toEqual(["Recibida", "Fallas", "Artículo", "¿Llegó completo?", "Dosis", "Cargó", "Versión del formulario"]);
  expect(panel.getByRole("region", { name: "Recibida" })).toBeInTheDocument();
  expect(panel.queryByRole("button", { name: /^(Aplicar|Cancelar|Ver \d+ respuestas?)$/ })).not.toBeInTheDocument();
  expect(panel.queryByText("Contando…")).not.toBeInTheDocument();
});

// Board PL2-A: a question with options is a combo that says «Todas» or the chosen one; choosing one closes it and applies at once.
it("applies the option chosen in a question's combo at once, without counts nor text under the options", async () => {
  setup();
  const apply = vi.fn();
  menu(selected, apply);
  const panel = await open();
  await userEvent.click(panel.getByRole("button", { name: "Fallas" }));
  const combo = panel.getByRole("combobox", { name: "Fallas" });
  expect(combo).toHaveValue("");
  expect(combo).toHaveAttribute("placeholder", "Todas");
  const list = await openCombo(panel, "Fallas");
  await list.findByRole("option", { name: "Frío" });
  expect(list.getAllByRole("option").map(option => option.textContent)).toEqual(["Todas", "Frío", "Ruido"]);
  expect(list.getByRole("option", { name: "Todas" })).toHaveAttribute("aria-selected", "true");
  // An option with zero is not off: the server's counts are not shown anymore.
  expect(list.getByRole("option", { name: "Ruido" })).not.toHaveAttribute("aria-disabled");
  await userEvent.click(list.getByRole("option", { name: "Frío" }));
  expect(apply).toHaveBeenCalledWith(expect.objectContaining({ state: "Approved", search: "visit",
    conditions: [{ fieldId: failures.fieldId, operator: "anyOf", values: [failures.options[0].id] }] }), [], { [failures.options[0].id]: "Frío" });
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

// A catalog question's column has no options: its closed combo says the name remembered when it was chosen.
it("names the chosen catalog option in its closed combo and remembers the name of another one", async () => {
  setup();
  const apply = vi.fn();
  menu({ ...selected, conditions: [{ fieldId: article.fieldId, operator: "in", values: [glyphosate] }] }, apply, { [glyphosate]: "Glifosato 48%" });
  const panel = await open();
  await userEvent.click(panel.getByRole("button", { name: "Artículo con filtro" }));
  expect(panel.getByRole("combobox", { name: "Artículo" })).toHaveValue("Glifosato 48%");
  const list = await openCombo(panel, "Artículo");
  expect(await list.findByRole("option", { name: "Glifosato 48%" })).toHaveAttribute("aria-selected", "true");
  await userEvent.click(list.getByRole("option", { name: "Atrazina 50%" }));
  expect(apply).toHaveBeenLastCalledWith(expect.objectContaining({ conditions: [{ fieldId: article.fieldId, operator: "in", values: [atrazine] }] }), [], { [atrazine]: "Atrazina 50%" });
});

it("takes the filter away with Todas", async () => {
  setup();
  const apply = vi.fn();
  menu({ ...selected, conditions: [{ fieldId: failures.fieldId, operator: "anyOf", values: [failures.options[0].id] }] }, apply);
  const panel = await open();
  await userEvent.click(panel.getByRole("button", { name: "Fallas con filtro" }));
  expect(panel.getByRole("combobox", { name: "Fallas" })).toHaveValue("Frío");
  const list = await openCombo(panel, "Fallas");
  await userEvent.click(await list.findByRole("option", { name: "Todas" }));
  expect(apply).toHaveBeenLastCalledWith(expect.objectContaining({ state: "Approved", conditions: [] }), []);
});

// Typing in the combo searches among all the options in the server; meanwhile the open list says so.
it("searches the options while typing and says Buscando… meanwhile", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const counts = setup({ gate });
  menu({ page: 1, pageSize: 20 });
  const panel = await open();
  await userEvent.click(panel.getByRole("button", { name: "Artículo" }));
  const list = await openCombo(panel, "Artículo");
  await list.findByRole("option", { name: "Atrazina 50%" });
  await userEvent.type(panel.getByRole("combobox", { name: "Artículo" }), "gli");
  expect(await screen.findByText("Buscando…")).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "Atrazina 50%" })).not.toBeInTheDocument();
  await act(async () => release());
  expect(await screen.findByRole("option", { name: "Glifosato 48%" })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "Todas" })).not.toBeInTheDocument();
  expect(counts).toContainEqual(expect.objectContaining({ fieldId: article.fieldId, search: "gli" }));
});

it("shows the first 20 options and brings the rest with «Mostrar … más», keeping the focus in the combo", async () => {
  setup();
  const options = Array.from({ length: 25 }, (_, index) => ({ id: `01990000-0000-7000-8000-0000000010${String(index).padStart(2, "0")}`, label: `Opción ${String(index + 1).padStart(2, "0")}`, count: 1 }));
  server.use(http.post("/api/forms/definitions/:id/records/filter-counts/search", async ({ request }) => {
    const { page } = await request.json() as { page: number };
    return HttpResponse.json({ items: options.slice((page - 1) * 20, page * 20), page, pageSize: 20, totalCount: 25, totalPages: 2, hasPrevious: page > 1, hasNext: page < 2 });
  }));
  menu({ page: 1, pageSize: 20 });
  const panel = await open();
  await userEvent.click(panel.getByRole("button", { name: "Artículo" }));
  const list = await openCombo(panel, "Artículo");
  await list.findByRole("option", { name: "Opción 20" });
  expect(list.queryByRole("option", { name: "Opción 21" })).not.toBeInTheDocument();
  await userEvent.click(list.getByRole("button", { name: "Mostrar 5 más" }));
  expect(await list.findByRole("option", { name: "Opción 25" })).toBeInTheDocument();
  expect(list.getByRole("option", { name: "Opción 01" })).toBeInTheDocument();
  expect(list.queryByRole("button", { name: /^Mostrar/ })).not.toBeInTheDocument();
  expect(panel.getByRole("combobox", { name: "Artículo" })).toHaveFocus();
});

it("offers Sí and No without typing for a yes/no question", async () => {
  setup();
  const apply = vi.fn();
  menu(selected, apply);
  const panel = await open();
  await userEvent.click(panel.getByRole("button", { name: "¿Llegó completo?" }));
  expect(panel.getByRole("combobox", { name: "¿Llegó completo?" })).toHaveAttribute("readonly");
  const list = await openCombo(panel, "¿Llegó completo?");
  await list.findByRole("option", { name: "No" });
  expect(list.getAllByRole("option").map(option => option.textContent)).toEqual(["Todas", "Sí", "No"]);
  await userEvent.click(list.getByRole("option", { name: "No" }));
  expect(apply).toHaveBeenLastCalledWith(expect.objectContaining({ conditions: [{ fieldId: delivered.fieldId, operator: "in", values: ["false"] }] }), [], { false: "No" });
});

it("filters by one person and one version with the same combo", async () => {
  setup();
  const apply = vi.fn();
  menu(selected, apply);
  const panel = await open();
  await userEvent.click(panel.getByRole("button", { name: "Cargó" }));
  await userEvent.click(await (await openCombo(panel, "Cargó")).findByRole("option", { name: "Ana Pérez" }));
  expect(apply).toHaveBeenLastCalledWith(expect.objectContaining({ state: "Approved", actorIds: [ana] }), [], { [ana]: "Ana Pérez" });
  await userEvent.click(panel.getByRole("button", { name: "Versión del formulario" }));
  await userEvent.click(await (await openCombo(panel, "Versión del formulario")).findByRole("option", { name: "Versión 3" }));
  expect(apply).toHaveBeenLastCalledWith(expect.objectContaining({ state: "Approved" }), [version3], { [version3]: "Versión 3" });
});

// «Respuesta» is gone (PL2-A): each question keeps only what filters its value.
it("does not offer Respuesta in any question", async () => {
  setup();
  menu(selected);
  const panel = await open();
  for (const name of ["Fallas", "Dosis"]) {
    await userEvent.click(panel.getByRole("button", { name }));
    expect(within(panel.getByRole("region", { name })).queryByText("Respuesta")).not.toBeInTheDocument();
  }
});

it("says how many are applied on its button and marks them in the list", async () => {
  setup();
  menu({ ...selected, conditions: [{ fieldId: failures.fieldId, operator: "anyOf", values: [failures.options[0].id] }], versionIds: ["v2"] });
  expect(screen.getByRole("button", { name: "Filtros 2" })).toBeInTheDocument();
  const panel = await open();
  expect(panel.getByRole("button", { name: "Fallas con filtro" })).toBeInTheDocument();
  expect(panel.getByRole("button", { name: "Recibida" })).toBeInTheDocument();
});

// A typed number applies only when it is valid, a moment after the last key, so the sheet does not read with every letter.
it("applies a typed number only when it is valid", async () => {
  setup();
  const apply = vi.fn();
  menu(selected, apply);
  const panel = await open();
  await userEvent.click(panel.getByRole("button", { name: "Dosis" }));
  await userEvent.type(panel.getByLabelText("Desde"), "12,5x");
  expect(await panel.findByText("Ingresá un número con coma o punto decimal.")).toBeVisible();
  await new Promise(resolve => setTimeout(resolve, 500));
  expect(apply).not.toHaveBeenCalled();
  await userEvent.type(panel.getByLabelText("Desde"), "{Backspace}");
  await waitFor(() => expect(apply).toHaveBeenCalledWith(expect.objectContaining({ conditions: [{ fieldId: dose.fieldId, operator: "gte", values: ["12.5"] }] }), []));
  expect(apply).toHaveBeenCalledOnce();
});

it("takes one filter away with Quitar and the dates of Recibida apply together", async () => {
  setup();
  const apply = vi.fn();
  menu({ ...selected, conditions: [{ fieldId: failures.fieldId, operator: "anyOf", values: [failures.options[0].id] }] }, apply);
  const panel = await open();
  await userEvent.click(panel.getByRole("button", { name: "Fallas con filtro" }));
  await userEvent.click(within(panel.getByRole("region", { name: "Fallas" })).getByRole("button", { name: "Quitar" }));
  expect(apply).toHaveBeenLastCalledWith(expect.objectContaining({ state: "Approved", conditions: [] }), []);
  await userEvent.click(panel.getByRole("button", { name: "Recibida" }));
  fireEvent.change(panel.getByLabelText("Recibida desde"), { target: { value: "2026-10-20" } });
  expect(apply).toHaveBeenLastCalledWith(expect.objectContaining({ receivedFromUtc: "2026-10-20T00:00:00.000Z", receivedToUtc: undefined }), []);
});

// On the phone it takes the screen: first the list and, touching one, its combo, with «‹» to go back and «Listo».
it("on the phone shows the list first, then the combo with a way back, and Listo closes", async () => {
  vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(width < 640px)", media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
  setup();
  menu(selected);
  const panel = await open();
  expect(panel.queryByRole("region")).not.toBeInTheDocument();
  await userEvent.click(panel.getByRole("button", { name: "Fallas" }));
  expect(panel.getByRole("combobox", { name: "Fallas" })).toBeInTheDocument();
  await userEvent.click(panel.getByRole("button", { name: "Volver a los filtros" }));
  expect(panel.getByRole("button", { name: "Dosis" })).toBeInTheDocument();
  await userEvent.click(panel.getByRole("button", { name: "Listo" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Filtros" })).not.toBeInTheDocument());
});

it("exports the same selected state without adding a state facet or another filter shape", async () => {
  setup();
  let body: unknown;
  server.use(http.post("/api/forms/definitions/:id/records/export", async ({ request }) => { body = await request.json(); return new HttpResponse(new Uint8Array([80, 75]), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=visits.xlsx" } }); }));
  function Export() { const cooldown = useCountdown(0); return <ResponseExportDialog formId={responseFormId} prefix="VIS" filter={selected} total={2} ready cooldown={cooldown} columns={[]} visible={[]} filterLabels={["Estado: Aprobada"]} onClose={vi.fn()} onForbidden={vi.fn()}/>; }
  await act(async () => { renderWithProviders(<Export/>); });
  await userEvent.click(await screen.findByRole("button", { name: "Exportar a Excel" }));
  await waitFor(() => expect(savePrivateBlob).toHaveBeenCalledOnce());
  expect(body).toEqual({ filter: selected, columns: null, catalogFields: null });
});

// The export says once what always goes in the (i) next to «Columnas a exportar», and its button waits with «Exportando…».
it("exports without a description, with the fixed columns in the (i) of Columnas a exportar, and says Exportando… while it works", async () => {
  setup();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  server.use(http.post("/api/forms/definitions/:id/records/export", async () => { await gate; return new HttpResponse(new Uint8Array([80, 75]), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=visits.xlsx" } }); }));
  function Export() { const cooldown = useCountdown(0); return <ResponseExportDialog formId={responseFormId} prefix="VIS" filter={selected} total={2} ready cooldown={cooldown} columns={[]} visible={[]} filterLabels={[]} onClose={vi.fn()} onForbidden={vi.fn()}/>; }
  await act(async () => { renderWithProviders(<Export/>); });
  const dialog = await screen.findByRole("dialog", { name: "Exportar respuestas a Excel" });
  expect(dialog).not.toHaveAccessibleDescription();
  const fixed = "Número, recibida, cargó y canal siempre se incluyen. De los archivos se exportan la cantidad y los nombres.";
  expect(screen.getByRole("button", { name: "Más información sobre Columnas a exportar" })).toHaveAccessibleDescription(fixed);
  for (const text of screen.getAllByText(fixed)) expect(text).not.toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Exportar a Excel" }));
  expect(await screen.findByRole("button", { name: "Exportando…" })).toHaveAttribute("aria-busy", "true");
  await act(async () => release());
  await waitFor(() => expect(savePrivateBlob).toHaveBeenCalledOnce());
});
