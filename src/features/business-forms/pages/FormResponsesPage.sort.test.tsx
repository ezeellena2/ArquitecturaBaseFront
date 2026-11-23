import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { currentUser } from "@/test/mocks/handlers";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { responseDetailFixture, responseFormId, responseSheetFixture, responseWorkflowFixture } from "@/test/responseFixtures";
import type { ResponseSheet } from "../api/responses";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/hooks/usePrivateFormFile", async () => ({ ...await vi.importActual<typeof import("@/shared/hooks/usePrivateFormFile")>("@/shared/hooks/usePrivateFormFile"),
  savePrivateBlob: vi.fn() }));
// Each test reads the person and the sheet again: the session of another test does not carry its permissions over.
beforeEach(() => { queryClient.clear(); });

// OT1-C (F8): every column of the sheet with one datum orders in the server, from its header and from «Ordenar por». The address
// and every request (the sheet, its navigation and the Excel) carry the server's field and, for a question, a field of its catalog
// or a result, their ids.
const sheetPath = "/formularios/" + responseFormId + "/respuestas";
const term = { fieldId: "01990000-0000-7000-8000-000000000084", key: "days", label: "Plazo", type: "integer" as const, role: "data" as const };
const resultColumns = [
  { id: "arca.invoice.voucher", source: "arca.invoice", sourceName: "Emitir comprobante en ARCA", key: "voucher", label: "Comprobante", kind: "text" as const },
  { id: "arca.invoice.total", source: "arca.invoice", sourceName: "Emitir comprobante en ARCA", key: "total", label: "Total facturado", kind: "amount" as const },
];
/** A sheet with every column that orders: a correction, approval, a response to resolve, a catalog's field and two results. */
function sortSheet(): ResponseSheet {
  const sheet = responseSheetFixture();
  sheet.hasApproval = true;
  const choice = sheet.columns.find(column => column.type === "choice")!;
  choice.fields = [term];
  const [first, second] = sheet.records.items;
  first!.corrected = true;
  second!.hasUnresolvedActions = true;
  first!.cells.find(cell => cell.type === "choice")!.value = { choiceId: "01990000-0000-7000-8000-000000000085", label: "Proveedor Norte",
    catalogId: "01990000-0000-7000-8000-000000000086", fields: [{ fieldId: term.fieldId, label: term.label, type: term.type, role: term.role, value: "30" }] };
  first!.results = { "arca.invoice.voucher": "Factura C 0004-00000012", "arca.invoice.total": "1500.50" };
  return { ...sheet, resultColumns };
}
function setup(sheet: ResponseSheet = sortSheet(), permissions = ["formrecords.read", "formrecords.export"]) {
  const bodies: Record<string, unknown>[] = [];
  const exported: Record<string, unknown>[] = [];
  server.use(http.get("/api/forms/approvals", () => HttpResponse.json({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false })),
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })),
    http.post("/api/forms/definitions/:id/records/search", async ({ request }) => { bodies.push(await request.json() as Record<string, unknown>); return HttpResponse.json(sheet); }),
    http.post("/api/forms/definitions/:id/records/export", async ({ request }) => {
      exported.push(await request.json() as Record<string, unknown>);
      return new HttpResponse(new Uint8Array([80, 75]), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": "attachment; filename*=UTF-8''TEST.xlsx" } });
    }),
    http.get("/api/forms/records/:id/workflow", ({ params }) => HttpResponse.json(responseWorkflowFixture(String(params.id)))),
    http.get("/api/forms/records/:id", ({ params }) => HttpResponse.json(responseDetailFixture(String(params.id)))));
  return { bodies, exported, choice: sheet.columns.find(column => column.fields?.length)?.fieldId };
}
// The first render pays the lazy page: with the machine loaded it takes more than a second.
const sheetTable = () => screen.findByRole("table", undefined, { timeout: 10_000 });
const header = (name: string) => within(screen.getByRole("table")).getByRole("columnheader", { name });
const orderBy = (name: string) => userEvent.click(within(header(name)).getByRole("button", { name }));

