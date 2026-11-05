import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { queryClient } from "@/shared/api/queryClient";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import type { ArcaCertificate, ArcaConnection, ArcaTest, StartArcaRequest } from "../connection/api";

vi.mock("react-oidc-context", async () => ({ ...(await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context")), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }));

const registry = "ws_sr_constancia_inscripcion";
const invoicing = "wsfe";
const day = 24 * 60 * 60 * 1000;
const none: ArcaConnection = {
  status: null, mode: null, environment: null, cuit: null, enabledServices: [], certificates: [], lastTestPassed: null, lastTestedAtUtc: null, revision: 0,
  installedServices: [{ code: registry, family: "Registry", required: true }, { code: invoicing, family: "Invoicing", required: false }],
};
const pendingRequest = (alias = "plataforma"): ArcaCertificate => ({ role: "Pending", alias, isLoaded: false, notBeforeUtc: null, notAfterUtc: null, thumbprint: null });
const activeCertificate = (notAfterUtc = new Date(Date.now() + 700 * day).toISOString()): ArcaCertificate =>
  ({ role: "Active", alias: "plataforma", isLoaded: true, notBeforeUtc: "2026-11-01T00:00:00Z", notAfterUtc, thumbprint: "AB12" });
const awaiting: ArcaConnection = { ...none, status: "AwaitingCertificate", mode: "CompanyCertificate", environment: "Production", cuit: "20000000060",
  enabledServices: [registry, invoicing], certificates: [pendingRequest()], revision: 1 };
const unverified: ArcaConnection = { ...awaiting, status: "Unverified", certificates: [activeCertificate()], revision: 2 };
const active: ArcaConnection = { ...unverified, status: "Active", lastTestPassed: true, lastTestedAtUtc: "2026-11-05T12:00:00Z", revision: 4 };

let current: ArcaConnection;
let permissions: string[];
let starts: StartArcaRequest[];
beforeEach(() => {
  queryClient.clear(); current = none; permissions = ["arca.read", "arca.manage"]; starts = [];
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })),
    http.get("/api/arca/connection", () => HttpResponse.json(current)),
    http.get("/api/arca/registry/company", () => HttpResponse.json(current.lastTestPassed
      ? { legalName: "Campo SA", vatCondition: "RegisteredTaxpayer", fiscalAddress: "Ruta 9 km 400, Marcos Juárez, CORDOBA" }
      : { legalName: null, vatCondition: null, fiscalAddress: null })),
    http.get("/api/arca/invoicing/settings", () => HttpResponse.json({ pointOfSale: current.status === "Active" ? 5 : null })),
    http.post("/api/arca/connection/certificate-requests", async ({ request }) => {
      const body = await request.json() as StartArcaRequest;
      starts.push(body);
      current = current.status === null
        ? { ...awaiting, environment: body.environment, cuit: body.cuit.replace(/-/g, ""), certificates: [pendingRequest(body.alias)] }
        : { ...current, certificates: [...current.certificates.filter(item => item.role === "Active"), pendingRequest(body.alias)], revision: current.revision + 1 };
      return HttpResponse.json(current);
    }),
  );
});
afterEach(() => { queryClient.clear(); toast.dismiss(); vi.restoreAllMocks(); });

const tested = (checks: ArcaTest["checks"], connection: ArcaConnection): ArcaTest => ({ checks, connection });
const ready = (service: string) => ({ service, status: "Ready" as const, failureCode: null, ticketExpiresAtUtc: "2026-11-05T23:00:00Z", retryAfterUtc: null });

