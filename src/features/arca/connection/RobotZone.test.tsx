import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { ArcaConnection } from "./api";
import type { ArcaRobotRun, ArcaRobotSide, StartArcaRobotRequest } from "./robot";
import { RobotZone, type RobotGuideFallback } from "./RobotZone";

vi.mock("react-oidc-context", async () => ({ ...(await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context")), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }));

const connection = {
  status: "AwaitingCertificate", mode: "PlatformDelegationAutomated", environment: "Production", cuit: "20000000060",
  platformCuit: "30718887778", platform: { cuit: "30718887778", name: "ArquitecturaBase" },
  installedServices: [{ code: "ws_sr_constancia_inscripcion", family: "Registry", required: true, delegated: false },
    { code: "wsfe", family: "Invoicing", required: false, delegated: true }],
  enabledServices: ["ws_sr_constancia_inscripcion", "wsfe"], certificates: [], lastTestPassed: null, lastTestedAtUtc: null, revision: 3,
} as ArcaConnection;
const side = (overrides: Partial<ArcaRobotSide>): ArcaRobotSide => ({
  state: "Running", currentStep: null, completedSteps: [], outputs: {}, failure: null, failedStep: null, nextAttemptAtUtc: null,
  startedAtUtc: "2026-11-11T12:00:00Z", finishedAtUtc: null, ...overrides,
});

let run: ArcaRobotRun;
let starts: StartArcaRobotRequest[];
let tests: number;
let guides: RobotGuideFallback[];
beforeEach(() => {
  run = { enabled: true, company: null, platform: null };
  starts = [];
  tests = 0;
  guides = [];
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["arca.read", "arca.manage"] })),
    http.get("/api/arca/connection/robot-runs/current", () => HttpResponse.json(run)),
    http.post("/api/arca/connection/robot-runs", async ({ request }) => {
      starts.push(await request.json() as StartArcaRobotRequest);
      run = { enabled: true, company: side({ currentStep: "company.login" }), platform: side({ state: "Waiting" }) };
      return HttpResponse.json(run, { status: 202 });
    }),
    http.post("/api/arca/connection/test", () => {
      tests++;
      return HttpResponse.json({ checks: [], connection });
    }),
  );
});
afterEach(() => vi.restoreAllMocks());

function renderZone(canManage = true) {
  return renderWithProviders(<MemoryRouter>
    <RobotZone step={2} connection={connection} canManage={canManage} platform={{ name: "ArquitecturaBase", cuit: "30718887778" }}
      delegatedServices={["wsfe"]} authorizedServices={["ws_sr_constancia_inscripcion"]} familySteps={["company.point-of-sale"]}
      renderGuide={fallback => { guides.push(fallback); return <p>Guía de la etapa 5</p>; }} onTested={() => undefined} onConflict={() => undefined} />
  </MemoryRouter>);
}

