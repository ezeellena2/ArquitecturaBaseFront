import {describe,expect,it} from "vitest";
import {uniquePublicationIssues} from "./publicationPresentation";
const issue={channelId:"WhatsApp",code:"WhatsApp.Flow.ValidationFailed",path:"channel",fieldId:null,choiceId:null,culture:"en" as const,message:"WhatsApp rejected this form.",limit:null};
describe("Publication diagnostics",()=>{it("collapses repeated channel rejection while retaining distinct culture, reason and field",()=>{const differentCulture={...issue,culture:"es" as const};const differentReason={...issue,code:"Other"};const differentField={...issue,fieldId:"01990000-0000-7000-8000-000000000010"};expect(uniquePublicationIssues([issue,issue,differentCulture,issue,differentReason,differentField])).toEqual([issue,differentCulture,differentReason,differentField]);});});
