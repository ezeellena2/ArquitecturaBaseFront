import { expect, it } from "vitest";
import { readApprovalTask } from "./approvals";
import { approvalTaskFixture } from "@/test/approvalFixtures";
it("reads approval metadata without record values", () => expect(readApprovalTask(approvalTaskFixture())).toEqual(approvalTaskFixture()));
it("rejects private values and unknown states without echoing them", () => { expect(()=>readApprovalTask({...approvalTaskFixture(),values:"private answer"})).toThrow("Invalid form approval contract.");expect(()=>readApprovalTask({...approvalTaskFixture(),state:"Unknown"})).toThrow("Invalid form approval contract."); });