it("orders a column from its header in its useful direction, back on the first page and keeping the versions", async () => {
  const { bodies } = setup();
  const version = responseSheetFixture().versions[0]!.id;
  const { router } = renderRouteWithProviders(sheetPath + "?page=2&versionIds=" + version);
  await sheetTable();
  // Without an order chosen, the newest number first: its arrow and «Ordenar por» say so.
  expect(bodies.at(-1)?.sort).toBe("-number");
  expect(header("N°")).toHaveAttribute("aria-sort", "descending");
  expect(screen.getByRole("button", { name: "Ordenar por: N°, de mayor a menor" })).toBeVisible();

  await orderBy("Recibida");
  await waitFor(() => expect(bodies.at(-1)).toMatchObject({ sort: "-submittedAtUtc", page: 1, versionIds: [version] }));
  const params = new URLSearchParams(router.state.location.search);
  expect(params.get("sort")).toBe("-submittedAtUtc");
  expect(params.has("page")).toBe(false);
  expect(params.get("versionIds")).toBe(version);
  expect(header("Recibida")).toHaveAttribute("aria-sort", "descending");
  await orderBy("Recibida");
  await waitFor(() => expect(bodies.at(-1)?.sort).toBe("submittedAtUtc"));
  expect(header("Recibida")).toHaveAttribute("aria-sort", "ascending");
}, 20_000);

it.each([
  ["N°", "number"], ["Corregida", "-corrected"], ["Cargó", "actor"], ["Canal", "channel"], ["Estado", "state"], ["Reglas", "-rules"],
])("orders «%s» by the server field %s", async (name, sort) => {
  const { bodies } = setup();
  renderRouteWithProviders(sheetPath);
  await sheetTable();
  await orderBy(name);
  await waitFor(() => expect(bodies.at(-1)?.sort).toBe(sort));
  expect(bodies.at(-1)).not.toHaveProperty("sortFieldId");
}, 20_000);

it("orders a question, a field of its catalog and a result with their ids, in the address and in the request", async () => {
  const { bodies, choice } = setup();
  const { router } = renderRouteWithProviders(sheetPath);
  await sheetTable();
  const address = () => Object.fromEntries([...new URLSearchParams(router.state.location.search)].filter(([key]) => key.startsWith("sort")));

  await orderBy("Modalidad · Plazo");
  await waitFor(() => expect(bodies.at(-1)).toMatchObject({ sort: "-catalogField", sortFieldId: choice, sortCatalogFieldId: term.fieldId }));
  expect(address()).toEqual({ sort: "-catalogField", sortFieldId: choice, sortCatalogFieldId: term.fieldId });
  expect(header("Modalidad · Plazo")).toHaveAttribute("aria-sort", "descending");

  await orderBy("Comprobante");
  await waitFor(() => expect(bodies.at(-1)).toMatchObject({ sort: "result", sortResultId: "arca.invoice.voucher" }));
  expect(bodies.at(-1)).not.toHaveProperty("sortFieldId");
  expect(address()).toEqual({ sort: "result", sortResultId: "arca.invoice.voucher" });

  await orderBy("Total facturado");
  await waitFor(() => expect(bodies.at(-1)).toMatchObject({ sort: "-result", sortResultId: "arca.invoice.total" }));

  await orderBy("Modalidad");
  await waitFor(() => expect(bodies.at(-1)).toMatchObject({ sort: "field", sortFieldId: choice }));
  expect(bodies.at(-1)).not.toHaveProperty("sortResultId");
  expect(address()).toEqual({ sort: "field", sortFieldId: choice });
}, 20_000);

