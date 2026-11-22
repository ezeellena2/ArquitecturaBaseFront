import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { notify } from "@/shared/ui/notifications";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { cellUnder } from "@/test/utils/tableCells";
import { transferReceiptStandard, upcomingStandards } from "@/test/visual/documentReadingFixtures";

// Opening the editor passes the 5 s while other suites run at the same time.
vi.setConfig({ testTimeout: 15_000 });

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));

// BI1-A: «Biblioteca» lists the standards and «Agregar» creates an own draft that opens in the editor. The prefix it offers is the
// server's, which knows the prefixes in use («FAC3», although one copy would give «FAC2»).
const invoice = { key: "arca.invoice", version: 1, name: "Factura", description: "Factura C con sus ítems y el total.", prefix: "FAC", copies: 1, culture: "es", source: "ARCA", suggestedPrefix: "FAC3" };
const delivery = { key: "test.delivery", version: 2, name: "Remito", description: "Un remito con sus ítems.", prefix: "REM", copies: 0, culture: "es", suggestedPrefix: "REM" };
const created = httpCohort("forms").json("published/created.json") as { definition: { id: string } };

const sales = "0196f2a0-0000-7000-8000-0000000000f1";
const north = "0196f2a0-0000-7000-8000-0000000000f2";
const folders = [
  { id: sales, parentId: null, name: "Ventas", revision: 1, icon: "folder" },
  { id: north, parentId: sales, name: "Norte", revision: 1, icon: null },
];

function setup(permissions: string[], standards: unknown[] = [invoice, delivery]) {
  server.use(
    http.get("/api/forms/library", () => HttpResponse.json({ standards })),
    http.get("/api/forms/folders", () => HttpResponse.json({ folders, canManage: false })),
    http.get("/api/me", () => HttpResponse.json({ id: "actor", displayName: "Ana", email: "ana@example.com", emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false, culture: "es", timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [], permissions })),
    http.get("/api/forms/definitions/:id", () => new HttpResponse(null, { status: 404 })));
}

beforeEach(() => { queryClient.clear(); vi.mocked(notify).mockClear(); });

it("lists each standard with its version, module and copies, and offers «Agregar» only to whoever manages forms", async () => {
  setup(["formtemplates.read"]);
  renderRouteWithProviders("/formularios/biblioteca");

  // The first render pays the lazy page: with the machine loaded it takes more than a second.
  expect(await screen.findByText("Factura", {}, { timeout: 10_000 })).toBeInTheDocument();
  expect(screen.getByText("Factura C con sus ítems y el total.")).toBeInTheDocument();
  // One piece of data per column (UD1): the version, the module that brings it and how many of your forms came from it. A column
  // no standard has (what it reads and validates, DOC1) is not shown full of «—», and without upcoming standards there is no state
  // to say nor anything to filter.
  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Estándar", "Versión", "Origen", "En tus formularios"]);
  const [first, second] = within(table).getAllByRole("row").slice(1);
  expect(cellUnder(table, first!, "Versión")).toHaveTextContent(/^1$/);
  expect(cellUnder(table, first!, "Origen")).toHaveTextContent(/^ARCA$/);
  expect(cellUnder(table, first!, "En tus formularios")).toHaveTextContent(/^1$/);
  expect(cellUnder(table, second!, "Origen")).toHaveTextContent(/^—$/);
  expect(cellUnder(table, second!, "En tus formularios")).toHaveTextContent(/^0$/);
  expect(screen.queryByRole("button", { name: /^Estado / })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Agregar/ })).not.toBeInTheDocument();
});

it("shows every standard for a shared «Próximamente» when none is coming", async () => {
  setup(["formtemplates.read"]);
  renderRouteWithProviders("/formularios/biblioteca?availability=Upcoming");
  expect(await screen.findByText("Factura", {}, { timeout: 10_000 })).toBeInTheDocument();
  expect(screen.getAllByRole("row")).toHaveLength(3);
});

it("says there are no standards when no installed module brings one, with the title only", async () => {
  setup(["formtemplates.read"], []);
  renderRouteWithProviders("/formularios/biblioteca");
  expect(await screen.findByText("No hay formularios estándar")).toBeInTheDocument();
  expect(screen.queryByText("Ningún módulo instalado trae formularios estándar.")).not.toBeInTheDocument();
});

