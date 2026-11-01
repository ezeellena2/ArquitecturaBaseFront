import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { savePrivateBlob } from "@/shared/hooks/usePrivateFormFile";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { responseFormId, responseSheetFixture } from "@/test/responseFixtures";
import type { ResponseQuery } from "../responses";
import { ResponseFiltersPanel } from "./ResponseFiltersPanel";
import { ResponseExportDialog } from "./ResponseExportDialog";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/hooks/usePrivateFormFile", async () => ({ ...await vi.importActual<typeof import("@/shared/hooks/usePrivateFormFile")>("@/shared/hooks/usePrivateFormFile"), savePrivateBlob: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); });
function setup() {
  const bodies: ResponseQuery[] = [];
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read"] })),
    http.post("/api/forms/definitions/:id/records/search", async ({ request }) => { bodies.push(await request.json() as ResponseQuery); return HttpResponse.json(responseSheetFixture()); }),
    http.post("/api/forms/definitions/:id/records/filter-counts/search", () => HttpResponse.json({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false })),
  );
  return bodies;
}
const selected: ResponseQuery = { page: 3, pageSize: 20, state: "Approved", search: "visit" };
it("preserves the selected state when the more filters panel counts and applies its draft", async () => {
  const bodies = setup();
  const apply = vi.fn();
  renderWithProviders(<ResponseFiltersPanel formId={responseFormId} query={selected} columns={[]} zone="UTC" onApply={apply} onClose={vi.fn()}/>);
  await waitFor(() => expect(bodies).toContainEqual({ ...selected, page: 1, pageSize: 1, conditions: [] }));
  await userEvent.click(await screen.findByRole("button", { name: /Ver 2 respuestas/ }));
  expect(apply).toHaveBeenCalledWith(expect.objectContaining({ state: "Approved", search: "visit" }), []);
});
it("clears the private state together with the other filters before counting and applying", async () => {
  const bodies = setup();
  const apply = vi.fn();
  renderWithProviders(<ResponseFiltersPanel formId={responseFormId} query={selected} columns={[]} zone="UTC" onApply={apply} onClose={vi.fn()}/>);
  await screen.findByRole("button", { name: /Ver 2 respuestas/ });
  await userEvent.click(screen.getByRole("button", { name: "Limpiar todo" }));
  await waitFor(() => expect(bodies.at(-1)?.state).toBeUndefined());
  await userEvent.click(await screen.findByRole("button", { name: /Ver 2 respuestas/ }));
  expect(apply).toHaveBeenCalledWith(expect.objectContaining({ state: undefined, search: undefined }), []);
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


it("keeps per-option server counts and applies anyOf from More filters", async () => {
  const bodies = setup();
  const column = { fieldId: "01990000-0000-7000-8000-000000000910", type: "multiChoice" as const, label: "Fallas",
    introducedInVersion: 1, options: [{ id: "01990000-0000-7000-8000-000000000911", label: "Frío" }, { id: "01990000-0000-7000-8000-000000000912", label: "Ruido" }] };
  server.use(http.post("/api/forms/definitions/:id/records/filter-counts/search", async ({ request }) => {
    const { fieldId } = await request.json() as { fieldId?: string };
    const items = fieldId === column.fieldId ? column.options.map(option => ({ ...option, count: 2 })) : [];
    return HttpResponse.json({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: items.length ? 1 : 0, hasPrevious: false, hasNext: false });
  }));
  const apply = vi.fn();
  renderWithProviders(<ResponseFiltersPanel formId={responseFormId} query={{ page: 1, pageSize: 20 }} columns={[column]} zone="UTC" onApply={apply} onClose={vi.fn()}/>);
  await userEvent.click(await screen.findByText("Frío", { exact: true }));
  expect(screen.getByRole("checkbox", { name: "Frío" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Ruido" })).toBeEnabled();
  await waitFor(() => expect(bodies.some(body => body.conditions?.some(condition => condition.operator === "anyOf" && condition.values?.[0] === column.options[0]!.id))).toBe(true));
  await userEvent.click(await screen.findByRole("button", { name: /Ver 2 respuestas/ }));
  expect(apply).toHaveBeenCalledWith(expect.objectContaining({ conditions: [{ fieldId: column.fieldId, operator: "anyOf", values: [column.options[0]!.id] }] }), []);
});

// The panel does not explain under its title how the options are counted (decision of 2026-10-31).
it("has no description under its title", async () => {
  setup();
  renderWithProviders(<ResponseFiltersPanel formId={responseFormId} query={selected} columns={[]} zone="UTC" onApply={vi.fn()} onClose={vi.fn()}/>);
  const dialog = await screen.findByRole("dialog", { name: "Más filtros" });
  expect(dialog).not.toHaveAccessibleDescription();
  expect(screen.queryByText(/Las opciones se cuentan/)).not.toBeInTheDocument();
});

// While it counts the draft, Apply says so with its spinner instead of going back to a label that looks ready.
it("says Contando… on Apply while it counts the draft", async () => {
  setup();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  server.use(http.post("/api/forms/definitions/:id/records/search", async () => { await gate; return HttpResponse.json(responseSheetFixture()); }));
  renderWithProviders(<ResponseFiltersPanel formId={responseFormId} query={selected} columns={[]} zone="UTC" onApply={vi.fn()} onClose={vi.fn()}/>);
  expect(await screen.findByRole("button", { name: "Contando…" })).toHaveAttribute("aria-busy", "true");
  await act(async () => release());
  expect(await screen.findByRole("button", { name: /Ver 2 respuestas/ })).toBeEnabled();
});

// A facet that reads again keeps its previous options dimmed and out of reach, with the spinner over them.
it("dims a facet's options while they read again", async () => {
  setup();
  const column = { fieldId: "01990000-0000-7000-8000-000000000910", type: "multiChoice" as const, label: "Fallas",
    introducedInVersion: 1, options: [{ id: "01990000-0000-7000-8000-000000000911", label: "Frío" }, { id: "01990000-0000-7000-8000-000000000912", label: "Ruido" }] };
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  server.use(http.post("/api/forms/definitions/:id/records/filter-counts/search", async ({ request }) => {
    const { fieldId, search } = await request.json() as { fieldId?: string; search?: string };
    if (search) await gate;
    const items = fieldId === column.fieldId ? column.options.map(option => ({ ...option, count: 2 })) : [];
    return HttpResponse.json({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: items.length ? 1 : 0, hasPrevious: false, hasNext: false });
  }));
  renderWithProviders(<ResponseFiltersPanel formId={responseFormId} query={{ page: 1, pageSize: 20 }} columns={[column]} zone="UTC" onApply={vi.fn()} onClose={vi.fn()}/>);
  expect((await screen.findByRole("checkbox", { name: "Frío" })).closest("[inert]")).toBeNull();
  await userEvent.type(screen.getAllByRole("searchbox", { name: "Buscar opciones" })[0], "fr");
  await waitFor(() => expect(screen.getByRole("checkbox", { name: "Frío" }).closest("[inert]")).not.toBeNull());
  expect(screen.getAllByRole("status").some(status => status.textContent === "Cargando…")).toBe(true);
  await act(async () => release());
  await waitFor(() => expect(screen.getByRole("checkbox", { name: "Frío" }).closest("[inert]")).toBeNull());
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
