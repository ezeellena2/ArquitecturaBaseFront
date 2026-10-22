import { expect, it } from "vitest";
import { readFormOverview } from "@/features/business-forms/api/overview";
import { readApprovalTask } from "@/features/business-forms/api/approvals";
import { readResponseWorkflow } from "@/features/business-forms/api/workflow";
import { createFormResponseFullFixtures, responseFullFixtureIds } from "./visual/formResponseFullFixtures";

it.each(["es", "en"] as const)("exposes a coherent pending journey for Read and Decide without authorizing writes (%s)", async language => {
  const fixture = createFormResponseFullFixtures(language, "responses-full-read-decide");
  const overview = readFormOverview(await (await fixture.handle(new Request("https://fixture.test/api/forms/overview")))!.json());
  expect(overview.forms.items[0]).toMatchObject({ pendingApprovalCount: 2, responseCount: 2, lastResponse: { state: "PendingApproval" } });
  expect(fixture.permissions).toEqual(["formrecords.read", "formapprovals.decide"]);
  const page = await (await fixture.handle(new Request("https://fixture.test/api/forms/approvals?definitionId=" + responseFullFixtureIds.form)))!.json() as { items: unknown[] };
  expect(page.items).toHaveLength(2);
  for (const body of page.items) {
    const task = readApprovalTask(body);
    const workflow = readResponseWorkflow(await (await fixture.handle(new Request("https://fixture.test/api/forms/records/" + task.recordId + "/workflow")))!.json(), task.recordId);
    expect(workflow).toMatchObject({ recordState: "PendingApproval", task: { id: task.id, state: "Open" } });
    expect((await fixture.handle(new Request("https://fixture.test/api/forms/approvals/" + task.id + "/decisions", { method: "POST", body: "{}" })))!.status).toBe(405);
  }
});