// The (i) invites to add one only whoever can (premise 4.4): whoever only reads learns what the library is.
it("invites to add a standard in its (i) only whoever manages forms", async () => {
  setup(["formtemplates.read"]);
  const { unmount } = renderRouteWithProviders("/formularios/biblioteca");
  await screen.findByText("Factura");
  await userEvent.hover(screen.getByRole("button", { name: "Más información sobre Biblioteca" }));
  expect(await screen.findByRole("tooltip")).toHaveTextContent("Formularios listos que traen los módulos instalados, con las preguntas que necesitan.");
  expect(screen.getByRole("tooltip")).not.toHaveTextContent("Agregá uno");
  unmount();
  queryClient.clear();
  setup(["formtemplates.read", "formtemplates.manage"]);
  renderRouteWithProviders("/formularios/biblioteca");
  await screen.findByText("Factura");
  await userEvent.hover(screen.getByRole("button", { name: "Más información sobre Biblioteca" }));
  expect(await screen.findByRole("tooltip")).toHaveTextContent("Agregá uno y queda como un formulario tuyo");
});

// A failure is said once by the common notice; the table keeps «Reintentar», which waits what the server asks after a 429.
it("leaves a failure to the common notice and waits the 429 before «Reintentar»", async () => {
  setup(["formtemplates.read"]);
  server.use(http.get("/api/forms/library", () => HttpResponse.json({ title: "Too many requests", status: 429, code: "RateLimit", retryAfter: 30 }, { status: 429, headers: { "Retry-After": "30" } })));
  renderRouteWithProviders("/formularios/biblioteca");
  expect(await screen.findByText("No pudimos cargar la biblioteca.")).toBeInTheDocument();
  const retry = screen.getByRole("button", { name: "Reintentar" });
  expect(retry).toHaveAttribute("aria-disabled", "true");
  expect(retry).toHaveAccessibleDescription(/Reintentá en (29|30) s/);
  await waitFor(() => expect(vi.mocked(notify)).toHaveBeenCalled());
});

it("needs «Diseñar formularios» to see the library", async () => {
  setup(["formrecords.read"]);
  renderRouteWithProviders("/formularios/biblioteca");
  expect(await screen.findByText(/No tenés permiso/)).toBeInTheDocument();
});

it("adds a copy with the name under the standard's language and a free prefix, and opens it in the editor", async () => {
  setup(["formtemplates.read", "formtemplates.manage"]);
  const bodies: Record<string, unknown>[] = [];
  server.use(http.post("/api/forms/library/:key/copies", async ({ request }) => { bodies.push(await request.json() as Record<string, unknown>); return HttpResponse.json(created, { status: 201 }); }));
  const { router } = renderRouteWithProviders("/formularios/biblioteca");

  expect(await screen.findByRole("columnheader", { name: "Acciones" })).toBeInTheDocument();
  const add = await screen.findByRole("button", { name: "Agregar «Factura»" });
  // A table row carries no text buttons: adding is an icon with its name in the tooltip.
  expect(add).toHaveTextContent(/^$/);
  await userEvent.click(add);
  const dialog = await screen.findByRole("dialog", { name: "Agregar «Factura»" });
  expect(within(dialog).getByRole("textbox", { name: /^Prefijo de numeración/ })).toHaveValue("FAC3");
  const name = within(dialog).getByRole("textbox", { name: /^Nombre/ });
  await userEvent.clear(name);
  await userEvent.type(name, "Facturas de servicios");
  await userEvent.click(within(dialog).getByRole("button", { name: "Agregar como borrador" }));

  // The editor is a lazy route: the location changes once its module loads.
  await waitFor(() => expect(router.state.location.pathname).toBe(`/formularios/${created.definition.id}`), { timeout: 20000 });
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({ name: { es: "Facturas de servicios" }, prefix: "FAC3" });
  expect(bodies[0]).not.toHaveProperty("folderId");
  expect(vi.mocked(notify).mock.calls.filter(([notice]) => notice.kind === "success")).toHaveLength(1);
});

