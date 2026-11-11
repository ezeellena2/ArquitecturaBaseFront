import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/httpClient";

/// Cómo ve la pantalla un lado del robot (ADR 0026 del backend). «Interrupted» es una corrida cuyo servidor se cayó.
export type ArcaRobotState = "Running" | "Waiting" | "Succeeded" | "Failed" | "Interrupted";
export type ArcaRobotFailure = "LoginRejected" | "Captcha" | "ExtraValidation" | "ScreenChanged" | "Unavailable" | "Interrupted";

/// Un lado del robot: el paso en curso, los hechos (claves de la guía de la etapa 5), lo que dejó cada paso (el punto de
/// venta) y, si se frenó, el motivo y el paso.
export interface ArcaRobotSide {
  state: ArcaRobotState; currentStep: string | null; completedSteps: string[]; outputs: Record<string, string>;
  failure: ArcaRobotFailure | null; failedStep: string | null; nextAttemptAtUtc: string | null; startedAtUtc: string; finishedAtUtc: string | null;
}

/// Si el robot está prendido en la instalación y cómo va cada lado; sin corrida, los dos son null.
export interface ArcaRobotRun { enabled: boolean; company: ArcaRobotSide | null; platform: ArcaRobotSide | null }

/// La clave viaja sólo en este pedido: no se guarda en ningún estado ni en la URL.
export interface StartArcaRobotRequest { consent: boolean; loginCuit: string; fiscalKey: string; expectedRevision: number }

/// El paso que aporta Facturación: el punto de venta de web service que dio de alta el robot.
export const robotPointOfSaleStep = "company.point-of-sale";

export const arcaRobotQueryKey = ["arca", "robot"] as const;
export const fetchArcaRobotRun = (signal?: AbortSignal) => api.get<ArcaRobotRun>("/api/arca/connection/robot-runs/current", { signal });
export const startArcaRobotRun = (request: StartArcaRobotRequest) => api.post<ArcaRobotRun>("/api/arca/connection/robot-runs", request);

/// Mientras algún lado trabaja, o la plataforma espera con el cliente terminado, el avance se vuelve a leer cada dos segundos.
export function robotIsMoving(run: ArcaRobotRun | undefined): boolean {
  if (!run?.company) return false;
  if (run.company.state === "Running") return true;
  return run.company.state === "Succeeded" && (run.platform?.state === "Running" || run.platform?.state === "Waiting");
}

/// El robot de la instalación: si está prendido y cómo va. Lo leen la elección del modo, la zona del robot y Facturación.
export function useArcaRobotRun(enabled = true) {
  return useQuery({
    queryKey: arcaRobotQueryKey,
    queryFn: ({ signal }) => fetchArcaRobotRun(signal),
    enabled,
    retry: false,
    refetchInterval: query => robotIsMoving(query.state.data) ? 2000 : false,
  });
}
