import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { notify } from "@/shared/ui/notifications";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { cellUnder } from "@/test/utils/tableCells";

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
  { id: sales, parentId: null, name: "Ventas", revision: 1, menuPlacement: "None", menuIcon: null },
  { id: north, parentId: sales, name: "Norte", revision: 1, menuPlacement: "None", menuIcon: null },
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
  // One piece of data per column (UD1): the version, the module that brings it and how many forms came from it.
  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Estándar", "Versión", "Origen", "Formularios"]);
  const [first, second] = within(table).getAllByRole("row").slice(1);
  expect(cellUnder(table, first!, "Versión")).toHaveTextContent(/^1$/);
  expect(cellUnder(table, first!, "Origen")).toHaveTextContent(/^ARCA$/);
  expect(cellUnder(table, first!, "Formularios")).toHaveTextContent(/^1$/);
  expect(cellUnder(table, second!, "Origen")).toHaveTextContent(/^—$/);
  expect(cellUnder(table, second!, "Formularios")).toHaveTextContent(/^0$/);
  expect(screen.queryByRole("button", { name: /Agregar/ })).not.toBeInTheDocument();
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
  await userEvent.click(await screen.findByRole("button", { name: "Agregar «Factura»" }));
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

it("adds the copy to the folder chosen, the standard's when none is", async () => {
  setup(["formtemplates.read", "formtemplates.manage"]);
  const bodies: Record<string, unknown>[] = [];
  server.use(http.post("/api/forms/library/:key/copies", async ({ request }) => { bodies.push(await request.json() as Record<string, unknown>); return HttpResponse.json(created, { status: 201 }); }));
  const { router } = renderRouteWithProviders("/formularios/biblioteca");

  await userEvent.click(await screen.findByRole("button", { name: "Agregar «Remito»" }));
  const dialog = await screen.findByRole("dialog", { name: "Agregar «Remito»" });
  const folder = await within(dialog).findByRole("combobox", { name: /^Carpeta/ });
  expect(folder).toHaveValue("");
  expect(within(folder).getAllByRole("option").map(option => option.textContent?.trim())).toEqual(["La del estándar", "Ventas", "Norte"]);
  await userEvent.selectOptions(folder, north);
  await userEvent.click(within(dialog).getByRole("button", { name: "Agregar como borrador" }));

  await waitFor(() => expect(bodies).toHaveLength(1));
  expect(bodies[0]).toMatchObject({ folderId: north });
  await waitFor(() => expect(router.state.location.pathname).toBe(`/formularios/${created.definition.id}`), { timeout: 20000 });
});
