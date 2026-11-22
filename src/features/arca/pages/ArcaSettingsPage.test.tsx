import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
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
  status: null, mode: null, environment: null, cuit: null, platformCuit: null, platform: null, enabledServices: [], certificates: [], lastTestPassed: null,
  lastTestedAtUtc: null, revision: 0,
  installedServices: [{ code: registry, family: "Registry", required: true, delegated: false }, { code: invoicing, family: "Invoicing", required: false, delegated: true }],
};
const pendingRequest = (alias = "plataforma"): ArcaCertificate => ({ role: "Pending", alias, isLoaded: false, notBeforeUtc: null, notAfterUtc: null, thumbprint: null });
const activeCertificate = (notAfterUtc = new Date(Date.now() + 700 * day).toISOString()): ArcaCertificate =>
  ({ role: "Active", alias: "plataforma", isLoaded: true, notBeforeUtc: "2026-11-01T00:00:00Z", notAfterUtc, thumbprint: "AB12" });
const awaiting: ArcaConnection = { ...none, status: "AwaitingCertificate", mode: "CompanyCertificate", environment: "Production", cuit: "20000000060",
  enabledServices: [registry, invoicing], certificates: [pendingRequest()], revision: 1 };
const unverified: ArcaConnection = { ...awaiting, status: "Unverified", certificates: [activeCertificate()], revision: 2 };
const active: ArcaConnection = { ...unverified, status: "Active", lastTestPassed: true, lastTestedAtUtc: "2026-11-05T12:00:00Z", revision: 4 };
const platform = { cuit: "30719998883", name: "Plataforma Ejemplo S.A." };
const delegatedAwaiting: ArcaConnection = { ...awaiting, platform, mode: "PlatformDelegation", platformCuit: platform.cuit };
const delegatedUnverified: ArcaConnection = { ...delegatedAwaiting, status: "Unverified", certificates: [activeCertificate()], lastTestPassed: false,
  lastTestedAtUtc: "2026-11-05T12:00:00Z", revision: 3 };
