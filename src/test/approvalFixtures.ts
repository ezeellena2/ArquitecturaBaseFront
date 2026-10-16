import type {ApprovalTask} from "@/features/business-forms/api/approvals";
import {responseFormId,responseRecordId} from "./responseFixtures";
export const approvalTaskId="0199a0c0-0000-7000-8000-000000000070";
export const approvalTaskFixture = ():ApprovalTask => ({id:approvalTaskId,definitionId:responseFormId,recordId:responseRecordId,number:"VIS-00001",formName:"Visita",author:{userId:approvalTaskId,displayName:"Ana"},role:{id:approvalTaskId,name:"Supervisión"},requestedAtUtc:"2026-10-16T12:00:00Z",revision:1,state:"Open",canDecide:true,cannotDecideReason:null,decidedAtUtc:null,decidedBy:null,reason:null});