it("shows a taken prefix beside the field and repeats the same request when trying again", async () => {
  setup(["formtemplates.read", "formtemplates.manage"]);
  const requestIds: unknown[] = [];
  server.use(http.post("/api/forms/library/:key/copies", async ({ request }) => {
    const body = await request.json() as Record<string, unknown>; requestIds.push(body.requestId);
    return requestIds.length === 1
      ? HttpResponse.json({ title: "Validación", status: 400, code: "Validation.Failed", errors: { prefix: ["Ese prefijo ya lo usa otro formulario."] } }, { status: 400 })
      : HttpResponse.json(created, { status: 201 });
  }));
  renderRouteWithProviders("/formularios/biblioteca");

  await userEvent.click(await screen.findByRole("button", { name: "Agregar «Remito»" }));
  const dialog = await screen.findByRole("dialog", { name: "Agregar «Remito»" });
  expect(within(dialog).getByRole("textbox", { name: /^Prefijo de numeración/ })).toHaveValue("REM");
  await userEvent.click(within(dialog).getByRole("button", { name: "Agregar como borrador" }));
  expect(await within(dialog).findByText("Ese prefijo ya lo usa otro formulario.")).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "Agregar como borrador" }));

  await waitFor(() => expect(requestIds).toHaveLength(2));
  expect(requestIds[1]).toBe(requestIds[0]);
});

// While it adds, the button waits and the × says why it does not close (premise 5.6); a folder that is gone leaves the list.
it("waits while adding with the reason on the ×, and takes out of the list a folder that is gone", async () => {
  setup(["formtemplates.read", "formtemplates.manage"]);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let trees = 0;
  server.use(
    http.get("/api/forms/folders", () => { trees++; return HttpResponse.json({ folders: trees > 1 ? folders.slice(0, 1) : folders, canManage: false }); }),
    http.post("/api/forms/library/:key/copies", async () => { await held; return HttpResponse.json({ title: "Not found", status: 404, code: "Forms.Folder.NotFound" }, { status: 404 }); }));
  renderRouteWithProviders("/formularios/biblioteca");

  await userEvent.click(await screen.findByRole("button", { name: "Agregar «Remito»" }));
  const dialog = await screen.findByRole("dialog", { name: "Agregar «Remito»" });
  const folder = await within(dialog).findByRole("button", { name: /^Carpeta / });
  await pick(folder, /Norte$/);
  await userEvent.click(within(dialog).getByRole("button", { name: "Agregar como borrador" }));
  const close = await within(dialog).findByRole("button", { name: "Cerrar" });
  expect(close).toHaveAttribute("aria-disabled", "true");
  expect(close).toHaveAccessibleDescription("Esperá a que termine de agregarse.");
  release();

  expect(await within(dialog).findByText("La carpeta elegida ya no existe. Elegí otra.")).toBeInTheDocument();
  expect(folder).toHaveAccessibleName("Carpeta La del estándar");
  const listed = await openList(folder);
  await waitFor(() => expect(within(listed).getAllByRole("option").map(option => option.textContent?.trim())).toEqual(["La del estándar", "Ventas"]));
  await userEvent.keyboard("{Escape}");
});

it("adds the copy to the folder chosen, the standard's when none is", async () => {
  setup(["formtemplates.read", "formtemplates.manage"]);
  const bodies: Record<string, unknown>[] = [];
  server.use(http.post("/api/forms/library/:key/copies", async ({ request }) => { bodies.push(await request.json() as Record<string, unknown>); return HttpResponse.json(created, { status: 201 }); }));
  const { router } = renderRouteWithProviders("/formularios/biblioteca");

  await userEvent.click(await screen.findByRole("button", { name: "Agregar «Remito»" }));
  const dialog = await screen.findByRole("dialog", { name: "Agregar «Remito»" });
  const folder = await within(dialog).findByRole("button", { name: /^Carpeta / });
  expect(folder).toHaveAccessibleName("Carpeta La del estándar");
  // Each folder says where it lives (premise 5.3): two folders with the same name read differently.
  const listed = await openList(folder);
  expect(within(listed).getAllByRole("option").map(option => option.textContent?.trim())).toEqual(["La del estándar", "Ventas", "Ventas / Norte"]);
  await userEvent.click(within(listed).getByRole("option", { name: "Ventas / Norte" }));
  await userEvent.click(within(dialog).getByRole("button", { name: "Agregar como borrador" }));

  await waitFor(() => expect(bodies).toHaveLength(1));
  expect(bodies[0]).toMatchObject({ folderId: north });
  await waitFor(() => expect(router.state.location.pathname).toBe(`/formularios/${created.definition.id}`), { timeout: 20000 });
});

