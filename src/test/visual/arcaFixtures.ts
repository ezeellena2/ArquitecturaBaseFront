import type { ArcaCertificate, ArcaConnection, ArcaTest } from "@/features/arca/connection/api";

const registry = "ws_sr_constancia_inscripcion";
const invoicing = "wsfe";

/// La pantalla ARCA sin red ni ARCA: cada escenario es un estado de AC1-A, AC2-A o AC3, o de la delegación (DG1-A a DG3),
/// con datos inventados. Las escenas congelan el reloj en el 2026-11-05, así los vencimientos dicen siempre lo mismo.
export function createArcaVisualFixtures(scenario: string) {
  const installedServices = [{ code: registry, family: "Registry", required: true, delegated: false }, { code: invoicing, family: "Invoicing", required: false, delegated: true }];
  const platform = { cuit: "30719998883", name: "Plataforma Ejemplo S.A." };
  const pending = (alias: string, isLoaded = false): ArcaCertificate => ({ role: "Pending", alias, isLoaded, notBeforeUtc: null, notAfterUtc: null, thumbprint: null });
  const activeCertificate = (notAfterUtc: string): ArcaCertificate => ({ role: "Active", alias: "plataforma", isLoaded: true, notBeforeUtc: "2024-11-01T00:00:00Z", notAfterUtc, thumbprint: "AB12" });
  const base: ArcaConnection = { status: null, mode: null, environment: null, cuit: null, platformCuit: null, platform, installedServices, enabledServices: [],
    certificates: [], lastTestPassed: null, lastTestedAtUtc: null, revision: 0 };
  const connected: ArcaConnection = { ...base, mode: "CompanyCertificate", environment: "Production", cuit: "30710001231", enabledServices: [registry, invoicing] };
  const delegated: ArcaConnection = { ...connected, mode: "PlatformDelegation", platformCuit: platform.cuit };
  let connection: ArcaConnection =
    scenario === "arca-setup" ? { ...connected, status: "AwaitingCertificate", certificates: [pending("plataforma")], revision: 1 }
    : scenario === "arca-unverified" ? { ...connected, status: "Unverified", certificates: [activeCertificate("2028-11-01T00:00:00Z")], lastTestPassed: true, lastTestedAtUtc: "2026-11-05T12:10:00Z", revision: 3 }
    : scenario === "arca-renewal" ? { ...connected, status: "Active", certificates: [activeCertificate("2026-11-20T00:00:00Z"), pending("plataforma-2028")], lastTestPassed: true, lastTestedAtUtc: "2026-11-05T12:10:00Z", revision: 6 }
    : scenario === "arca-active" || scenario === "arca-read" ? { ...connected, status: "Active", certificates: [activeCertificate("2028-11-01T00:00:00Z")], lastTestPassed: true, lastTestedAtUtc: "2026-11-05T12:10:00Z", revision: 5 }
    : scenario === "arca-delegation-setup" ? { ...delegated, status: "AwaitingCertificate", certificates: [pending("plataforma")], revision: 1 }
    : scenario === "arca-delegation-waiting" ? { ...delegated, status: "Unverified", certificates: [activeCertificate("2028-11-01T00:00:00Z")], lastTestPassed: false, lastTestedAtUtc: "2026-11-05T12:10:00Z", revision: 3 }
    : scenario === "arca-delegation-active" ? { ...delegated, status: "Active", certificates: [activeCertificate("2028-11-01T00:00:00Z")], lastTestPassed: true, lastTestedAtUtc: "2026-11-05T12:10:00Z", revision: 5 }
    : base;
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  // Esperando la delegación, Facturación no llega: el ticket de la plataforma todavía no incluye a la empresa.
  const test = (): ArcaTest => ({ checks: connection.enabledServices.map(service => scenario === "arca-delegation-waiting" && service === invoicing
    ? { service, status: "NotDelegated", failureCode: null, ticketExpiresAtUtc: null, retryAfterUtc: null }
    : { service, status: "Ready", failureCode: null, ticketExpiresAtUtc: "2026-11-05T23:10:00Z", retryAfterUtc: null }), connection });

  return {
    permissions: scenario === "arca-read" ? ["arca.read"] : ["arca.read", "arca.manage"],
    async handle(request: Request): Promise<Response | undefined> {
      const path = new URL(request.url).pathname;
      if (!path.startsWith("/api/arca/")) return undefined;
      if (path === "/api/arca/connection" && request.method === "GET") return json(connection);
      if (path === "/api/arca/connection/test") return json(test());
      if (path === "/api/arca/connection/certificate-requests" && request.method === "POST") {
        const body = await request.json() as { cuit: string; environment: ArcaConnection["environment"]; alias: string; services: string[] };
        connection = { ...connected, status: "AwaitingCertificate", environment: body.environment, cuit: body.cuit.replace(/-/g, ""), enabledServices: body.services,
          certificates: [pending(body.alias)], revision: connection.revision + 1 };
        return json(connection);
      }
      if (path === "/api/arca/registry/company") return json(connection.lastTestPassed
        ? { legalName: "Campo del Sur SA", vatCondition: "RegisteredTaxpayer", fiscalAddress: "Ruta 8 km 612, Pergamino, BUENOS AIRES" }
        : { legalName: null, vatCondition: null, fiscalAddress: null });
      if (path === "/api/arca/invoicing/settings") return json(connection.status === "Active"
        ? { pointOfSale: 5, grossIncomeNumber: "901-123456-7", activityStartOn: "2019-03-01" }
        : { pointOfSale: null, grossIncomeNumber: null, activityStartOn: null });
      if (path === "/api/arca/invoicing/points-of-sale") return json([
        { number: 5, emissionType: "CAE - Factura", blocked: false },
        { number: 7, emissionType: "CAE - Factura", blocked: false },
        { number: 3, emissionType: "CAE - Factura", blocked: true },
      ]);
      return json({ code: "Visual.NotFound" }, 404);
    },
  };
}
