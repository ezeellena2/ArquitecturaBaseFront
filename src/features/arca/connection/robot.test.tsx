import { useQuery } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { arcaConnectionQueryKey, fetchArcaConnection } from "./api";
import { useArcaRobotRun, type ArcaRobotRun, type ArcaRobotSide } from "./robot";

vi.mock("react-oidc-context", async () => ({ ...(await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context")), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }));

const side = (overrides: Partial<ArcaRobotSide>): ArcaRobotSide => ({
  state: "Running", currentStep: null, completedSteps: [], outputs: {}, failure: null, failedStep: null, nextAttemptAtUtc: null,
  startedAtUtc: "2026-11-11T12:00:00Z", finishedAtUtc: null, ...overrides,
});

let run: ArcaRobotRun;
let connectionReads: number;
beforeEach(() => {
  run = { enabled: true, company: side({ state: "Succeeded", completedSteps: ["company.login"] }), platform: side({ state: "Waiting", completedSteps: ["platform.login"] }) };
  connectionReads = 0;
  server.use(
    http.get("/api/arca/connection/robot-runs/current", () => HttpResponse.json(run)),
    http.get("/api/arca/connection", () => {
      connectionReads++;
      return HttpResponse.json({ status: "Unverified", revision: connectionReads });
    }),
  );
});

/// La pantalla: la conexión y el robot, leídos a la vez.
function Screen() {
  useQuery({ queryKey: arcaConnectionQueryKey, queryFn: ({ signal }) => fetchArcaConnection(signal) });
  const robot = useArcaRobotRun();
  return <p>{robot.data?.platform?.state ?? "…"}</p>;
}

describe("the robot run", () => {
  it("reads the connection again when the robot moves on, so the test, the families and a retry see what it changed", async () => {
    renderWithProviders(<Screen />);
    expect(await screen.findByText("Waiting")).toBeInTheDocument();
    await waitFor(() => expect(connectionReads).toBe(1));

    run = { ...run, platform: side({ state: "Succeeded", completedSteps: ["platform.login", "platform.certificate", "verify"] }) };

    expect(await screen.findByText("Succeeded", undefined, { timeout: 5000 })).toBeInTheDocument();
    await waitFor(() => expect(connectionReads).toBe(2));
  });
});
