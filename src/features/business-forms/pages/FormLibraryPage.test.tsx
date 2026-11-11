import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { notify } from "@/shared/ui/notifications";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));

// BI1-A: «Biblioteca» lists the standards and «Agregar» creates an own draft that opens in the editor.
const invoice = { key: "arca.invoice", version: 1, name: "Factura", description: "Factura C con sus ítems y el total.", prefix: "FAC", copies: 1, culture: "es", source: "ARCA" };
const delivery = { key: "test.delivery", version: 2, name: "Remito", description: "Un remito con sus ítems.", prefix: "REM", copies: 0, culture: "es" };
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

  expect(await screen.findByText("Factura")).toBeInTheDocument();
  expect(screen.getByText("Factura C con sus ítems y el total.")).toBeInTheDocument();
  expect(screen.getByText("Versión 1 · ARCA · En 1 formulario")).toBeInTheDocument();
  expect(screen.getByText("Versión 2 · Sin formularios")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Agregar/ })).not.toBeInTheDocument();
});

it("says there are no standards when no installed module brings one", async () => {
  setup(["formtemplates.read"], []);
  renderRouteWithProviders("/formularios/biblioteca");
  expect(await screen.findByText("No hay formularios estándar")).toBeInTheDocument();
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

  await userEvent.click(await screen.findByRole("button", { name: "Agregar «Factura»" }));
  const dialog = await screen.findByRole("dialog", { name: "Agregar «Factura»" });
  expect(within(dialog).getByRole("textbox", { name: /^Prefijo de numeración/ })).toHaveValue("FAC2");
  const name = within(dialog).getByRole("textbox", { name: /^Nombre/ });
  await userEvent.clear(name);
  await userEvent.type(name, "Facturas de servicios");
  await userEvent.click(within(dialog).getByRole("button", { name: "Agregar como borrador" }));

  // The editor is a lazy route: the location changes once its module loads.
  await waitFor(() => expect(router.state.location.pathname).toBe(`/formularios/${created.definition.id}`), { timeout: 20000 });
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({ name: { es: "Facturas de servicios" }, prefix: "FAC2" });
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
