import { expect, it } from "vitest";
import { workflowNextAction } from "./workflow";
it("consults an uncertain action before allowing any retry and never repeats a confirmed action", () => {
  expect(workflowNextAction({ state: "Uncertain", canConsult: true, canRetry: true })).toBe("consult");
  expect(workflowNextAction({ state: "Uncertain", canConsult: false, canRetry: true })).toBeNull();
  expect(workflowNextAction({ state: "Failed", canConsult: false, canRetry: true })).toBe("retry");
  for (const state of ["Completed", "Waiting", "Running", "NotApplicable"] as const)
    expect(workflowNextAction({ state, canConsult: true, canRetry: true })).toBeNull();
});
