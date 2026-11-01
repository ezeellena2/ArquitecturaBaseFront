import * as notifications from "@/shared/ui/notifications";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { http, HttpResponse } from "msw";
import { afterEach, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { server } from "@/test/mocks/server";
import { CatalogQuestionSelector } from "./CatalogQuestionSelector";
import { CatalogQuestionName } from "./CatalogQuestionName";
import { proposalCatalog, proposalActorId } from "@/test/mocks/catalogProposal";

afterEach(() => vi.restoreAllMocks());
const id = "01990000-0000-7000-8000-000000000091";
const scope = { actorId: "author", culture: "es" as const, permissions: ["formcatalogs.read"] };
const row = { valueType: "Text" as const, id, name: "Clientes privados", description: null, origin: "Manual", optionsCount: 2, usageCount: null, state: "Active", stateReason: null, canEdit: false };
const page = { items: [row], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false, filterCounts: { byKind: { all: 1, manual: 1, filters: 0 } } };
const catalog = () => screen.getByRole("combobox", { name: "Catálogo" });

// The same dropdown as a catalog field and a person attribute (2026-10-31): the first catalogs when it opens, of every kind;
// an inactive or unavailable one shows why and cannot be chosen. No select, search, pages, link or notes of its own.
it("is the catalog dropdown, with every kind of catalog and the unusable ones off with their reason", async () => {
  const technicians = "01990000-0000-7000-8000-000000000092", archived = "01990000-0000-7000-8000-000000000093", invalid = "01990000-0000-7000-8000-000000000094";
  server.use(http.get("/api/forms/catalogs", ({ request }) => {
    expect(new URL(request.url).searchParams.has("kind")).toBe(false); expect(new URL(request.url).searchParams.has("state")).toBe(false);
    return HttpResponse.json({ ...page, items: [row, { ...row, id: technicians, name: "Técnicos", origin: "Filters", optionsCount: null }, { ...row, id: archived, name: "Archivados", state: "Inactive" }, { ...row, id: invalid, name: "Responsables", origin: "Filters", optionsCount: null, state: "Unavailable", stateReason: "Forms.Catalog.ContentInvalid" }], totalCount: 4 });
  }));
  const onChange = vi.fn(), user = userEvent.setup();
  renderWithProviders(<MemoryRouter><CatalogQuestionSelector scope={scope} value="" readOnly={false} onChange={onChange} /></MemoryRouter>);
  expect(screen.queryByText("Las opciones se preparan al mandar el formulario.")).not.toBeInTheDocument();
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Ver el catálogo" })).not.toBeInTheDocument();
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  // When the options are prepared is the help of its (i).
  await user.hover(screen.getByRole("button", { name: "Cuándo se arman las opciones" }));
  expect(await screen.findByRole("tooltip")).toHaveTextContent("Las opciones se preparan al mandar el formulario.");
  await user.click(catalog());
  expect(await screen.findByRole("option", { name: "Clientes privados · 2 opciones" })).not.toHaveAttribute("aria-disabled");
  expect(screen.getByRole("option", { name: "Técnicos" })).not.toHaveAttribute("aria-disabled");
  expect(screen.getByRole("option", { name: "Archivados · 2 opciones · Dado de baja" })).toHaveAttribute("aria-disabled", "true");
  expect(screen.getByRole("option", { name: "Responsables · El catálogo tiene una configuración no válida." })).toHaveAttribute("aria-disabled", "true");
  await user.click(screen.getByRole("option", { name: "Archivados · 2 opciones · Dado de baja" }));
  expect(onChange).not.toHaveBeenCalled();
  await user.click(screen.getByRole("option", { name: "Técnicos" }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith(technicians);
});

it("removes catalog names when CatalogsRead is revoked while keeping the selected reference in the caller", async () => {
  let reads = 0; server.use(http.get("/api/forms/catalogs", () => { reads++; return HttpResponse.json(page); }));
  const onChange = vi.fn(); const renderSelector = (permissions: readonly string[]) => <MemoryRouter><CatalogQuestionSelector scope={{ ...scope, permissions }} value={id} readOnly={false} onChange={onChange} /></MemoryRouter>;
  let rendered!: ReturnType<typeof renderWithProviders>;
  await act(async () => { rendered = renderWithProviders(renderSelector(scope.permissions)); });
  await waitFor(() => expect(catalog()).toHaveValue("Clientes privados"));
  await act(async () => { rendered.rerender(renderSelector([])); });
  expect(catalog()).toHaveValue("");
  expect(catalog()).toBeDisabled();
  // Why it is off is its tooltip and description, not a text under it.
  expect(catalog()).toHaveAccessibleDescription("Necesitás permiso para leer catálogos y elegir uno.");
  expect(onChange).not.toHaveBeenCalled(); expect(reads).toBe(1);
});

it("lets a read-only form see the selected catalog without editing or requiring CatalogsManage", async () => {
  server.use(http.get("/api/forms/catalogs", () => HttpResponse.json(page))); const onChange = vi.fn();
  await act(async () => { renderWithProviders(<MemoryRouter><CatalogQuestionSelector scope={scope} value={id} readOnly onChange={onChange} /></MemoryRouter>); });
  await waitFor(() => expect(catalog()).toHaveValue("Clientes privados"));
  expect(catalog()).toBeDisabled();
  expect(screen.queryByRole("link")).not.toBeInTheDocument(); expect(onChange).not.toHaveBeenCalled();
});

it("shows a catalog error under the dropdown and marks it", async () => {
  server.use(http.get("/api/forms/catalogs", () => HttpResponse.json(page)));
  renderWithProviders(<MemoryRouter><CatalogQuestionSelector scope={scope} value={id} readOnly={false} error="Revisá el catálogo." onChange={vi.fn()} /></MemoryRouter>);
  expect(screen.getByRole("alert")).toHaveTextContent("Revisá el catálogo.");
  expect(catalog()).toHaveAttribute("aria-invalid", "true");
  expect(catalog()).toHaveAccessibleDescription("Revisá el catálogo.");
});

it("deduplicates one failed HTTP read observed by two catalog selectors", async () => {
  let reads = 0; server.use(http.get("/api/forms/catalogs", () => { reads++; return HttpResponse.json({ code: "General.Unexpected", title: "Failed read", status: 500 }, { status: 500 }); }));
  const notify = vi.spyOn(notifications, "notify"); const onChange = vi.fn();
  await act(async () => { renderWithProviders(<MemoryRouter><CatalogQuestionSelector scope={scope} value={id} readOnly={false} onChange={onChange} /><CatalogQuestionSelector scope={scope} value={id} readOnly={false} onChange={onChange} /></MemoryRouter>); });
  await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
  expect(reads).toBe(1); expect(new Set(notify.mock.calls.map(([notice]) => notice.id)).size).toBe(1);
  await waitFor(() => expect(document.querySelectorAll("[data-sonner-toast]")).toHaveLength(1));
  expect(onChange).not.toHaveBeenCalled();
});

function pairedSelectors(first: boolean, onChange: (id: string) => void) {
  return <MemoryRouter>{first ? <CatalogQuestionSelector key="first" scope={scope} value={id} readOnly={false} onChange={onChange} /> : null}<CatalogQuestionSelector key="last" scope={scope} value={id} readOnly={false} onChange={onChange} /></MemoryRouter>;
}
it("keeps a shared pending read alive when one selector unmounts", async () => {
  let reads = 0; let requestSignal: AbortSignal | undefined; let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  server.use(http.get("/api/forms/catalogs", async ({ request }) => { reads++; requestSignal = request.signal; await gate; return HttpResponse.json(page); }));
  const onChange = vi.fn(); let rendered!: ReturnType<typeof renderWithProviders>;
  await act(async () => { rendered = renderWithProviders(pairedSelectors(true, onChange)); });
  await waitFor(() => expect(reads).toBe(1));
  await act(async () => { rendered.rerender(pairedSelectors(false, onChange)); });
  const wasAborted = requestSignal?.aborted;
  await act(async () => { release(); });
  expect(wasAborted).toBe(false);
  await waitFor(() => expect(catalog()).toHaveValue("Clientes privados"));
  expect(reads).toBe(1); expect(onChange).not.toHaveBeenCalled();
});

// A failed read says so in the open dropdown, and touching it again reads once more.
it("keeps the shared failure visible until its last selector leaves and reads again from the dropdown", async () => {
  let reads = 0; server.use(http.get("/api/forms/catalogs", () => { reads++; return HttpResponse.json({ code: "General.Unexpected", status: 500 }, { status: 500 }); }));
  const notify = vi.spyOn(notifications, "notify"); const dismiss = vi.spyOn(notifications, "dismissNotification"); const onChange = vi.fn(), user = userEvent.setup();
  let rendered!: ReturnType<typeof renderWithProviders>;
  await act(async () => { rendered = renderWithProviders(pairedSelectors(true, onChange)); });
  await waitFor(() => expect(notify).toHaveBeenCalled()); const noticeId = notify.mock.calls[0]![0].id; dismiss.mockClear();
  await act(async () => { rendered.rerender(pairedSelectors(false, onChange)); });
  expect(dismiss).not.toHaveBeenCalledWith(noticeId);
  expect(reads).toBe(1);
  await user.click(catalog());
  expect(await screen.findByRole("listbox", { name: "Catálogo" })).toHaveTextContent(/^Ocurrió un error inesperado/);
  await waitFor(() => expect(reads).toBe(2));
  expect(onChange).not.toHaveBeenCalled();
  await act(async () => { rendered.unmount(); });
  expect(dismiss).toHaveBeenCalledWith(noticeId);
});

it("distinguishes an empty catalog list from a search with no matches in the open dropdown", async () => {
  server.use(http.get("/api/forms/catalogs", () => HttpResponse.json({ ...page, items: [], totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false })));
  const user = userEvent.setup();
  renderWithProviders(<MemoryRouter><CatalogQuestionSelector scope={scope} value="" readOnly={false} onChange={vi.fn()} /></MemoryRouter>);
  await user.click(catalog());
  expect(await screen.findByText("Todavía no hay catálogos disponibles.")).toBeInTheDocument();
  await user.type(catalog(), "inexistente");
  expect(await screen.findByText("No hay catálogos que coincidan con la búsqueda.")).toBeInTheDocument();
});

it("keeps a selected catalog outside the first ones by its name and filters from the first page while typing", async () => {
  const reads: URLSearchParams[] = [], user = userEvent.setup(); let details = 0;
  const value = proposalCatalog(), other = "01990000-0000-7000-8000-000000000095";
  const selected = { ...value, isActive: true, revision: 2, name: { es: "Clientes privados" }, proposal: { ...value.proposal, state: "Approved", decidedBy: { userId: proposalActorId, displayName: "Ana" }, decidedAtUtc: "2026-10-17T13:00:00Z" } };
  server.use(http.get("/api/forms/catalogs", ({ request }) => { const params = new URL(request.url).searchParams; reads.push(params); return HttpResponse.json({ ...page, items: [{ ...row, id: other, name: "Zonas" }], totalCount: 21, totalPages: 2, hasNext: true }); }),
    http.get("/api/forms/catalogs/" + value.id, () => { details++; return HttpResponse.json(selected); }));
  const onChange = vi.fn();
  renderWithProviders(<MemoryRouter><CatalogQuestionSelector scope={scope} value={value.id} readOnly={false} onChange={onChange} /></MemoryRouter>);
  await waitFor(() => expect(catalog()).toHaveValue("Clientes privados"));
  expect(details).toBe(1);
  // Emptying the text is not choosing «no catalog»: the question keeps its catalog.
  await user.clear(catalog());
  await user.type(catalog(), "Zon");
  await waitFor(() => expect(reads.some(query => query.get("search") === "Zon" && query.get("page") === "1")).toBe(true));
  expect(onChange).not.toHaveBeenCalled();
  await user.click(await screen.findByRole("option", { name: "Zonas · 2 opciones" }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith(other);
});

it("uses the original name of an approved monolingual catalog outside the current page, without its description", async () => {
  const value = proposalCatalog();
  const approved = { ...value, isActive: true, revision: 2, proposal: { ...value.proposal, state: "Approved", decidedBy: { userId: proposalActorId, displayName: "Ana" }, decidedAtUtc: "2026-10-17T13:00:00Z" } };
  server.use(http.get("/api/forms/catalogs", () => HttpResponse.json({ ...page, items: [], totalCount: 0, totalPages: 0 })), http.get("/api/forms/catalogs/" + value.id, () => HttpResponse.json(approved)));
  await act(async () => { renderWithProviders(<MemoryRouter><CatalogQuestionSelector scope={{ ...scope, culture: "en" }} value={value.id} readOnly onChange={() => {}} /><CatalogQuestionName id={value.id} scope={{ ...scope, culture: "en" }} /></MemoryRouter>); });
  await waitFor(() => expect(catalog()).toHaveValue("Supervisores activos"));
  expect(screen.getByText("· Supervisores activos")).toBeInTheDocument();
  expect(catalog()).not.toHaveAccessibleDescription();
  expect(screen.queryByText("Supervisores disponibles")).not.toBeInTheDocument();
});

it("lists each catalog with its active options without reading its items", async () => {
  const user = userEvent.setup(); let itemReads = 0;
  server.use(http.get("/api/forms/catalogs", () => HttpResponse.json({ ...page, items: [{ ...row, valueType: "Decimal" }] })), http.get("/api/forms/catalogs/:id/items", () => { itemReads++; return HttpResponse.json({}); }));
  renderWithProviders(<MemoryRouter><CatalogQuestionSelector scope={scope} value="" readOnly={false} onChange={() => undefined}/></MemoryRouter>);
  await user.click(catalog());
  expect(await screen.findByRole("option", { name: "Clientes privados · 2 opciones" })).toBeInTheDocument();
  expect(itemReads).toBe(0);
});
