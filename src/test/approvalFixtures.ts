import {screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {ApprovalTask} from "@/features/business-forms/api/approvals";
import {responseFormId,responseRecordId} from "./responseFixtures";
export const approvalTaskId="0199a0c0-0000-7000-8000-000000000070";
export const approvalTaskFixture = ():ApprovalTask => ({id:approvalTaskId,definitionId:responseFormId,recordId:responseRecordId,number:"VIS-00001",formName:"Visita",author:{userId:approvalTaskId,displayName:"Ana"},role:{id:approvalTaskId,name:"Supervisión"},requestedAtUtc:"2026-10-16T12:00:00Z",revision:1,state:"Open",canDecide:true,cannotDecideReason:null,decidedAtUtc:null,decidedBy:null,reason:null});
/** Aprobar pregunta antes (tablero AP1-A): toca «Aprobar» donde está y confirma en su diálogo. */
export async function approveAndConfirm(scope: Pick<typeof screen, "findByRole"> = screen) {
  await userEvent.click(await scope.findByRole("button", { name: "Aprobar" }));
  const dialog = await screen.findByRole("dialog", { name: /^¿Aprobar / });
  await userEvent.click(within(dialog).getByRole("button", { name: "Aprobar" }));
}
