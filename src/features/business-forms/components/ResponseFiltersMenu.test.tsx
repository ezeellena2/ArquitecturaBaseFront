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
const dose: ResponseColumn = { fieldId: "01990000-0000-7000-8000-000000000920", type: "decimal", label: "Dosis", introducedInVersion: 1, options: [] };
function setup({ gate }: { gate?: Promise<void> } = {}) {
  const counts: unknown[] = [];
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read"] })),
    http.post("/api/forms/definitions/:id/records/filter-counts/search", async ({ request }) => {
      const body = await request.json() as { fieldId?: string; search?: string };
      counts.push(body);
      if (body.search && gate) await gate;
      const items = body.fieldId === failures.fieldId ? failures.options!.map(option => ({ ...option, count: option.label === "Ruido" ? 0 : 2 })) : [];
      return HttpResponse.json({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: items.length ? 1 : 0, hasPrevious: false, hasNext: false });
    }),
  );
  return counts;
}
const selected: ResponseQuery = { page: 3, pageSize: 20, state: "Approved", search: "visit" };
const menu = (query: ResponseQuery, apply = vi.fn()) => renderWithProviders(<ResponseFiltersMenu formId={responseFormId} query={query} columns={[failures, dose]} zone="UTC" onApply={apply}/>);
const open = async () => { await userEvent.click(screen.getByRole("button", { name: /^Filtros/ })); return within(await screen.findByRole("dialog", { name: "Filtros" })); };

// Board PL1-A: the list on the left (Recibida, each question in order, Cargó and Versión) and what is chosen on the right.
it("lists what can be filtered and starts with Recibida, without Apply, Cancelar nor a count", async () => {
  setup();
  menu(selected);
  const panel = await open();
  expect(panel.getAllByRole("button").filter(button => button.closest("ul")).map(button => button.textContent)).toEqual(["Recibida", "Fallas", "Dosis", "Cargó", "Versión del formulario"]);
  expect(panel.getByRole("region", { name: "Recibida" })).toBeInTheDocument();
  expect(panel.queryByRole("button", { name: /^(Aplicar|Cancelar|Ver \d+ respuestas?)$/ })).not.toBeInTheDocument();
  expect(panel.queryByText("Contando…")).not.toBeInTheDocument();
});

// Each change applies at once, as in «Columnas», and keeps the quick filters of the bar.
it("applies a chosen option at once with the server's counts, keeping the quick filters", async () => {
  setup();
  const apply = vi.fn();
  menu(selected, apply);
  const panel = await open();
  await userEvent.click(panel.getByRole("button", { name: "Fallas" }));
  await userEvent.click(await panel.findByRole("checkbox", { name: "Frío" }));
  expect(apply).toHaveBeenCalledWith(expect.objectContaining({ state: "Approved", search: "visit",
    conditions: [{ fieldId: failures.fieldId, operator: "anyOf", values: [failures.options![0].id] }] }), []);
  // An option with zero is off.
  expect(panel.getByRole("checkbox", { name: "Ruido" })).toBeDisabled();
});

it("says how many are applied on its button and marks them in the list", async () => {
  setup();
  menu({ ...selected, conditions: [{ fieldId: failures.fieldId, operator: "anyOf", values: [failures.options![0].id] }], versionIds: ["v2"] });
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
  menu({ ...selected, conditions: [{ fieldId: failures.fieldId, operator: "anyOf", values: [failures.options![0].id] }] }, apply);
  const panel = await open();
  await userEvent.click(panel.getByRole("button", { name: "Fallas con filtro" }));
  await userEvent.click(within(panel.getByRole("region", { name: "Fallas" })).getByRole("button", { name: "Quitar" }));
  expect(apply).toHaveBeenLastCalledWith(expect.objectContaining({ state: "Approved", conditions: [] }), []);
  await userEvent.click(panel.getByRole("button", { name: "Recibida" }));
  fireEvent.change(panel.getByLabelText("Recibida desde"), { target: { value: "2026-10-20" } });
  expect(apply).toHaveBeenLastCalledWith(expect.objectContaining({ receivedFromUtc: "2026-10-20T00:00:00.000Z", receivedToUtc: undefined }), []);
});

// On the phone it takes the screen: first the list and, touching one, its options, with «‹» to go back and «Listo».
it("on the phone shows the list first, then the options with a way back, and Listo closes", async () => {
  vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(width < 640px)", media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
  setup();
  menu(selected);
  const panel = await open();
  expect(panel.queryByRole("region")).not.toBeInTheDocument();
  await userEvent.click(panel.getByRole("button", { name: "Fallas" }));
  expect(await panel.findByRole("checkbox", { name: "Frío" })).toBeInTheDocument();
  await userEvent.click(panel.getByRole("button", { name: "Volver a los filtros" }));
  expect(panel.getByRole("button", { name: "Dosis" })).toBeInTheDocument();
  await userEvent.click(panel.getByRole("button", { name: "Listo" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Filtros" })).not.toBeInTheDocument());
});

// A facet that reads again keeps its previous options dimmed and out of reach, with the spinner over them.
it("dims a facet's options while they read again", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  setup({ gate });
  menu({ page: 1, pageSize: 20 });
  const panel = await open();
  await userEvent.click(panel.getByRole("button", { name: "Fallas" }));
  expect((await panel.findByRole("checkbox", { name: "Frío" })).closest("[inert]")).toBeNull();
  await userEvent.type(panel.getByRole("searchbox", { name: "Buscar opciones" }), "fr");
  await waitFor(() => expect(panel.getByRole("checkbox", { name: "Frío" }).closest("[inert]")).not.toBeNull());
  expect(screen.getAllByRole("status").some(status => status.textContent === "Cargando…")).toBe(true);
  await act(async () => release());
  await waitFor(() => expect(panel.getByRole("checkbox", { name: "Frío" }).closest("[inert]")).toBeNull());
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
