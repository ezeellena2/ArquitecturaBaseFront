import { expect, it } from "vitest";
import { http } from "msw";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { getThread, listChats, type Thread } from "./chat";
import { buildTimeline } from "../lib/timeline";
it("preserves automatic action origins through actual WhatsApp thread and timeline adapters", async () => {
  const cohort = httpCohort("whatsappActions"); const source = cohort.verify(); expect(source.producer).toContain("WhatsAppFormActionHttpTests");
  const original = cohort.json("thread-form-actions.json") as Thread;
  server.use(http.get("/api/whatsapp/chats/" + original.contact.id + "/messages", () => cohort.response("thread-form-actions.json")));
  const thread = await getThread(original.contact.id); const actions = buildTimeline(thread.messages, thread.outgoing).filter(item => item.origin === "FormAction");
  expect(actions.length).toBeGreaterThan(0);
  for (const action of actions) { expect(action.author).toBe("automatic"); expect(action.operatorUserId).toBeNull(); }
  expect(actions.some(item => item.kind === "Text")).toBe(true); expect(actions.some(item => item.kind === "Document")).toBe(true);
});
it("keeps restricted action captions out of threads and private text out of chat previews", async () => {
  const cohort = httpCohort("whatsappActions"); const original = cohort.json("thread-form-actions.json") as Thread;
  const restricted = cohort.json("thread-form-actions-restricted.json") as Thread;
  server.use(http.get("/api/whatsapp/chats/" + restricted.contact.id + "/messages", () => cohort.response("thread-form-actions-restricted.json")),
    http.get("/api/whatsapp/chats", () => cohort.response("chats-form-actions.json")));
  const thread = await getThread(restricted.contact.id); const actions = buildTimeline(thread.messages, thread.outgoing).filter(item => item.origin === "FormAction");
  expect(thread.canReadFormRecords).toBe(false); expect(actions.length).toBeGreaterThan(0); for (const action of actions) expect(action.body).toBeNull();
  const privateBodies = [...original.messages, ...original.outgoing].filter(item => item.origin === "FormAction" && item.body !== null).map(item => item.body!);
  expect(privateBodies.length).toBeGreaterThan(0);
  const chats = await listChats(1, "", false); const contact = chats.page.items.find(item => item.id === original.contact.id); expect(contact).toBeDefined();
  for (const body of privateBodies) expect(contact!.preview).not.toContain(body);
});
