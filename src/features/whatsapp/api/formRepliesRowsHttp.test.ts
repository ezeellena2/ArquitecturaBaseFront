import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { httpCohort } from "@/test/httpCohort";
import { whatsappFormsHttpBody, whatsappFormsHttpJson } from "@/test/fixtures/whatsappFormsHttp";
import { server } from "@/test/mocks/server";
import { getThread, type Thread } from "./chat";

// Real bytes of the joint export (WhatsAppRowsCompositionTests). This test never manufactures captures.
it("qualifies the reply with a block of rows and its producer from the joint run", () => {
  const manifest = httpCohort("whatsappForms").verify();
  expect(manifest.captures.map(item => item.name)).toEqual(expect.arrayContaining(["es/reply-rows.json", "en/reply-rows.json"]));
  expect(manifest.sources.some(item => item.path.endsWith("/WhatsAppRowsCompositionTests.cs"))).toBe(true);
});

it.each(["es", "en"] as const)("reads the block of a real reply with its three items (%s)", async culture => {
  const original = whatsappFormsHttpJson<Thread>(culture, "reply-rows");
  server.use(http.get("/api/whatsapp/chats/:id/messages", () => new HttpResponse(whatsappFormsHttpBody(culture, "reply-rows"), {
    headers: { "Content-Type": "application/json" } })));

  const thread = await getThread(original.contact.id);

  const reply = thread.messages.map(message => message.formReply).find(card => card?.state === "Completed" && card.values?.some(value => value.type === "group"));
  const block = reply?.state === "Completed" ? reply.values?.find(value => value.type === "group") : undefined;
  expect(block?.type === "group" ? block.value : []).toHaveLength(3);
});
