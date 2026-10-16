import { z } from "zod";
import { expect, it } from "vitest";
import { http } from "msw";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { readResponseWorkflow, fetchResponseWorkflow, continueResponseAction } from "./workflow";
const identity = z.object({ recordId: z.string().uuid() });
it("reads every durable action state and fixed PDF metadata from actual workflow bodies", () => {
  const cohort = httpCohort("workflow"); const source = cohort.verify(); expect(source.producer).toContain("FormWorkflowHttpTests"); expect(source.producer).toContain("FormPdfHttpTests");
  for (const [name, state] of [["waiting-es", "Waiting"], ["running-es", "Running"], ["completed-en", "Completed"], ["failed-es", "Failed"], ["uncertain-es", "Uncertain"], ["not-applicable-es", "NotApplicable"]]) {
    const body = cohort.json(name + ".json"); const parsed = readResponseWorkflow(body, identity.parse(body).recordId);
    expect(parsed.actions[0].state).toBe(state);
  }
  const emitted = cohort.json("pdf-completed-es.json"); const workflow = readResponseWorkflow(emitted, identity.parse(emitted).recordId);
  expect(workflow.recordState).toBe("Approved"); expect(workflow.task?.state).toBe("Approved"); expect(workflow.documents).toHaveLength(1);
  expect(workflow.documents[0]).toMatchObject({ culture: "es" }); expect(workflow.documents[0].size).toBeGreaterThan(0);
});
it("consults and retries the captured execution identities through the real adapters", async () => {
  const cohort = httpCohort("workflow"); const body = cohort.json("uncertain-es.json"); const recordId = identity.parse(body).recordId;
  const workflow = readResponseWorkflow(body, recordId); const path = "/api/forms/records/" + recordId;
  server.use(http.get(path + "/workflow", () => cohort.response("uncertain-es.json")), http.post(path + "/actions/" + workflow.actions[0].id + "/consult", () => cohort.response("consult-es.json", 202)));
  expect(await fetchResponseWorkflow(recordId)).toEqual(workflow); expect(await continueResponseAction(recordId, workflow.actions[0].id, "consult")).toEqual(cohort.json("consult-es.json"));
  const failedBody = cohort.json("failed-en.json"); const failedId = identity.parse(failedBody).recordId; const failed = readResponseWorkflow(failedBody, failedId);
  server.use(http.post("/api/forms/records/" + failedId + "/actions/" + failed.actions[0].id + "/retry", () => cohort.response("retry-en.json", 202)));
  expect(await continueResponseAction(failedId, failed.actions[0].id, "retry")).toEqual(cohort.json("retry-en.json"));
});
