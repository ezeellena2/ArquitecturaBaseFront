import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { notify } from "@/shared/ui/notifications";
import { currentUser } from "@/test/mocks/handlers";
import { responseFormId, responseSheetFixture } from "@/test/responseFixtures";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import type { FormEntry } from "../api/entries";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));

const id = (value: number) => "0199a0c0-0000-7000-8000-" + String(value).padStart(12, "0");
const sheet = "/formularios/" + responseFormId + "/respuestas";
// Synthetic behavior DTO; the bodies exported by the backend qualify the contract in entriesHttpContract.
const entry: FormEntry = { definitionId: responseFormId, versionId: id(402), versionNumber: 2, prefix: "TEST", name: "Formulario publicado", culture: "es",
  submitLabel: "Enviar", maxFileSizeMiB: 25, questions: [
    { fieldId: id(30), type: "decimal", label: "Importe", help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null },
    { fieldId: id(31), type: "longText", label: "Observaciones", help: null, required: false, maxLength: 500, options: null, selection: null, files: null, catalog: null },
  ] };

function setup(permissions = ["formrecords.read", "formrecords.create"]) {
  let searches = 0;
  const sends: FormData[] = [];
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })),
    http.post("/api/forms/definitions/:id/records/search", () => { searches++; return HttpResponse.json(responseSheetFixture()); }),
    http.get("/api/forms/entries/:formId", () => HttpResponse.json(entry)),
    http.post("/api/forms/entries/:formId", async ({ request }) => {
      sends.push(await request.formData());
      return HttpResponse.json({ recordId: id(431), number: "TEST-000003", state: "Received", submittedAtUtc: "2026-10-30T13:05:00Z" });
    }),
  );
  return { searches: () => searches, sends };
}

beforeEach(() => { queryClient.clear(); vi.mocked(notify).mockClear(); });
afterEach(() => vi.restoreAllMocks());

describe("adding a response next to the sheet", () => {
  it("saves from the panel, reads the sheet again and keeps the answers for the next one on request", async () => {
    const { searches, sends } = setup();
    const user = userEvent.setup({ delay: null });
    const { router } = renderRouteWithProviders(sheet);
    await user.click(await screen.findByRole("button", { name: "Agregar respuesta" }));
    expect(router.state.location.pathname).toBe(sheet + "/nueva");
    const panel = await screen.findByRole("region", { name: "Nueva respuesta de Formulario publicado" });
    await user.type(await within(panel).findByLabelText(/^Importe/), "12,5");
    await user.click(within(panel).getByRole("checkbox", { name: "Mantener las respuestas para la siguiente" }));
    const before = searches();
    await user.click(within(panel).getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", message: "Se guardó TEST-000003",
      description: "Formulario publicado · Recibida" })));
    await waitFor(() => expect(searches()).toBeGreaterThan(before));
    expect(JSON.parse(String(sends[0].get("answers")))).toEqual([{ fieldId: id(30), value: "12.5" }]);
    expect(within(panel).getByLabelText(/^Importe/)).toHaveValue("12,5");
    expect(router.state.location.pathname).toBe(sheet + "/nueva");
  });

  it("starts the next response empty when the answers are not kept", async () => {
    setup();
    const user = userEvent.setup({ delay: null });
    renderRouteWithProviders(sheet + "/nueva");
    const panel = await screen.findByRole("region", { name: "Nueva respuesta de Formulario publicado" });
    await user.type(await within(panel).findByLabelText(/^Importe/), "8");
    await user.click(within(panel).getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "success" })));
    expect(within(panel).getByLabelText(/^Importe/)).toHaveValue("");
  });

  it("asks before closing with something loaded, also with Escape", async () => {
    setup();
    const user = userEvent.setup({ delay: null });
    const { router } = renderRouteWithProviders(sheet + "/nueva");
    const panel = await screen.findByRole("region", { name: "Nueva respuesta de Formulario publicado" });
    await user.type(await within(panel).findByLabelText(/^Importe/), "3");
    await user.keyboard("{Escape}");
    const dialog = await screen.findByRole("dialog", { name: "¿Cerrar sin enviar?" });
    await user.click(within(dialog).getByRole("button", { name: "Seguir cargando" }));
    expect(router.state.location.pathname).toBe(sheet + "/nueva");
    await user.click(within(panel).getByRole("button", { name: "Cerrar" }));
    await user.click(within(await screen.findByRole("dialog", { name: "¿Cerrar sin enviar?" })).getByRole("button", { name: "Cerrar sin enviar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe(sheet));
    expect(screen.queryByRole("region", { name: /Nueva respuesta/ })).not.toBeInTheDocument();
  });

  it("takes what was loaded to the full page", async () => {
    setup();
    const user = userEvent.setup({ delay: null });
    const { router } = renderRouteWithProviders(sheet + "/nueva");
    const panel = await screen.findByRole("region", { name: "Nueva respuesta de Formulario publicado" });
    await user.type(await within(panel).findByLabelText(/^Importe/), "7");
    await user.click(within(panel).getByRole("button", { name: "Pantalla completa" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/formularios/" + responseFormId + "/cargar"));
    expect(await screen.findByRole("heading", { name: "Nueva respuesta", level: 1 })).toBeVisible();
    expect(await screen.findByLabelText(/^Importe/)).toHaveValue("7");
    // «Volver» and the breadcrumb lead back to the sheet the panel came from.
    for (const link of screen.getAllByRole("link", { name: "Formulario publicado" })) expect(link).toHaveAttribute("href", sheet);
  });

  it("opens the page on the phone", async () => {
    vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(width < 640px)", media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    setup();
    const user = userEvent.setup({ delay: null });
    const { router } = renderRouteWithProviders(sheet);
    await user.click(await screen.findByRole("button", { name: "Agregar respuesta" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/formularios/" + responseFormId + "/cargar"));
    expect(screen.queryByRole("region", { name: /Nueva respuesta/ })).not.toBeInTheDocument();
  });

  it("sends a link to the panel to the page on the phone, without reading a response called «nueva»", async () => {
    vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(width < 640px)", media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    setup();
    const records: string[] = [];
    server.use(http.get("/api/forms/records/:id", ({ params }) => { records.push(String(params.id)); return HttpResponse.json({ code: "Forms.Record.NotFound" }, { status: 404 }); }));
    const { router } = renderRouteWithProviders(sheet + "/nueva");
    await waitFor(() => expect(router.state.location.pathname).toBe("/formularios/" + responseFormId + "/cargar"));
    expect(await screen.findByRole("heading", { name: "Nueva respuesta", level: 1 })).toBeVisible();
    expect(records).toEqual([]);
  });

  it("does not offer to add a response without «Completar formularios»", async () => {
    setup(["formrecords.read"]);
    renderRouteWithProviders(sheet);
    expect(await screen.findByRole("heading", { name: "Formulario publicado", level: 1 })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Agregar respuesta" })).not.toBeInTheDocument();
  });
});
