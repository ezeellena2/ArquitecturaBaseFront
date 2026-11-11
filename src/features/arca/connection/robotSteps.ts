import type { ArcaRobotSide } from "./robot";

export type RobotStepState = "done" | "running" | "failed" | "pending";
export interface RobotStep { key: string; state: RobotStepState }

/// Los pasos del lado del cliente: entrar, delegar cada servicio y los que aportan las familias (el punto de venta).
export const companyStepsOf = (delegated: readonly string[], familySteps: readonly string[]) =>
  ["company.login", ...delegated.map(service => `company.delegate.${service}`), ...familySteps];

/// Los pasos del lado de la plataforma: entrar, el certificado de la instalación (RB5-A), autorizar sus consultas, aceptar,
/// asignar cada servicio delegado al computador fiscal y confirmar con ARCA.
export const platformStepsOf = (delegated: readonly string[], authorized: readonly string[]) => [
  "platform.login", "platform.certificate", ...authorized.map(service => `platform.authorize.${service}`), "platform.accept",
  ...delegated.map(service => `platform.assign.${service}`), "verify",
];

/// Cada paso con su estado (RB2-A): hecho, en curso, frenado o pendiente. Un paso que no estaba previsto pero el robot hizo
/// o está haciendo se suma al final, para que la lista no mienta. Un lado terminado tiene todo hecho, también lo que la
/// persona hizo a mano con la guía (RB3-A).
export function stepsOf(side: ArcaRobotSide | null, planned: readonly string[]): RobotStep[] {
  const keys = [...planned];
  for (const key of [...(side?.completedSteps ?? []), side?.currentStep, side?.failedStep]) if (key && !keys.includes(key)) keys.push(key);
  const stopped = side?.state === "Failed" || side?.state === "Interrupted" || (side?.state === "Waiting" && side.failure !== null);
  const failedAt = side?.failedStep ?? (side?.state === "Interrupted" ? side.currentStep : null);
  return keys.map(key => ({
    key,
    state: side?.state === "Succeeded" || side?.completedSteps.includes(key) ? "done"
      : stopped && key === failedAt ? "failed"
      : side?.state === "Running" && key === side.currentStep ? "running"
      : "pending",
  }));
}

/// Lo que la pantalla muestra del lado del cliente: el formulario, el avance, la guía de la etapa 5 o la zona plegada.
export type RobotView = "form" | "progress" | "guide" | "done";

/// Un ingreso rechazado vuelve al formulario con el error debajo de la clave (RB1-A); lo demás que frena al cliente lleva a
/// la guía en ese paso (RB3-A). Terminado el cliente, el avance sigue hasta que la plataforma confirma.
export function robotViewOf(company: ArcaRobotSide | null, platform: ArcaRobotSide | null): RobotView {
  if (!company) return "form";
  if (company.state === "Running") return "progress";
  if (company.state === "Failed" || company.state === "Interrupted") return company.failure === "LoginRejected" ? "form" : "guide";
  return platform?.state === "Succeeded" ? "done" : "progress";
}

/// Dónde abre la guía de la etapa 5 y qué marca «Lo hizo el robot». Frenado al entrar (un captcha, una validación extra o
/// un servidor caído antes de entrar), la guía abre en su primer paso.
export function guideFallbackOf(company: ArcaRobotSide): { step: string | null; done: string[] } {
  const stoppedAt = company.failedStep ?? company.currentStep;
  return {
    step: stoppedAt === null || stoppedAt === "company.login" ? null : stoppedAt,
    done: company.completedSteps.filter(step => step !== "company.login"),
  };
}
