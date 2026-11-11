import { describe, expect, it } from "vitest";
import type { ArcaRobotSide } from "./robot";
import { robotIsMoving } from "./robot";
import { companyStepsOf, guideFallbackOf, platformStepsOf, robotViewOf, stepsOf } from "./robotSteps";

const side = (overrides: Partial<ArcaRobotSide>): ArcaRobotSide => ({
  state: "Running", currentStep: null, completedSteps: [], outputs: {}, failure: null, failedStep: null, nextAttemptAtUtc: null,
  startedAtUtc: "2026-11-11T12:00:00Z", finishedAtUtc: null, ...overrides,
});

describe("the robot steps", () => {
  it("plan each side with the guide keys of stage 5", () => {
    expect(companyStepsOf(["wsfe"], ["company.point-of-sale"])).toEqual(["company.login", "company.delegate.wsfe", "company.point-of-sale"]);
    expect(platformStepsOf(["wsfe"], ["ws_sr_constancia_inscripcion"])).toEqual([
      "platform.login", "platform.certificate", "platform.authorize.ws_sr_constancia_inscripcion", "platform.accept", "platform.assign.wsfe", "verify",
    ]);
  });

  it("mark each step done, running, failed or pending, and add the ones that were not planned", () => {
    const planned = companyStepsOf(["wsfe"], []);
    expect(stepsOf(side({ completedSteps: ["company.login"], currentStep: "company.delegate.wsfe" }), planned)).toEqual([
      { key: "company.login", state: "done" }, { key: "company.delegate.wsfe", state: "running" },
    ]);
    expect(stepsOf(side({ state: "Failed", completedSteps: ["company.login", "company.delegate.wsfe"], failure: "ScreenChanged", failedStep: "company.point-of-sale" }), planned)
      .map(step => step.state)).toEqual(["done", "done", "failed"]);
    expect(stepsOf(null, planned).every(step => step.state === "pending")).toBe(true);
  });

  it("treat an interrupted run as stopped at the step it was doing", () => {
    expect(stepsOf(side({ state: "Interrupted", currentStep: "company.delegate.wsfe", completedSteps: ["company.login"] }), companyStepsOf(["wsfe"], []))
      .map(step => step.state)).toEqual(["done", "failed"]);
  });

  it("go back to the form on a rejected login and to the guide on anything else that stops the client", () => {
    expect(robotViewOf(null, null)).toBe("form");
    expect(robotViewOf(side({ state: "Failed", failure: "LoginRejected" }), null)).toBe("form");
    expect(robotViewOf(side({ state: "Failed", failure: "Captcha" }), null)).toBe("guide");
    expect(robotViewOf(side({ state: "Interrupted" }), null)).toBe("guide");
    expect(robotViewOf(side({ state: "Running" }), null)).toBe("progress");
    expect(robotViewOf(side({ state: "Succeeded" }), side({ state: "Waiting" }))).toBe("progress");
    expect(robotViewOf(side({ state: "Succeeded" }), side({ state: "Succeeded" }))).toBe("done");
  });

  it("open the guide at the step that stopped, or at its first step when the robot never got in", () => {
    expect(guideFallbackOf(side({ state: "Failed", failure: "ScreenChanged", failedStep: "company.point-of-sale", completedSteps: ["company.login", "company.delegate.wsfe"] })))
      .toEqual({ step: "company.point-of-sale", done: ["company.delegate.wsfe"] });
    expect(guideFallbackOf(side({ state: "Failed", failure: "Captcha", failedStep: "company.login" }))).toEqual({ step: null, done: [] });
  });

  it("poll while a side works or the platform waits for nothing but itself", () => {
    expect(robotIsMoving(undefined)).toBe(false);
    expect(robotIsMoving({ enabled: true, company: side({ state: "Running" }), platform: side({ state: "Waiting" }) })).toBe(true);
    expect(robotIsMoving({ enabled: true, company: side({ state: "Succeeded" }), platform: side({ state: "Waiting" }) })).toBe(true);
    expect(robotIsMoving({ enabled: true, company: side({ state: "Failed" }), platform: side({ state: "Waiting" }) })).toBe(false);
    expect(robotIsMoving({ enabled: true, company: side({ state: "Succeeded" }), platform: side({ state: "Succeeded" }) })).toBe(false);
  });
});
