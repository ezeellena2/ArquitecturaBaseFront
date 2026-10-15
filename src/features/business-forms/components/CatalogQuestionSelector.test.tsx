import * as notifications from "@/shared/ui/notifications";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { http, HttpResponse } from "msw";
import { afterEach, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { server } from "@/test/mocks/server";
import { CatalogQuestionSelector } from "./CatalogQuestionSelector";

afterEach(() => vi.restoreAllMocks());
const id = "01990000-0000-7000-8000-000000000091";
const scope = { actorId: "author", culture: "es" as const, permissions: ["formcatalogs.read"] };
const page = { items: [{ id, name: "Clientes privados", description: null, origin: "Manual", optionsCount: 2, usageCount: null, state: "Active", stateReason: null, canEdit: false }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false, filterCounts: { byKind: { all: 1, manual: 1, filters: 0 } } };
it("removes catalog names when CatalogsRead is revoked while keeping the selected reference in the caller", async () => {
  let reads = 0; server.use(http.get("/api/forms/catalogs", () => { reads++; return HttpResponse.json(page); }));
  const onChange = vi.fn(); const renderSelector = (permissions: readonly string[]) => <MemoryRouter><CatalogQuestionSelector scope={{ ...scope, permissions }} value={id} readOnly={false} onChange={onChange} /></MemoryRouter>;
  let rendered!: ReturnType<typeof renderWithProviders>;
  await act(async () => { rendered = renderWithProviders(renderSelector(scope.permissions)); });
  await screen.findByRole("option", { name: /Clientes privados/ });
  await act(async () => { rendered.rerender(renderSelector([])); });
  expect(screen.queryByRole("option", { name: /Clientes privados/ })).not.toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Catálogo" })).toBeDisabled(); expect(onChange).not.toHaveBeenCalled(); expect(reads).toBe(1);
});
it("lets a read-only form inspect the selected catalog without editing or requiring CatalogsManage", async () => {
  server.use(http.get("/api/forms/catalogs", () => HttpResponse.json(page))); const onChange = vi.fn();
  await act(async () => { renderWithProviders(<MemoryRouter><CatalogQuestionSelector scope={scope} value={id} readOnly onChange={onChange} /></MemoryRouter>); });
  await screen.findByRole("option", { name: /Clientes privados/ });
  expect(screen.getByRole("combobox", { name: "Catálogo" })).toBeDisabled();
  expect(screen.getByRole("link", { name: "Ver el catálogo" })).toHaveAttribute("href", "/catalogos/" + id);
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument(); expect(onChange).not.toHaveBeenCalled();
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
  await screen.findByRole("option", { name: /Clientes privados/ });
  expect(reads).toBe(1); expect(onChange).not.toHaveBeenCalled();
});
it("keeps the shared failure and recovery visible until its last selector leaves", async () => {
  let reads = 0; server.use(http.get("/api/forms/catalogs", () => { reads++; return HttpResponse.json({ code: "General.Unexpected", status: 500 }, { status: 500 }); }));
  const notify = vi.spyOn(notifications, "notify"); const dismiss = vi.spyOn(notifications, "dismissNotification"); const onChange = vi.fn();
  let rendered!: ReturnType<typeof renderWithProviders>;
  await act(async () => { rendered = renderWithProviders(pairedSelectors(true, onChange)); });
  await waitFor(() => expect(notify).toHaveBeenCalled()); const noticeId = notify.mock.calls[0]![0].id; dismiss.mockClear();
  await act(async () => { rendered.rerender(pairedSelectors(false, onChange)); });
  expect(dismiss).not.toHaveBeenCalledWith(noticeId);
  expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  expect(reads).toBe(1); expect(onChange).not.toHaveBeenCalled();
  await act(async () => { rendered.unmount(); });
  expect(dismiss).toHaveBeenCalledWith(noticeId);
});

it("distinguishes an empty catalog list from a search with no matches",async()=>{
 server.use(http.get("/api/forms/catalogs",()=>HttpResponse.json({...page,items:[],totalCount:0,totalPages:0,hasPrevious:false,hasNext:false})));
 renderWithProviders(<MemoryRouter><CatalogQuestionSelector scope={scope} value="" readOnly={false} onChange={vi.fn()}/></MemoryRouter>);
 await screen.findByRole("searchbox");
 fireEvent.change(screen.getByRole("searchbox"),{target:{value:"inexistente"}});
 expect(await screen.findByText("No hay catálogos que coincidan con la búsqueda.")).toBeInTheDocument();
});
