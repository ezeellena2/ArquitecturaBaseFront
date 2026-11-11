import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { ArcaConnection } from "../connection/api";
import { PointOfSaleZone } from "./PointOfSaleZone";

vi.mock("react-oidc-context", async () => ({ ...(await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context")), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }));

const automated = {
  status: "Unverified", mode: "PlatformDelegationAutomated", environment: "Production", cuit: "20000000060", platformCuit: "30718887778",
  platform: { cuit: "30718887778", name: "ArquitecturaBase" }, installedServices: [], enabledServices: ["wsfe"], certificates: [], lastTestPassed: true,
  lastTestedAtUtc: "2026-11-11T12:00:00Z", revision: 4,
} as unknown as ArcaConnection;

let chosen: number[];
beforeEach(() => {
  chosen = [];
  server.use(
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
      chosen.push((await request.json() as { pointOfSale: number }).pointOfSale);
      return HttpResponse.json({ pointOfSale: 2, grossIncomeNumber: null, activityStartOn: null });
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
    expect(chosen).toEqual([2]);

    await userEvent.click(screen.getByRole("radio", { name: /0005/ }));
    expect(screen.getByRole("radio", { name: /0005/ })).toBeChecked();
  });
});
