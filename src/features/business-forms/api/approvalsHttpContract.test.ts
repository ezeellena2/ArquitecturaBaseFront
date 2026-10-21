import { expect, it } from "vitest";
import { http } from "msw";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { readApprovalTask, fetchApprovalTasks, fetchApprovalCount, fetchApprovalTask, decideApprovalTask } from "./approvals";
it("reads pending and decided metadata without requiring record values from actual approval bodies", () => {
  const cohort = httpCohort("approvals"); const source = cohort.verify(); expect(source.producer).toContain("FormApprovalHttpTests");
  expect(readApprovalTask(cohort.json("task-open-es.json")).state).toBe("Open");
  for (const state of ["approved", "rejected"]) {
    const task = readApprovalTask(cohort.json("task-" + state + "-es.json")); expect(task.state).toBe(state === "approved" ? "Approved" : "Rejected"); expect(task.canDecide).toBe(false);
  }
});
it("uses the real page, count, task and decision adapters with unchanged HTTP captures", async () => {
  const cohort = httpCohort("approvals"); const task = readApprovalTask(cohort.json("task-open-es.json"));
  server.use(http.get("/api/forms/approvals", () => cohort.response("inbox-es.json")), http.get("/api/forms/approvals/count", () => cohort.response("count-es.json")),
    http.get("/api/forms/approvals/" + task.id, () => cohort.response("task-open-es.json")));
  expect(await fetchApprovalTasks({ page: 1, pageSize: 20, onlyMine: true })).toEqual(cohort.json("inbox-es.json"));
  expect(await fetchApprovalCount()).toEqual(cohort.json("count-es.json")); expect(await fetchApprovalTask(task.id)).toEqual(task);
  const decided = readApprovalTask(cohort.json("task-approved-es.json"));
  server.use(http.post("/api/forms/approvals/" + decided.id + "/decisions", () => cohort.response("decision-approved-es.json")));
  expect(await decideApprovalTask(decided.id, { expectedRevision: 1, decision: "Approved" })).toEqual(cohort.json("decision-approved-es.json"));
});