const delegatedActive: ArcaConnection = { ...delegatedUnverified, status: "Active", lastTestPassed: true, revision: 5 };

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
    http.get("/api/arca/invoicing/settings", () => HttpResponse.json(current.status === "Active"
      ? { pointOfSale: 5, grossIncomeNumber: null, activityStartOn: null, revision: 1 }
      : { pointOfSale: null, grossIncomeNumber: null, activityStartOn: null, revision: 0 })),
    http.post("/api/arca/connection/certificate-requests", async ({ request }) => {
      const body = await request.json() as StartArcaRequest;
      starts.push(body);
      current = current.status === null
        ? { ...(body.mode === "PlatformDelegation" ? delegatedAwaiting : awaiting), platform: current.platform, environment: body.environment,
          cuit: body.cuit.replace(/-/g, ""), certificates: [pendingRequest(body.alias)] }
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
    // DS1-A: the services are chosen with the shared piece; the one ARCA always needs stays chosen and off, with its reason.
    const services = screen.getByRole("button", { name: /^Servicios que usa / });
    expect(services).toHaveAccessibleName(/Constancia de inscripción/); expect(services).toHaveAccessibleName(/Facturación electrónica/);
    await userEvent.click(services);
    const list = await screen.findByRole("listbox", { name: "Servicios que usa" });
    const registration = within(list).getByRole("option", { name: "Constancia de inscripción" });
    expect(registration).toHaveAttribute("aria-selected", "true");
    expect(registration).toHaveAttribute("aria-disabled", "true");
    expect(registration).toHaveAccessibleDescription("Siempre: trae los datos de la empresa.");
    const invoicing = within(list).getByRole("option", { name: "Facturación electrónica" });
    expect(invoicing).toHaveAttribute("aria-selected", "true");
    expect(invoicing).not.toHaveAttribute("aria-disabled");
    await userEvent.keyboard("{Escape}");
  });

  it("generating the request folds the details with their summary and offers the download", async () => {
    renderRouteWithProviders("/configuracion/arca");
    await userEvent.click(await screen.findByRole("button", { name: "Conectar con ARCA" }));
    await userEvent.type(screen.getByRole("textbox", { name: "CUIT" }), "20-00000006-0");
    await userEvent.type(screen.getByRole("textbox", { name: "Alias" }), "plataforma");
    await userEvent.click(screen.getByRole("button", { name: "Generar el pedido" }));

    expect(await screen.findByText("20-00000006-0 · Producción · alias «plataforma»")).toBeInTheDocument();
    expect(starts).toEqual([{ cuit: "20000000060", environment: "Production", alias: "plataforma", services: [registry, invoicing], expectedRevision: 0,
      mode: "CompanyCertificate" }]);
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
    // MA1-A: apagado con su motivo, que se alcanza con Tab y el lector lee.
    const activate = screen.getByRole("button", { name: "Activar la conexión" });
    expect(activate).toHaveAttribute("aria-disabled", "true");
    expect(activate).toHaveAccessibleDescription("Elegí el punto de venta.");
    expect(await screen.findByRole("radio", { name: "0003 · bloqueado en ARCA" })).toBeDisabled();
    await userEvent.click(screen.getByRole("radio", { name: "0005 · CAE - Factura" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Activar la conexión" })).not.toHaveAttribute("aria-disabled"));
    await userEvent.click(screen.getByRole("button", { name: "Activar la conexión" }));

    expect(await screen.findByText("Activa")).toBeInTheDocument();
    expect(chosen).toEqual([{ pointOfSale: 5, expectedRevision: 0 }]);
  });

  it("says the activation waits for a test while the connection was never tested", async () => {
    current = unverified;
    renderRouteWithProviders("/configuracion/arca");

    const activate = await screen.findByRole("button", { name: "Activar la conexión" });
    expect(activate).toHaveAttribute("aria-disabled", "true");
    expect(activate).toHaveAccessibleDescription("Primero probá la conexión.");
  });

  it("says the activation waits for a test that passes after one that did not", async () => {
    current = { ...unverified, lastTestPassed: false, lastTestedAtUtc: "2026-11-05T12:00:00Z", revision: 3 };
    renderRouteWithProviders("/configuracion/arca");

    expect(await screen.findByRole("button", { name: "Activar la conexión" }))
      .toHaveAccessibleDescription("La última prueba no pasó: resolvé lo que marca y probá de nuevo.");
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
    const required = screen.getByRole("switch", { name: "Lo usa esta empresa: Constancia de inscripción" });
    expect(required).toBeDisabled();
    expect(required).toHaveAccessibleDescription("Siempre: trae los datos de la empresa.");
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

  // H30: changing CUIT, environment or mode in the alta is one request that replaces the connection on the server.
  it("replaces the connection in one request when the environment changes in the alta", async () => {
    current = awaiting;
    const replaced: StartArcaRequest[] = [];
    let deleted = 0;
    server.use(
      http.put("/api/arca/connection", async ({ request }) => {
        const body = await request.json() as StartArcaRequest;
        replaced.push(body);
        current = { ...awaiting, environment: body.environment, certificates: [pendingRequest(body.alias)], revision: 1_763_200_000_000 };
        return HttpResponse.json(current);
      }),
      http.delete("/api/arca/connection", () => { deleted++; return new HttpResponse(null, { status: 204 }); }),
    );
    renderRouteWithProviders("/configuracion/arca");

    await userEvent.click(await screen.findByRole("button", { name: "Cambiar" }));
    await userEvent.click(screen.getByRole("button", { name: "Homologación" }));
    await userEvent.click(screen.getByRole("button", { name: "Generar el pedido" }));

    await waitFor(() => expect(replaced).toHaveLength(1));
    expect(replaced[0]).toMatchObject({ cuit: "20000000060", environment: "Testing", alias: "plataforma", expectedRevision: 1 });
    expect([deleted, starts.length]).toEqual([0, 0]);
  });

  // H30: when someone else disconnected meanwhile, the screen reads the connection again instead of repeating «no connection».
  it("reads the connection again when it is gone", async () => {
    current = awaiting;
    server.use(http.put("/api/arca/connection", () => {
      current = none;
      return HttpResponse.json({ code: "Arca.Connection.NotConnected", detail: "Todavía no hay una conexión con ARCA." }, { status: 404 });
    }));
    renderRouteWithProviders("/configuracion/arca");

    await userEvent.click(await screen.findByRole("button", { name: "Cambiar" }));
    await userEvent.click(screen.getByRole("button", { name: "Homologación" }));
    await userEvent.click(screen.getByRole("button", { name: "Generar el pedido" }));

    expect(await screen.findByRole("button", { name: "Leer lo actual" })).toBeInTheDocument();
  });

  it("asks before disconnecting and goes back to no connection", async () => {
    current = active;
    const deleted: string[] = [];
    server.use(http.delete("/api/arca/connection", ({ request }) => { deleted.push(new URL(request.url).search); current = none; return new HttpResponse(null, { status: 204 }); }));
    renderRouteWithProviders("/configuracion/arca");

    // AC1-A (2026-11-11): disconnecting is something done with the connection, in ⋮ and in red, not a button in sight.
    const trigger = await screen.findByRole("button", { name: "Acciones de la conexión" });
    expect(screen.queryByRole("button", { name: "Desconectar" })).not.toBeInTheDocument();
    act(() => trigger.focus());
    await userEvent.keyboard("{Enter}");
    const item = within(await screen.findByRole("menu")).getByRole("menuitem", { name: "Desconectar" });
    expect(item).toHaveAttribute("data-variant", "destructive");
    await userEvent.click(item);
    const dialog = await screen.findByRole("dialog", { name: "¿Desconectar ARCA?" });
    expect(within(dialog).getByText(/Se borran la clave privada y los tickets de acceso/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Desconectar" }));

    expect(await screen.findByText("Sin conexión con ARCA")).toBeInTheDocument();
    expect(deleted).toEqual(["?expectedRevision=4"]);
  });

  it("gives the focus back to ⋮ when disconnecting is cancelled", async () => {
    current = active;
    renderRouteWithProviders("/configuracion/arca");

    const trigger = await screen.findByRole("button", { name: "Acciones de la conexión" });
    act(() => trigger.focus());
    await userEvent.keyboard("{Enter}");
    await userEvent.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: "Desconectar" }));
    const dialog = await screen.findByRole("dialog", { name: "¿Desconectar ARCA?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe("ARCA settings by delegation", () => {
  const notDelegated = { service: invoicing, status: "NotDelegated" as const, failureCode: null, ticketExpiresAtUtc: null, retryAfterUtc: null };

  it("chooses the delegation in the details and requests the certificate for the platform", async () => {
    current = { ...none, platform };
    renderRouteWithProviders("/configuracion/arca");
    await userEvent.click(await screen.findByRole("button", { name: "Conectar con ARCA" }));
    await userEvent.click(within(screen.getByRole("group", { name: "Cómo se conecta" })).getByRole("button", { name: "Delegación en Plataforma Ejemplo S.A." }));
    await userEvent.type(screen.getByRole("textbox", { name: "CUIT de la empresa" }), "20-00000006-0");
    await userEvent.type(screen.getByRole("textbox", { name: "Alias de la plataforma" }), "plataforma");
    await userEvent.click(screen.getByRole("button", { name: "Generar el pedido" }));

    expect(await screen.findByText("20-00000006-0 · Producción · Delegación en Plataforma Ejemplo S.A.")).toBeInTheDocument();
    expect(starts.at(-1)).toMatchObject({ cuit: "20000000060", alias: "plataforma", mode: "PlatformDelegation" });
    expect(screen.getByRole("heading", { name: "3 · Certificado de la plataforma" })).toHaveFocus();
    expect(screen.getByText("Lo hace Plataforma Ejemplo S.A., con su clave fiscal")).toBeInTheDocument();
    // La constancia no se delega: la plataforma la autoriza para su alias y la consulta con su CUIT.
    expect(screen.getByText(/a nombre de Plataforma Ejemplo S.A., autorizá Constancia de inscripción para el alias/)).toBeInTheDocument();
  });

  it("keeps the delegation off with its reason when the installation has no platform", async () => {
    renderRouteWithProviders("/configuracion/arca");
    await userEvent.click(await screen.findByRole("button", { name: "Conectar con ARCA" }));

    const delegation = within(screen.getByRole("group", { name: "Cómo se conecta" })).getByRole("button", { name: "Delegación en la plataforma" });
    expect(delegation).toHaveAttribute("aria-disabled", "true");
    expect(delegation).toHaveAccessibleDescription("La instalación no tiene configurada la CUIT de la plataforma.");
    await userEvent.click(delegation);
    expect(screen.getByRole("textbox", { name: "CUIT" })).toBeInTheDocument();
  });

  it("guides the delegation in two lists and says which service has not arrived yet", async () => {
    current = delegatedUnverified;
    server.use(http.post("/api/arca/connection/test", () => HttpResponse.json(tested([ready(registry), notDelegated], delegatedUnverified))));
    renderRouteWithProviders("/configuracion/arca");

    expect(await screen.findByRole("heading", { name: "4 · Delegación" })).toBeInTheDocument();
    const company = screen.getByRole("region", { name: "Lo hace la empresa, con su clave fiscal" });
    expect(within(company).getByText(/elegí ARCA › WebServices › «Facturacion Electronica» y, en «Representante», la CUIT 30-71999888-3/)).toBeInTheDocument();
    expect(within(company).getByText(/agregá uno de web service/)).toBeInTheDocument();
    const platformSteps = screen.getByRole("region", { name: "Lo hace Plataforma Ejemplo S.A., con su clave fiscal" });
    expect(within(platformSteps).getByText("En «Aceptación de Designación», aceptá la delegación de la CUIT 20-00000006-0.")).toBeInTheDocument();
    expect(within(platformSteps).getByText(/«Facturacion Electronica» con el computador fiscal «plataforma»/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Verificar la delegación" }));

    expect(await screen.findByText("Sin delegar")).toBeInTheDocument();
    expect(screen.getByText("Con la CUIT de la plataforma")).toBeInTheDocument();
  });

  it("folds the delegation once it arrived, opens the point of sale and shows the guide again on request", async () => {
    current = { ...delegatedUnverified, lastTestPassed: true };
    renderRouteWithProviders("/configuracion/arca");

    expect(await screen.findByText("Delegada en Plataforma Ejemplo S.A.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "5 · Facturación · Punto de venta" })).toBeInTheDocument();
    expect(screen.queryByText("Lo hace la empresa, con su clave fiscal")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ver la guía" }));
    expect(screen.getByText("Lo hace la empresa, con su clave fiscal")).toBeInTheDocument();
  });

  it("has a single step of the platform in WSASS in homologation", async () => {
    current = { ...delegatedUnverified, environment: "Testing" };
    renderRouteWithProviders("/configuracion/arca");

    expect(await screen.findByText(/En WSASS, «Crear autorización a servicio»: el alias «plataforma», la CUIT 20-00000006-0 como «CUIT representado» y el servicio «wsfe»/))
      .toBeInTheDocument();
    expect(screen.queryByText("Lo hace la empresa, con su clave fiscal")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir WSASS" })).toBeInTheDocument();
  });

  it("shows the active delegation with its platform, warns when the company revokes it and renews with the same alias", async () => {
    current = delegatedActive;
    server.use(http.post("/api/arca/connection/test", () => HttpResponse.json(tested([ready(registry), notDelegated],
      { ...delegatedActive, status: "NeedsAttention", lastTestPassed: false, revision: 6 }))));
    renderRouteWithProviders("/configuracion/arca");

    for (const title of ["Delegación", "Certificado de la plataforma"]) expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByText("Plataforma Ejemplo S.A. · 30-71999888-3")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Probar" }));
    expect(await screen.findByText(/La empresa ya no delega Facturación electrónica en Plataforma Ejemplo S.A./)).toBeInTheDocument();
    expect(screen.getByText("Requiere atención")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Ver la guía" })[0]);
    expect(screen.getByText("Lo hace la empresa, con su clave fiscal")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Renovar" }));
    expect(screen.getByRole("textbox", { name: "Alias del certificado nuevo" })).toHaveValue("plataforma");
  });
});