// DOC1: a standard that reads documents says what it reads and what it validates without AI; the standards of the next stages are rows
// without an action. The search and the state («Todos», «Disponibles», «Próximamente») go in the address: they are not private.
describe("the library with the reading of documents (DOC1)", () => {
  const documents = () => { setup(["formtemplates.read", "formtemplates.manage"]); server.use(http.get("/api/forms/library", () => HttpResponse.json({ standards: [transferReceiptStandard("es"), invoice], upcoming: upcomingStandards("es") }))); };

  it("says what a standard reads and validates and how many of your forms came from it, and lists the upcoming ones without «Agregar»", async () => {
    documents();
    renderRouteWithProviders("/formularios/biblioteca");
    const receipt = (await screen.findByText("Comprobante de transferencia", {}, { timeout: 10_000 })).closest("tr")!;
    const table = screen.getByRole("table");
    expect(cellUnder(table, receipt, "Qué lee")).toHaveTextContent(/^Banco o billetera de origen, Cuenta de origen, .*, Número de operación y Concepto$/);
    expect(cellUnder(table, receipt, "Validaciones fijas")).toHaveTextContent(/^Cuenta de origen, CUIT o CUIL de origen, Cuenta de destino y CUIT o CUIL de destino$/);
    expect(cellUnder(table, receipt, "En tus formularios")).toHaveTextContent(/^2$/);
    expect(within(receipt).getByRole("button", { name: "Agregar «Comprobante de transferencia»" })).toBeInTheDocument();
    const remito = screen.getByText("Remito").closest("tr")!;
    expect(cellUnder(table, remito, "Estado")).toHaveTextContent(/^Próximamente$/);
    expect(cellUnder(table, remito, "Versión")).toHaveTextContent(/^—$/);
    expect(within(remito).queryByRole("button")).not.toBeInTheDocument();
    // The (i) says that the validations do not depend on the AI.
    await userEvent.hover(screen.getByRole("button", { name: "Más información sobre Biblioteca" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("cuáles validan sin IA, con sus dígitos verificadores");
  });

  it("searches by name without accents and filters what is available or coming soon, in the address", async () => {
    documents();
    const { router } = renderRouteWithProviders("/formularios/biblioteca");
    // The state is the button of the bar of the piece to choose (2026-11-22): «Todos» first and apart, without counts (FO1-A).
    const states = await openList(await screen.findByRole("button", { name: "Estado Todos" }, { timeout: 10_000 }));
    expect(within(states).getAllByRole("option").map(option => option.textContent)).toEqual(["Todos", "Disponibles", "Próximamente"]);
    expect(within(states).getByRole("option", { name: "Todos" })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Escape}");
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar por nombre" }), "credito");
    await waitFor(() => expect(router.state.location.search).toBe("?search=credito"));
    await waitFor(() => expect(screen.getAllByRole("row").slice(1).map(row => (row as HTMLTableRowElement).cells[0]?.textContent?.split("Lee")[0])).toEqual(["Nota de crédito o débito"]));

    await pick("Estado Todos", "Disponibles");
    await waitFor(() => expect(router.state.location.search).toBe("?search=credito&availability=Available"));
    expect(screen.getByText("No hay estándares que coincidan.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    await waitFor(() => expect(router.state.location.search).toBe(""));

    // Only the upcoming ones: their name and what they are, without columns of «—», without «Estado» and without «Acciones».
    await pick("Estado Todos", "Próximamente");
    await waitFor(() => expect(router.state.location.search).toBe("?availability=Upcoming"));
    expect(within(screen.getByRole("table")).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Estándar"]);
    expect(screen.getAllByRole("row")).toHaveLength(12);
    expect(screen.queryByRole("button", { name: /^Agregar «/ })).not.toBeInTheDocument();
  });

  it("opens with the search and the filter of a shared address", async () => {
    documents();
    renderRouteWithProviders("/formularios/biblioteca?search=comprobante&availability=Available");
    expect(await screen.findByText("Comprobante de transferencia", {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByRole("searchbox", { name: "Buscar por nombre" })).toHaveValue("comprobante");
    expect(screen.getByRole("button", { name: "Estado Disponibles" })).toBeInTheDocument();
  });
});

// The Picker opens with the keyboard, like the other Radix lists in the tests; its button says the label and the chosen one.
async function openList(trigger: string | RegExp | HTMLElement) {
  const button = trigger instanceof HTMLElement ? trigger : screen.getByRole("button", { name: trigger });
  await act(async () => { button.focus(); });
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("listbox");
}
async function pick(trigger: string | RegExp | HTMLElement, option: string | RegExp) {
  await userEvent.click(within(await openList(trigger)).getByRole("option", { name: option }));
}
