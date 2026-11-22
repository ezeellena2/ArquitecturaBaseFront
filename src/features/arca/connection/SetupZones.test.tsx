import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { ArcaConnection, StartArcaRequest } from "./api";
import type { ArcaRobotRun, ArcaRobotSide } from "./robot";
import { SetupZones } from "./SetupZones";

vi.mock("react-oidc-context", async () => ({ ...(await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context")), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }));

const services = [{ code: "ws_sr_constancia_inscripcion", family: "Registry", required: true, delegated: false }, { code: "wsfe", family: "Invoicing", required: false, delegated: true }];
const none: ArcaConnection = {
  status: null, mode: null, environment: null, cuit: null, platformCuit: null, platform: { cuit: "30718887778", name: "ArquitecturaBase" },
  installedServices: services, enabledServices: [], certificates: [], lastTestPassed: null, lastTestedAtUtc: null, revision: 0, certificateNoticeDays: 30,
};
const automated: ArcaConnection = {
  ...none, status: "AwaitingCertificate", mode: "PlatformDelegationAutomated", environment: "Production", cuit: "20000000060", platformCuit: "30718887778",
  enabledServices: ["ws_sr_constancia_inscripcion", "wsfe"], revision: 1,
  certificates: [{ role: "Pending", alias: "plataforma-demo", isLoaded: false, notBeforeUtc: null, notAfterUtc: null, thumbprint: null }],
};
const side = (state: ArcaRobotSide["state"], completedSteps: string[] = []): ArcaRobotSide => ({
  state, currentStep: null, completedSteps, outputs: {}, failure: null, failedStep: null, nextAttemptAtUtc: null, startedAtUtc: "2026-11-11T12:00:00Z", finishedAtUtc: null, alerted: false,
});

let robot: ArcaRobotRun;
let starts: StartArcaRequest[];
beforeEach(() => {
  robot = { enabled: true, company: null, platform: null };
  starts = [];
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["arca.read", "arca.manage"] })),
    http.get("/api/arca/connection/robot-runs/current", () => HttpResponse.json(robot)),
    http.post("/api/arca/connection/certificate-requests", async ({ request }) => {
      starts.push(await request.json() as StartArcaRequest);
      return HttpResponse.json(automated);
    }),
  );
});

function renderZones(connection: ArcaConnection) {
  return renderWithProviders(<MemoryRouter>
    <SetupZones connection={connection} canManage lastTest={null} onChanged={() => undefined} onTested={() => undefined} onConflict={() => undefined}
      guideSteps={[{ key: "company.point-of-sale", textKey: "delegation.pointOfSale" }]} />
  </MemoryRouter>);
}

// How it connects, the environment and the point of sale go in the shared piece for choosing (DS1-A, 2026-11-22).
async function openList(field: string) {
  await userEvent.click(await screen.findByRole("button", { name: new RegExp(`^${field} `) }));
  return screen.findByRole("listbox", { name: field });
}
async function chooseIn(field: string, option: string | RegExp) {
  await userEvent.click(within(await openList(field)).getByRole("option", { name: option }));
}

describe("the setup with the robot", () => {
  it("offers the automated delegation as a third mode only with the robot on, and only in production", async () => {
    renderZones(none);

    await chooseIn("Cómo se conecta", "Delegación automática");
    expect(screen.getByRole("button", { name: "Cómo se conecta Delegación automática" })).toBeInTheDocument();

    await chooseIn("Ambiente", "Homologación");
    const modes = await openList("Cómo se conecta");
    expect(within(modes).getByRole("option", { name: "Delegación automática" })).toHaveAttribute("aria-disabled", "true");
    expect(within(modes).getByRole("option", { name: /Delegación guiada|ArquitecturaBase/ })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Escape}");
  });

  it("does not offer it while the robot is off", async () => {
    robot = { enabled: false, company: null, platform: null };
    renderZones(none);

    expect(await screen.findByRole("button", { name: /^Ambiente / })).toBeInTheDocument();
    const modes = await openList("Cómo se conecta");
    await waitFor(() => expect(within(modes).queryByRole("option", { name: "Delegación automática" })).not.toBeInTheDocument());
    await userEvent.keyboard("{Escape}");
  });

  it("asks for the platform certificate with the automated mode", async () => {
    renderZones(none);

    await chooseIn("Cómo se conecta", "Delegación automática");
    await userEvent.type(screen.getByLabelText(/CUIT de la empresa/, { selector: "input" }), "20-00000006-0");
    await userEvent.type(screen.getByLabelText(/Alias/, { selector: "input" }), "plataforma-demo");
    await userEvent.click(screen.getByRole("button", { name: "Generar el pedido" }));

    await waitFor(() => expect(starts.at(-1)?.mode).toBe("PlatformDelegationAutomated"));
  });

  it("puts the robot instead of the request, the certificate and the guide, and opens the test when it finished", async () => {
    const { unmount } = renderZones(automated);

    expect(await screen.findByText("2 · Delegación automática")).toBeInTheDocument();
    expect(screen.queryByText(/Pedido de certificado/)).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Delegar con el robot" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Probar" })).not.toBeInTheDocument();
    unmount();

    robot = { enabled: true, company: side("Succeeded", ["company.login", "company.delegate.wsfe"]), platform: side("Succeeded", ["verify"]) };
    renderZones({ ...automated, status: "Unverified" });
    expect(await screen.findByRole("button", { name: "Probar" })).toBeInTheDocument();
  });
});