describe("ARCA settings", () => {
  it("offers to connect to a manager and shows read only to a reader", async () => {
    const { unmount } = renderRouteWithProviders("/configuracion/arca");
    expect(await screen.findByText("Sin conexión con ARCA")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Conectar con ARCA" }));
    expect(screen.getByRole("heading", { name: "1 · Datos" })).toBeInTheDocument();
    unmount();

    queryClient.clear();
    permissions = ["arca.read"];
    renderRouteWithProviders("/configuracion/arca");
    expect(await screen.findByText("Sin conexión con ARCA")).toBeInTheDocument();
    expect(screen.getByText("Solo lectura")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Conectar con ARCA" })).not.toBeInTheDocument();
  });

  it("rejects a wrong check digit next to the cuit without asking the server and lists the installed services", async () => {
    renderRouteWithProviders("/configuracion/arca");
    await userEvent.click(await screen.findByRole("button", { name: "Conectar con ARCA" }));
    await userEvent.type(screen.getByRole("textbox", { name: "CUIT" }), "20-00000006-1");
    await userEvent.type(screen.getByRole("textbox", { name: "Alias" }), "plataforma");
    await userEvent.click(screen.getByRole("button", { name: "Generar el pedido" }));

    expect(screen.getByText("Revisá la CUIT: tiene once dígitos y el último es el verificador.")).toBeInTheDocument();
    expect(starts).toHaveLength(0);
    const services = screen.getByRole("group", { name: "Servicios que usa" });
    expect(within(services).getByRole("checkbox", { name: "Constancia de inscripción" })).toBeChecked();
    expect(within(services).getByRole("checkbox", { name: "Constancia de inscripción" })).toBeDisabled();
    expect(within(services).getByRole("checkbox", { name: "Facturación electrónica" })).toBeChecked();
    expect(within(services).getByRole("checkbox", { name: "Facturación electrónica" })).toBeEnabled();
  });

  it("generating the request folds the details with their summary and offers the download", async () => {
    renderRouteWithProviders("/configuracion/arca");
    await userEvent.click(await screen.findByRole("button", { name: "Conectar con ARCA" }));
    await userEvent.type(screen.getByRole("textbox", { name: "CUIT" }), "20-00000006-0");
    await userEvent.type(screen.getByRole("textbox", { name: "Alias" }), "plataforma");
    await userEvent.click(screen.getByRole("button", { name: "Generar el pedido" }));

    expect(await screen.findByText("20-00000006-0 · Producción · alias «plataforma»")).toBeInTheDocument();
    expect(starts).toEqual([{ cuit: "20000000060", environment: "Production", alias: "plataforma", services: [registry, invoicing], expectedRevision: 0 }]);
    expect(screen.getByRole("button", { name: "Descargar de nuevo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "3 · Certificado" })).toHaveFocus();
  });

  it("names the chosen services in the steps and shows a certificate that does not match next to the upload", async () => {
    current = awaiting;
    server.use(http.put("/api/arca/connection/certificate", () => HttpResponse.json(
      { code: "Arca.Connection.CertificateKeyMismatch", detail: "El certificado no corresponde al pedido que generó el sistema." }, { status: 400 })));
    renderRouteWithProviders("/configuracion/arca");

    expect(await screen.findByText(/autorizá Constancia de inscripción y Facturación electrónica para el alias/)).toBeInTheDocument();
    await userEvent.upload(screen.getByLabelText("Certificado de ARCA (.crt)"), new File(["-----BEGIN CERTIFICATE-----"], "plataforma.crt"));

    expect(await screen.findByRole("alert")).toHaveTextContent("El certificado no corresponde al pedido que generó el sistema.");
  });

  it("takes the certificate dropped on its zone", async () => {
    current = awaiting;
    const uploaded: unknown[] = [];
    server.use(http.put("/api/arca/connection/certificate", async ({ request }) => {
      uploaded.push(await request.json());
      return HttpResponse.json({ code: "Arca.Connection.CertificateExpired", detail: "El certificado ya venció." }, { status: 400 });
    }));
    renderRouteWithProviders("/configuracion/arca");

    const zone = (await screen.findByText("Arrastrá el certificado (.crt) o")).parentElement!;
    fireEvent.drop(zone, { dataTransfer: { files: [new File(["-----BEGIN CERTIFICATE-----"], "plataforma.crt")] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("El certificado ya venció.");
    expect(uploaded).toEqual([{ certificate: "-----BEGIN CERTIFICATE-----", expectedRevision: 1 }]);
  });

  it("offers the activation only once the certificate is loaded", async () => {
    current = awaiting;
    renderRouteWithProviders("/configuracion/arca");

    expect(await screen.findByRole("heading", { name: "3 · Certificado" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activar la conexión" })).not.toBeInTheDocument();
  });

  it("says which service is not authorized and offers to test again", async () => {
    current = unverified;
    server.use(http.post("/api/arca/connection/test", () => HttpResponse.json(tested(
      [ready(registry), { service: invoicing, status: "NotAuthorized", failureCode: null, ticketExpiresAtUtc: null, retryAfterUtc: null }],
      { ...unverified, lastTestPassed: false, lastTestedAtUtc: "2026-11-05T12:00:00Z", revision: 3 }))));
    renderRouteWithProviders("/configuracion/arca");

    await userEvent.click(await screen.findByRole("button", { name: "Probar" }));

    expect(await screen.findByText("Falta autorizar el servicio para el alias «plataforma»")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Probar de nuevo" })).toBeInTheDocument();
  });

  it("shows the test busy in its button while it runs", async () => {
    current = unverified;
    let finish = () => {};
    server.use(http.post("/api/arca/connection/test", async () => {
      await new Promise<void>(resolve => { finish = resolve; });
      return HttpResponse.json(tested([ready(registry), ready(invoicing)], { ...unverified, lastTestPassed: true, revision: 3 }));
    }));
    renderRouteWithProviders("/configuracion/arca");

    await userEvent.click(await screen.findByRole("button", { name: "Probar" }));

    expect(await screen.findByRole("button", { name: "Probando…" })).toBeDisabled();
    finish();
    expect(await screen.findByRole("button", { name: "Probar de nuevo" })).toBeEnabled();
  });

  it("opens the point of sale zone only with invoicing and activates once the test is green and a point is chosen", async () => {
    current = { ...unverified, lastTestPassed: true, revision: 3 };
    const chosen: unknown[] = [];
    server.use(
      http.get("/api/arca/invoicing/points-of-sale", () => HttpResponse.json([{ number: 5, emissionType: "CAE - Factura", blocked: false }, { number: 3, emissionType: "CAE - Factura", blocked: true }])),
      http.put("/api/arca/invoicing/point-of-sale", async ({ request }) => { chosen.push(await request.json()); current = active; return HttpResponse.json({ pointOfSale: 5 }); }),
    );
    renderRouteWithProviders("/configuracion/arca");

    expect(await screen.findByRole("heading", { name: "5 · Facturación · Punto de venta" })).toBeInTheDocument();
    const activate = screen.getByRole("button", { name: "Activar la conexión" });
    expect(activate).toBeDisabled();
    expect(await screen.findByRole("radio", { name: "0003 · bloqueado en ARCA" })).toBeDisabled();
    await userEvent.click(screen.getByRole("radio", { name: "0005 · CAE - Factura" }));
    await waitFor(() => expect(activate).toBeEnabled());
    await userEvent.click(activate);

    expect(await screen.findByText("Activa")).toBeInTheDocument();
    expect(chosen).toEqual([{ pointOfSale: 5 }]);
  });

  it("has no point of sale zone or activation without invoicing", async () => {
    current = { ...unverified, enabledServices: [registry], lastTestPassed: false };
    renderRouteWithProviders("/configuracion/arca");

    expect(await screen.findByRole("heading", { name: "4 · Prueba" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Punto de venta/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activar la conexión" })).not.toBeInTheDocument();
  });

  it("shows the active connection by zones and keeps a renewal inside the certificate", async () => {
    current = active;
    renderRouteWithProviders("/configuracion/arca");

    for (const title of ["Empresa", "Servicios", "Certificado", "Facturación · Punto de venta"]) expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(await screen.findByText("Campo SA")).toBeInTheDocument();
    expect(screen.getByText("20-00000006-0")).toBeInTheDocument();
    // Probada en otra visita: sin el detalle por servicio, que vive en la prueba de esta visita.
    expect(screen.queryByText("Sin probar")).not.toBeInTheDocument();
    expect(screen.getAllByText("Lo usa esta empresa")).toHaveLength(2);
    expect(screen.getByRole("switch", { name: "Lo usa esta empresa: Constancia de inscripción" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Lo usa esta empresa: Facturación electrónica" })).toBeChecked();
    expect(await screen.findByText("0005")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Renovar" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Alias del certificado nuevo" }), "plataforma-2028");
    await userEvent.click(screen.getByRole("button", { name: "Generar el pedido" }));

    expect(await screen.findByText("plataforma-2028 · Pedido generado · falta el certificado")).toBeInTheDocument();
    expect(starts.at(-1)).toMatchObject({ alias: "plataforma-2028", expectedRevision: 4 });
    expect(screen.getByRole("button", { name: "Cancelar la renovación" })).toBeInTheDocument();
  });

  it("warns in yellow thirty days before the certificate expires and in red once it expired", async () => {
    current = { ...active, certificates: [activeCertificate(new Date(Date.now() + 10 * day).toISOString())] };
    const { unmount } = renderRouteWithProviders("/configuracion/arca");
    expect(await screen.findByText(/El certificado vence el/)).toBeInTheDocument();
    unmount();

    queryClient.clear();
    current = { ...active, status: "NeedsAttention", certificates: [activeCertificate(new Date(Date.now() - day).toISOString())] };
    renderRouteWithProviders("/configuracion/arca");
    expect(await screen.findByRole("alert")).toHaveTextContent(/El certificado venció el/);
    expect(screen.getByText("Requiere atención")).toBeInTheDocument();
  });

  it("opens review on a conflict and reads the current connection", async () => {
    current = active;
    server.use(http.put("/api/arca/connection/services", () => HttpResponse.json({ code: "Arca.Connection.RevisionConflict" }, { status: 409 })));
    renderRouteWithProviders("/configuracion/arca");

    await userEvent.click(await screen.findByRole("switch", { name: "Lo usa esta empresa: Facturación electrónica" }));
    expect(await screen.findByText("Otra persona cambió la conexión mientras la editabas.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Leer lo actual" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Revisar" })).not.toBeInTheDocument());
  });

  it("asks before disconnecting and goes back to no connection", async () => {
    current = active;
    const deleted: string[] = [];
    server.use(http.delete("/api/arca/connection", ({ request }) => { deleted.push(new URL(request.url).search); current = none; return new HttpResponse(null, { status: 204 }); }));
    renderRouteWithProviders("/configuracion/arca");

    await userEvent.click(await screen.findByRole("button", { name: "Desconectar" }));
    const dialog = await screen.findByRole("dialog", { name: "¿Desconectar ARCA?" });
    expect(within(dialog).getByText(/Se borran la clave privada y los tickets de acceso/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Desconectar" }));

    expect(await screen.findByText("Sin conexión con ARCA")).toBeInTheDocument();
    expect(deleted).toEqual(["?expectedRevision=4"]);
  });
});
