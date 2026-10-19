// Unchanged controller HTTP bodies; provenance and SHA256 live with the fixtures.
import { whatsappFormsHttpJson as body } from "@/test/fixtures/whatsappFormsHttp";
import { describe, expect, it } from "vitest";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { ApiError } from "@/shared/api/ApiError";
import { parseChatForms, parseFormOutgoing, parseChatFormPreparation } from "./forms";
import type { Outgoing, Thread } from "./chat";
import { buildTimeline } from "../lib/timeline";
for (const culture of ["es", "en"] as const) describe("Actual WhatsApp form HTTP contract " + culture, () => {
  const choices = parseChatForms(body(culture, "choices"));
  const selected = choices.page.items[0]!;
  const pending = body(culture, "send-pending") as Outgoing;
  const thread = body(culture, "thread-pending") as Thread;
  const actor = pending.operatorUserId;
  function parse(name: string) {
    if (!actor) throw new Error("A manually sent form must have an operator.");
    const captured = body(culture, name) as Outgoing;
    const contactId = captured.recoveryPath!.split("/")[4]!;
    return parseFormOutgoing(captured, { requestId: captured.requestId, definitionId: selected.definitionId,
      versionId: selected.versionId, expectedModeRevision: thread.contact.modeRevision,
      expectedRecipientContextRevision: choices.recipientContextRevision!, message: captured.body! }, actor, contactId);
  }
  it("reads the sealed complete maps and recipient context without fallback", () => {
    expect(choices.recipientCulture).toBe(culture);
    expect(choices.recipientContextRevision).toBe(thread.contact.formEligibility?.recipientContextRevision);
    expect(selected.name).toEqual({es:"Formulario",en:"Form"});
    expect(selected.submitLabel).toEqual({es:"Completar",en:"Submit"});
    expect(thread.contact.linkedAccount?.isActive).toBe(true);
  });
  it("reads the complete presentation culture and real recipient revision from preparation", () => {
    expect(parseChatFormPreparation(body(culture, "preparation"))).toMatchObject({culture,recipientContextRevision:choices.recipientContextRevision,preparation:{canSend:true,catalogs:[],issues:[]}});
  });
  it("reads acceptance and every captured durable state using the same form identity", () => {
    for (const [name, state] of [["send-pending","Pending"],["outgoing-pending","Pending"],["outgoing-accepted","Accepted"],
      ["outgoing-uncertain","Uncertain"],["outgoing-failed","Failed"]]) {
      expect(parse(name!)).toMatchObject({ kind:"Flow", state, origin:"Conversation", form:{definitionId:selected.definitionId,
        versionId:selected.versionId, name:selected.name, culture} });
    }
  });
  it("classifies the real forbidden and conflict ProblemDetails", () => {
    const forbidden = body(culture, "choices-forbidden") as {status:number;code:string;detail:string};
    expect(errorFeedback(new ApiError(forbidden.status, forbidden))).toMatchObject({kind:"forbidden"});
    for (const name of ["send-context-changed", "send-version-unavailable"]) {
      const problem = body(culture, name) as {status:number;code:string;detail:string};
      expect(errorFeedback(new ApiError(problem.status, problem), {writing:true, conflictCodes:[problem.code]})).toMatchObject({kind:"conflict"});
    }
  });
  it("starts with an actual empty pre-send thread", () => {
    const before = body<Thread>(culture, "thread-before-send");
    expect(before.messages).toEqual([]);
    expect(before.outgoing).toEqual([]);
    expect(before.contact.id).toBe(thread.contact.id);
  });
  it.each(["Failed", "Uncertain"] as const)("preserves durable Flow identity in a %s thread", state => {
    const captured = body<Thread>(culture, "thread-" + state.toLowerCase());
    const original = body<Outgoing>(culture, "send-before-" + state.toLowerCase());
    const items = buildTimeline(captured.messages, captured.outgoing);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({source:"outgoing",kind:"Flow",operation:{state,requestId:original.requestId},form:original.form});
  });
  it("keeps Flow identity and sealed presentation in the pending thread", () => {
    const items = buildTimeline(thread.messages, thread.outgoing);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({source:"outgoing",kind:"Flow",form:{definitionId:selected.definitionId,
      versionId:selected.versionId,name:selected.name,culture}});
  });
  it("keeps the confirmed form card when history is reloaded without a private draft", () => {
    for (const name of ["thread-accepted", "thread-reloaded"]) {
      const reloaded = body(culture, name) as Thread;
      const items = buildTimeline(reloaded.messages, reloaded.outgoing);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({source:"message",kind:"Flow",form:{definitionId:selected.definitionId,
        versionId:selected.versionId,name:selected.name,culture}});
    }
  });
});
