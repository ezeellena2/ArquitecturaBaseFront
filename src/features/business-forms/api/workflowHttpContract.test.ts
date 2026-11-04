import { z } from "zod";
import { expect, it } from "vitest";
import { http } from "msw";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { readResponseWorkflow, fetchResponseWorkflow, continueResponseAction, retryResponseRecipient } from "./workflow";
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

// RT1-A: a role notice with one person to retry, the 202 of retrying that person and the notice once it went out.
it("retries one person of a role notice through the real adapter with the captured revision", async () => {
  const cohort = httpCohort("workflow");
  const offered = cohort.json("role-retry-offered-es.json"); const recordId = identity.parse(offered).recordId;
  const notice = readResponseWorkflow(offered, recordId).actions[0];
  expect(notice).toMatchObject({ kind: "NotifyRole", state: "Completed", canRetry: false });
  const people = notice.recipients.filter(recipient => recipient.canRetry);
  expect(people).toHaveLength(1); expect(people[0].state).toBe("Failed");
  expect(readResponseWorkflow(cohort.json("role-retry-offered-en.json"), recordId).actions[0].recipients.filter(recipient => recipient.canRetry)).toHaveLength(1);
  server.use(http.post("/api/forms/records/" + recordId + "/actions/" + notice.id + "/recipients/" + people[0].user.userId + "/retry", () => cohort.response("role-retry-en.json", 202)));
  expect((await retryResponseRecipient(recordId, notice.id, people[0].user.userId, { expectedRevision: notice.revision })).actions[0].state).toBe("Waiting");
  const sent = readResponseWorkflow(cohort.json("role-retried-en.json"), recordId).actions[0];
  expect(sent.state).toBe("Completed");
  expect(sent.recipients.every(recipient => recipient.state === "Accepted" && !recipient.canRetry)).toBe(true);
});

// The joint export supplies this new body; notice text is asserted by its backend producer.
it("keeps completed notices and English PDF metadata when a catalog item uses its original text", async () => {
  const cohort = httpCohort("workflow");
  const body = cohort.json("e2e-catalog-original-item-en.json");
  const recordId = identity.parse(body).recordId;
  const workflow = readResponseWorkflow(body, recordId);
  expect(workflow.recordState).toBe("Approved");
  expect(workflow.task?.state).toBe("Approved");
  expect(workflow.actions).toHaveLength(4);
  expect(workflow.actions.every(action => action.state === "Completed")).toBe(true);
  const recipients = workflow.actions.flatMap(action => action.recipients);
  expect(recipients).toHaveLength(2);
  expect(recipients.every(recipient => recipient.state === "Accepted")).toBe(true);
  expect(workflow.documents.map(document => document.culture).sort()).toEqual(["en", "es"]);
  expect(workflow.documents.find(document => document.culture === "en")?.name).toMatch(/^Final receipt-.+\.pdf$/);
  server.use(http.get("/api/forms/records/" + recordId + "/workflow", () => cohort.response("e2e-catalog-original-item-en.json")));
  expect(await fetchResponseWorkflow(recordId)).toEqual(workflow);
});
