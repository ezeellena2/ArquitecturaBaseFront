import "./BusinessInformationPage";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { currentUser } from "@/test/mocks/handlers";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import type { BusinessInformation, BusinessSaveRequest } from "../api/businessInformation";
import { emptyBusinessDetails } from "../businessDetailsModel";
vi.mock("react-oidc-context", async () => ({ ...(await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context")), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
let current: BusinessInformation;
let writes: BusinessSaveRequest[];
beforeEach(() => {
  queryClient.clear(); writes = [];
  current = { name: "Shop", description: "Repairs", hours: "9–18", location: "Local", services: "", policies: "", faq: "", revision: 1 };
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["ai.business.read", "ai.business.manage"] })),
    http.get("/api/ai/business-information", () => HttpResponse.json(current)),
    http.put("/api/ai/business-information", async ({ request }) => {
      const body = await request.json() as BusinessSaveRequest; writes.push(body);
      current = { ...current, ...body, revision: current.revision + 1 };
      return HttpResponse.json({ requestId: body.requestId, revision: current.revision });
    }));
});
afterEach(() => { queryClient.clear(); toast.dismiss(); vi.restoreAllMocks(); });
const save = () => screen.getByRole("button", { name: "Guardar" });
const field = () => screen.getByRole("textbox", { name: "Nombre del negocio" });
describe("business information editor", () => {
  it("saves only the selected ID and manually entered address, without provider text or supplied URLs", async () => {
    current.details = emptyBusinessDetails("UTC");
    current.details.location = { mode: "local", address: "My address", reference: "", area: "", latitude: null, longitude: null };
    server.use(http.post("/api/ai/business-information/places/search", () => HttpResponse.json({ places: [{ placeId: "ChIJ_example", label: "Provider name and address" }] })));
    renderRouteWithProviders("/configuracion/negocio");
    const search = await screen.findByRole("combobox", { name: "Buscar un lugar" });
    await userEvent.click(search);
    await userEvent.paste("Example clinic City");
    await userEvent.click(await screen.findByRole("option", { name: "Provider name and address" }));
    expect(screen.getByRole("textbox", { name: "Dirección del local" })).toHaveValue("My address");
    expect(writes).toHaveLength(0);
    await userEvent.click(save());
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].details?.location).toEqual({ mode: "local", address: "My address", reference: "", area: "", latitude: null, longitude: null, placeId: "ChIJ_example" });
    expect(JSON.stringify(writes)).not.toContain("Provider name and address");
    expect(writes[0].details?.location).not.toHaveProperty("link");
  });
  it("sends structured facts with one revision and no client supplied link", async () => {
    current.details = emptyBusinessDetails("UTC");
    current.details.location = { mode: "local", address: "Address", reference: "", area: "", latitude: -34.6037, longitude: -58.3816, link: "https://untrusted.invalid/" };
    renderRouteWithProviders("/configuracion/negocio");
    const address = await screen.findByRole("textbox", { name: "Dirección del local" });
    await userEvent.type(address, " Updated");
    expect(screen.getByRole("textbox", { name: "Enlace de la ubicación" })).toHaveValue("");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Lunes · Atención" }), "allDay");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Agregar una pregunta predefinida" }), "booking");
    const answer = screen.getByRole("textbox", { name: "Respuesta del negocio" });
    expect(answer).toHaveValue("");
    await userEvent.type(answer, "Confirmed answer");
    await userEvent.click(save());
    await waitFor(() => expect(save()).toBeDisabled());
    expect(writes).toHaveLength(1);
    expect(writes[0].details?.location).toEqual({ mode: "local", address: "Address Updated", reference: "", area: "", latitude: null, longitude: null });
    expect(writes[0].details?.openingHours.days[0]).toMatchObject({ status: "allDay", periods: [] });
    expect(writes[0].details?.faq[0].answer).toBe("Confirmed answer");
    expect(writes[0].expectedRevision).toBe(1);
    expect(writes[0]).toMatchObject({ hours: "9–18", location: "Local" });
  });
  it("blocks invalid structured hours before making a request", async () => {
    current.details = emptyBusinessDetails("UTC");
    renderRouteWithProviders("/configuracion/negocio");
    await screen.findByRole("textbox", { name: "Nombre del negocio" });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Lunes · Atención" }), "open");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Lunes 1 · Desde" }), "18:00");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Lunes 1 · Hasta" }), "09:00");
    await userEvent.click(save());
    expect(await screen.findByRole("alert")).toHaveTextContent("El cierre debe ser posterior");
    expect(writes).toHaveLength(0);
    expect(screen.getByRole("group", { name: "Horario de atención" })).toHaveFocus();
  });
  it("keeps structured facts frozen when an uncertain save is retried", async () => {
    current.details = emptyBusinessDetails("UTC");
    server.use(http.put("/api/ai/business-information", async ({ request }) => { writes.push(await request.json() as BusinessSaveRequest); return HttpResponse.error(); }),
      http.get("/api/ai/business-information/changes/:id", () => HttpResponse.json({ code: "Ai.BusinessInformation.ChangeNotFound" }, { status: 404 })));
    renderRouteWithProviders("/configuracion/negocio");
    await screen.findByRole("textbox", { name: "Nombre del negocio" });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Lunes · Atención" }), "closed");
    await userEvent.click(save());
    await userEvent.click(await screen.findByRole("button", { name: "Revisar guardado" }));
    expect(screen.getByRole("combobox", { name: "Lunes · Atención" })).toBeDisabled();
    await userEvent.click(await screen.findByRole("button", { name: "Reintentar el mismo guardado" }));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toEqual(writes[0]);
    expect(writes[1].details?.openingHours.days[0].status).toBe("closed");
  });
  it("saves real fields with revision and returns to the saved state", async () => {
    renderRouteWithProviders("/configuracion/negocio");
    await userEvent.type(await screen.findByRole("textbox", { name: "Nombre del negocio" }), " Updated");
    await userEvent.click(save());
    await waitFor(() => expect(writes).toHaveLength(1));
    await waitFor(() => expect(save()).toBeDisabled());
    expect(writes[0]).toMatchObject({ name: "Shop Updated", expectedRevision: 1 });
    expect(writes[0].requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("validates beside the fields without a duplicate operational notice", async () => {
    const notice = vi.spyOn(toast, "error");
    renderRouteWithProviders("/configuracion/negocio");
    await userEvent.clear(await screen.findByRole("textbox", { name: "Nombre del negocio" }));
    await userEvent.click(save());
    expect(await screen.findByText("Ingresá el nombre del negocio.")).toBeInTheDocument();
    expect(field()).toHaveFocus();
    expect(writes).toHaveLength(0);
    expect(notice).not.toHaveBeenCalled();
  });
  it("confirms a lost reply by receipt without repeating the write", async () => {
    let id = "";
    server.use(http.put("/api/ai/business-information", async ({ request }) => {
      const body = await request.json() as BusinessSaveRequest; writes.push(body); id = body.requestId;
      current = { ...current, ...body, revision: 2 }; return HttpResponse.error();
    }), http.get("/api/ai/business-information/changes/:id", () => HttpResponse.json({ requestId: id, revision: 2 })));
    renderRouteWithProviders("/configuracion/negocio");
    await userEvent.type(await screen.findByRole("textbox", { name: "Nombre del negocio" }), " Updated");
    await userEvent.click(save());
    await userEvent.click(await screen.findByRole("button", { name: "Revisar guardado" }));
    await waitFor(() => expect(save()).toBeDisabled());
    expect(writes).toHaveLength(1);
    expect(field()).toHaveValue("Shop Updated");
  });
  it("a missing receipt keeps the draft locked and explicit retry preserves the identical request", async () => {
    server.use(http.put("/api/ai/business-information", async ({ request }) => { writes.push(await request.json() as BusinessSaveRequest); return HttpResponse.error(); }),
      http.get("/api/ai/business-information/changes/:id", () => HttpResponse.json({ code: "Ai.BusinessInformation.ChangeNotFound" }, { status: 404 })));
    renderRouteWithProviders("/configuracion/negocio");
    await userEvent.type(await screen.findByRole("textbox", { name: "Nombre del negocio" }), " Updated");
    await userEvent.click(save());
    await userEvent.click(await screen.findByRole("button", { name: "Revisar guardado" }));
    await userEvent.click(await screen.findByRole("button", { name: "Reintentar el mismo guardado" }));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toEqual(writes[0]);
    expect(field()).toBeDisabled();
    expect(field()).toHaveValue("Shop Updated");
  });
  it("reviews a conflict and merges untouched facts before an explicit new save", async () => {
    server.use(http.put("/api/ai/business-information", async ({ request }) => {
      writes.push(await request.json() as BusinessSaveRequest); current = { ...current, hours: "10–17", revision: 2 };
      return HttpResponse.json({ code: "Ai.BusinessInformation.RevisionConflict" }, { status: 409 });
    }));
    renderRouteWithProviders("/configuracion/negocio");
    await userEvent.type(await screen.findByRole("textbox", { name: "Nombre del negocio" }), " Updated");
    await userEvent.click(save());
    await userEvent.click(await screen.findByRole("button", { name: "Revisar cambios" }));
    await userEvent.click(await screen.findByRole("button", { name: "Conservar mis cambios" }));
    expect(field()).toHaveValue("Shop Updated");
    expect(screen.getByRole("textbox", { name: "Horario de atención" })).toHaveValue("10–17");
    expect(writes).toHaveLength(1);
    expect(save()).toBeEnabled();
  });
  it("read access shows facts without offering edit actions", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["ai.business.read"] })));
    renderRouteWithProviders("/configuracion/negocio");
    expect(await screen.findByRole("textbox", { name: "Nombre del negocio" })).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
  });
  it("a denied route exposes no business content", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["ai.read", "ai.manage"] })));
    renderRouteWithProviders("/configuracion/negocio");
    expect(await screen.findByRole("heading", { name: "No tenés permiso" })).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Shop")).not.toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
  it("discarding edits requires a decision and restores the saved facts", async () => {
    renderRouteWithProviders("/configuracion/negocio");
    await userEvent.type(await screen.findByRole("textbox", { name: "Nombre del negocio" }), " Updated");
    await userEvent.click(screen.getByRole("button", { name: "Descartar" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Descartar" }));
    expect(field()).toHaveValue("Shop");
    expect(writes).toHaveLength(0);
  });
});