describe("the robot zone", () => {
  it("asks for the consent before delegating and sends the key once, emptying the field (RB1-A)", async () => {
    renderZone();
    const start = await screen.findByRole("button", { name: "Delegar con el robot" });
    expect(start).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/«Facturación electrónica» en ArquitecturaBase \(CUIT 30-71888777-8\)/)).toBeInTheDocument();
    // En la banda, arriba de los campos; la (i) explica la autorización junto a la casilla.
    expect(start.compareDocumentPosition(screen.getByLabelText(/Entrás con/, { selector: "input" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("checkbox")).toHaveAccessibleDescription(/no se guarda en ningún lado/);

    await userEvent.type(screen.getByLabelText(/Entrás con/, { selector: "input" }), "20-28456789-0");
    await userEvent.type(screen.getByLabelText(/Clave fiscal/, { selector: "input" }), "clave-de-prueba");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Delegar con el robot" }));
    expect(await screen.findByText(/el dígito verificador no coincide/)).toBeInTheDocument();
    expect(starts).toHaveLength(0);

    await userEvent.clear(screen.getByLabelText(/Entrás con/, { selector: "input" }));
    await userEvent.type(screen.getByLabelText(/Entrás con/, { selector: "input" }), "20-28456789-8");
    await userEvent.click(screen.getByRole("button", { name: "Delegar con el robot" }));

    await waitFor(() => expect(starts).toEqual([{ consent: true, loginCuit: "20284567898", fiscalKey: "clave-de-prueba", expectedRevision: 3 }]));
    expect(await screen.findByText("En curso")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Clave fiscal/, { selector: "input" })).not.toBeInTheDocument();
  });

  it("shows each side in steps while it works and offers to check while the platform still has to accept (RB2-A)", async () => {
    run = {
      enabled: true,
      company: side({ state: "Succeeded", completedSteps: ["company.login", "company.delegate.wsfe", "company.point-of-sale"], outputs: { "company.point-of-sale": "2" } }),
      platform: side({ state: "Waiting", completedSteps: ["platform.login", "platform.certificate"], failure: "Unavailable", failedStep: "platform.accept",
        nextAttemptAtUtc: "2026-11-11T15:40:00Z" }),
    };
    renderZone();

    const company = await screen.findByRole("region", { name: "Con tu clave" });
    expect(within(company).getByText("Delegar «Facturación electrónica» en ArquitecturaBase")).toBeInTheDocument();
    expect(within(company).getByText("Dar de alta el punto de venta de web service")).toBeInTheDocument();
    const platform = screen.getByRole("region", { name: "Con la clave de ArquitecturaBase" });
    expect(within(platform).getByText("Crear el certificado de esta instalación")).toBeInTheDocument();
    expect(within(platform).getByText(/ARCA no respondió\. Vuelve a probar a las/)).toBeInTheDocument();
    expect(screen.getByText("Falta que la plataforma acepte")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Comprobar" }));
    await waitFor(() => expect(tests).toBe(1));
  });

  it("goes back to the form with the error under the key when ARCA rejected the sign-in", async () => {
    run = { enabled: true, company: side({ state: "Failed", failure: "LoginRejected", failedStep: "company.login" }), platform: side({ state: "Waiting" }) };
    renderZone();

    expect(await screen.findByText("ARCA no aceptó la CUIT o la clave fiscal. El robot no vuelve a probar solo.")).toBeInTheDocument();
    expect(guides).toHaveLength(0);
  });

  it("opens the guide where the robot stopped, with what it did, and lets the person try the robot again (RB3-A)", async () => {
    run = {
      enabled: true,
      company: side({ state: "Failed", failure: "ScreenChanged", failedStep: "company.point-of-sale", completedSteps: ["company.login", "company.delegate.wsfe"] }),
      platform: side({ state: "Waiting" }),
    };
    renderZone();

    expect(await screen.findByText(/una pantalla de ARCA no era la esperada/)).toBeInTheDocument();
    expect(screen.getByText("Guía de la etapa 5")).toBeInTheDocument();
    expect(guides.at(-1)).toEqual({ step: "company.point-of-sale", done: ["company.delegate.wsfe"], doneLabel: "Lo hizo el robot" });

    await userEvent.click(screen.getByRole("button", { name: "Probar otra vez con el robot" }));
    expect(await screen.findByLabelText(/Clave fiscal/, { selector: "input" })).toHaveValue("");
  });

  it("lets the person follow the guide by hand and hands the rest to the platform (RB3-A)", async () => {
    run = { enabled: true, company: side({ state: "Failed", failure: "Captcha", failedStep: "company.login" }), platform: side({ state: "Waiting" }) };
    let completions = 0;
    server.use(http.post("/api/arca/connection/robot-runs/current/manual-completion", () => {
      completions++;
      run = { enabled: true, company: side({ state: "Succeeded", completedSteps: [] }), platform: side({ state: "Waiting" }) };
      return HttpResponse.json(run, { status: 202 });
    }));
    renderZone();

    await userEvent.click(await screen.findByRole("button", { name: "Verificar la delegación" }));

    expect(await screen.findByText("Falta que la plataforma acepte")).toBeInTheDocument();
    expect(completions).toBe(1);
    expect(within(screen.getByRole("region", { name: "Con tu clave" })).queryByText(/Pendiente/)).not.toBeInTheDocument();
  });

  it("tries the platform key ARCA rejected again only when asked (H5)", async () => {
    run = { enabled: true, company: side({ state: "Succeeded", completedSteps: [] }),
      platform: side({ state: "Failed", failure: "LoginRejected", failedStep: "platform.login" }) };
    let rearms = 0;
    server.use(http.post("/api/arca/connection/robot-runs/current/platform-rearm", () => {
      rearms++;
      run = { enabled: true, company: side({ state: "Succeeded", completedSteps: [] }), platform: side({ state: "Waiting" }) };
      return HttpResponse.json(run, { status: 202 });
    }));
    renderZone();

    expect(await screen.findByText(/no la vuelve a probar solo/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Volver a probar la clave de la plataforma" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Volver a probar la clave de la plataforma" })).not.toBeInTheDocument());
    expect(rearms).toBe(1);
  });

  it("tells that the platform finishes by hand when its side stopped", async () => {
    run = {
      enabled: true,
      company: side({ state: "Succeeded", completedSteps: ["company.login", "company.delegate.wsfe"] }),
      platform: side({ state: "Failed", failure: "ScreenChanged", failedStep: "platform.accept", completedSteps: ["platform.login", "platform.certificate"] }),
    };
    renderZone();

    expect(await screen.findByText("La plataforma tiene que terminar este paso a mano; ya le avisamos.")).toBeInTheDocument();
    expect(guides).toHaveLength(0);
  });

  it("folds with the point of sale when both sides finished", async () => {
    run = {
      enabled: true,
      company: side({ state: "Succeeded", completedSteps: ["company.login", "company.delegate.wsfe", "company.point-of-sale"], outputs: { "company.point-of-sale": "5" } }),
      platform: side({ state: "Succeeded", completedSteps: ["verify"] }),
    };
    renderZone();

    expect(await screen.findByText("Delegada · punto de venta 0005")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Con tu clave" })).not.toBeInTheDocument();
  });

  it("shows the progress to a reader without the form", async () => {
    run = { enabled: true, company: side({ currentStep: "company.delegate.wsfe", completedSteps: ["company.login"] }), platform: side({ state: "Waiting" }) };
    renderZone(false);

    expect(await screen.findByRole("region", { name: "Con tu clave" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Clave fiscal/, { selector: "input" })).not.toBeInTheDocument();
  });
});