it("changes the order from «Ordenar por», last in the bar, which moves the arrow of the header", async () => {
  const { bodies } = setup();
  const { router } = renderRouteWithProviders(sheetPath + "?sort=actor");
  await sheetTable();
  expect(bodies.at(-1)?.sort).toBe("actor");
  const trigger = screen.getByRole("button", { name: "Ordenar por: Cargó, de la A a la Z" });
  expect(within(trigger.closest<HTMLElement>('[data-slot="filter-bar"]')!).getAllByRole("button").at(-1)).toBe(trigger);
  act(() => trigger.focus());
  await userEvent.keyboard("{Enter}");
  const menu = await screen.findByRole("menu");
  await userEvent.click(within(menu).getByRole("menuitemradio", { name: "Total facturado" }));
  await waitFor(() => expect(bodies.at(-1)).toMatchObject({ sort: "-result", sortResultId: "arca.invoice.total" }));
  // The list stays open: the table behind it is out of the accessibility tree until it closes.
  await userEvent.click(within(screen.getByRole("menu")).getByRole("menuitemradio", { name: "De menor a mayor" }));
  await waitFor(() => expect(bodies.at(-1)).toMatchObject({ sort: "result", sortResultId: "arca.invoice.total" }));
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  expect(new URLSearchParams(router.state.location.search).get("sortResultId")).toBe("arca.invoice.total");
  expect(header("Total facturado")).toHaveAttribute("aria-sort", "ascending");
  expect(screen.getByRole("button", { name: "Ordenar por: Total facturado, de menor a mayor" })).toHaveFocus();
}, 20_000);

it("does not order a question of several options, the fields of its catalog nor the PDF", async () => {
  const sheet = sortSheet();
  const faults = sheet.columns.find(column => column.type === "choice")!;
  const options = [{ id: "01990000-0000-7000-8000-000000000911", label: "Frío" }, { id: "01990000-0000-7000-8000-000000000912", label: "Ruido" }];
  faults.type = "multiChoice"; faults.label = "Fallas"; faults.options = options;
  for (const row of sheet.records.items) {
    const cell = row.cells.find(item => item.fieldId === faults.fieldId)!;
    cell.type = "multiChoice"; cell.state = "Answered"; cell.value = options.map(option => ({ choiceId: option.id, label: option.label }));
  }
  sheet.records.items[0]!.hasPdf = true;
  setup(sheet);
  renderRouteWithProviders(sheetPath);
  await sheetTable();
  for (const name of ["Fallas", "Fallas · Plazo", "PDF"]) expect(within(header(name)).queryByRole("button")).not.toBeInTheDocument();
  const trigger = screen.getByRole("button", { name: "Ordenar por: N°, de mayor a menor" });
  act(() => trigger.focus());
  await userEvent.keyboard("{Enter}");
  const columns = within(await screen.findByRole("menu")).getAllByRole("menuitemradio").map(item => item.textContent);
  expect(columns).toEqual(expect.arrayContaining(["N°", "Importe", "Comprobante"]));
  expect(columns).not.toEqual(expect.arrayContaining(["Fallas"]));
  expect(columns.filter(name => name === "PDF" || name?.startsWith("Fallas"))).toEqual([]);
}, 20_000);

// A column shown only when the page has one keeps its place while it orders the sheet: ordering «Corregida» with «No» first
// leaves the corrected ones on another page.
it("keeps «Corregida» and «Reglas» in sight while they order the sheet, though the page has none", async () => {
  const sheet = responseSheetFixture();
  setup(sheet);
  const { router } = renderRouteWithProviders(sheetPath + "?sort=corrected");
  await sheetTable();
  expect(header("Corregida")).toHaveAttribute("aria-sort", "ascending");
  await act(async () => { await router.navigate(sheetPath + "?sort=-rules"); });
  await waitFor(() => expect(header("Reglas")).toHaveAttribute("aria-sort", "descending"));
  expect(screen.queryByRole("columnheader", { name: "Corregida" })).not.toBeInTheDocument();
}, 20_000);

it("exports the Excel in the order of the sheet, with the ids of its column", async () => {
  const { exported, choice } = setup();
  renderRouteWithProviders(sheetPath + "?sort=-catalogField&sortFieldId=" + responseSheetFixture().columns.find(column => column.type === "choice")!.fieldId + "&sortCatalogFieldId=" + term.fieldId);
  await sheetTable();
  expect(header("Modalidad · Plazo")).toHaveAttribute("aria-sort", "descending");
  await userEvent.click(screen.getByRole("button", { name: "Exportar a Excel" }));
  const dialog = await screen.findByRole("dialog", { name: "Exportar respuestas a Excel" });
  await userEvent.click(within(dialog).getByRole("button", { name: "Exportar a Excel" }));
  await waitFor(() => expect(exported.at(-1)?.filter).toMatchObject({ sort: "-catalogField", sortFieldId: choice, sortCatalogFieldId: term.fieldId }));
}, 20_000);
