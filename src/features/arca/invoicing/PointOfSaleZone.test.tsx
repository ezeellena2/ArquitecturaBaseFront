import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { ArcaConnection } from "../connection/api";
import type { ArcaInvoicingSettings } from "./api";
import { PointOfSaleSection, PointOfSaleZone } from "./PointOfSaleZone";

vi.mock("react-oidc-context", async () => ({ ...(await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context")), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }));

const automated = {
  status: "Unverified", mode: "PlatformDelegationAutomated", environment: "Production", cuit: "20000000060", platformCuit: "30718887778",
  platform: { cuit: "30718887778", name: "ArquitecturaBase" }, installedServices: [], enabledServices: ["wsfe"], certificates: [], lastTestPassed: true,
  lastTestedAtUtc: "2026-11-11T12:00:00Z", revision: 4,
} as unknown as ArcaConnection;

let chosen: unknown[];
let settings: ArcaInvoicingSettings;
beforeEach(() => {
  chosen = [];
  settings = { pointOfSale: null, grossIncomeNumber: null, activityStartOn: null, revision: 3 };
  server.use(
    http.get("/api/arca/invoicing/settings", () => HttpResponse.json(settings)),
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["arca.read", "arca.manage"] })),
    http.get("/api/arca/invoicing/points-of-sale", () => HttpResponse.json([
      { number: 2, emissionType: "RECE", blocked: false }, { number: 5, emissionType: "CAE", blocked: false },
    ])),
    http.get("/api/arca/connection/robot-runs/current", () => HttpResponse.json({
      enabled: true,
      company: { state: "Succeeded", currentStep: null, completedSteps: ["company.point-of-sale"], outputs: { "company.point-of-sale": "2" }, failure: null,
        failedStep: null, nextAttemptAtUtc: null, startedAtUtc: "2026-11-11T12:00:00Z", finishedAtUtc: "2026-11-11T12:05:00Z" },
      platform: null,
    })),
    http.put("/api/arca/invoicing/point-of-sale", async ({ request }) => {
      const body = await request.json() as { pointOfSale: number };
      chosen.push(body);
      settings = { ...settings, pointOfSale: body.pointOfSale, revision: settings.revision + 1 };
      return HttpResponse.json(settings);
    }),
  );
});

describe("the point of sale zone with the robot", () => {
  it("arrives with the point of sale the robot created, ready to activate, and lets the person pick another", async () => {
    let complete: (() => Promise<void>) | null = null;
    renderWithProviders(<MemoryRouter>
      <PointOfSaleZone step={4} connection={automated} canManage open onReady={next => { complete = next; }} />
    </MemoryRouter>);

    expect(await screen.findByRole("radio", { name: /0002/ })).toBeChecked();
    await waitFor(() => expect(complete).not.toBeNull());
    await complete!();
    expect(chosen).toEqual([{ pointOfSale: 2, expectedRevision: 3 }]);

    await userEvent.click(screen.getByRole("radio", { name: /0005/ }));
    expect(screen.getByRole("radio", { name: /0005/ })).toBeChecked();
  });
});

describe("the point of sale with the connection active", () => {
  const active = { ...automated, status: "Active" } as ArcaConnection;
  const zone = () => screen.getByRole("region", { name: "Facturación · Punto de venta" });

  it("changes the point of sale with the revision it read", async () => {
    settings = { pointOfSale: 5, grossIncomeNumber: null, activityStartOn: null, revision: 2 };
    renderWithProviders(<MemoryRouter><PointOfSaleSection connection={active} canManage onConflict={() => {}} /></MemoryRouter>);

    await userEvent.click(await within(await screen.findByRole("region", { name: "Facturación · Punto de venta" })).findByRole("button", { name: "Cambiar" }));
    await userEvent.click(await screen.findByRole("radio", { name: /0002/ }));
    await userEvent.click(within(zone()).getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(chosen).toEqual([{ pointOfSale: 2, expectedRevision: 2 }]));
  });

  it("says when the settings could not be read and offers no change until they are", async () => {
    let fail = true;
    server.use(http.get("/api/arca/invoicing/settings", () => fail ? HttpResponse.json({}, { status: 500 }) : HttpResponse.json(settings)));
    settings = { pointOfSale: 5, grossIncomeNumber: null, activityStartOn: null, revision: 2 };
    renderWithProviders(<MemoryRouter><PointOfSaleSection connection={active} canManage onConflict={() => {}} /></MemoryRouter>);

    expect(await screen.findByText("No pudimos leer la configuración de Facturación.")).toBeInTheDocument();
    expect(within(zone()).queryByRole("button", { name: "Cambiar" })).not.toBeInTheDocument();
    expect(within(zone()).queryByText("Sin elegir")).not.toBeInTheDocument();
    fail = false;
    await userEvent.click(within(zone()).getByRole("button", { name: "Reintentar" }));

    expect(await within(zone()).findByText("0005")).toBeInTheDocument();
    expect(within(zone()).getByRole("button", { name: "Cambiar" })).toBeInTheDocument();
  });
});
