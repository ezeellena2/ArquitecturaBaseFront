import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/mocks/server";
import { receivedDocumentsPageFixture } from "@/test/visual/receivedDocumentFixtures";
import { createDocumentFormDraft, fetchDocumentFormProposal, readDocumentFormDraft, readDocumentFormProposal, requestDocumentFormProposal } from "./documentFormProposals";

// «Armar formulario con la IA» (DOC6, task 14): strict guards on the backend's shape, with synthetic bodies until the coordinator exports
// the cohort `forms-documents-http` (no *HttpContract test until then).
const id = (n: number) => `0199b0c0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const requestId = id(901);
const unclassified = receivedDocumentsPageFixture().items.filter(item => item.state === "unclassified");
const topic = { id: id(951), name: "tickets de combustible" };
// What the assistant proposed (propose-form@2): the form with what each question read in the first document, its reading on and no
// similar standard.
const content = {
  culture: "es", name: "Tickets de combustible", prefix: "TCB", submitLabel: "Cargar ticket",
  questions: [
    { label: "Monto", type: "number", required: true, options: [], catalog: null, sample: "150000" },
    { label: "Estación", type: "shortText", required: false, options: [], catalog: null, sample: null },
    { label: "Comprobante", type: "document", required: false, options: [], catalog: null, sample: null },
  ],
  documentReading: { recognition: "Un ticket de carga de combustible." }, standard: null,
};
const proposal = { id: id(961), capability: "forms.authoring.propose-form", version: 2, content };
// Asked for one unclassified document, while the assistant builds it; asked for a group, with its proposal; and when it could not.
const pending = { requestId, state: "pending", failureCode: null, topic: null, documents: [unclassified[0]], proposal: null, definitionId: null };
const completed = { ...pending, state: "completed", topic, documents: unclassified, proposal };
const failed = { ...pending, state: "failed", failureCode: "Ai.Assistant.ProviderUnavailable" };
const twenty = Array.from({ length: 20 }, (_, n) => ({ ...unclassified[0], id: id(1000 + n) }));
const { definitionId: _definitionId, ...withoutDraft } = completed;
const { topic: _topic, ...withoutTopic } = completed;

describe("the guards", () => {
  it("read a request while it is built, once it proposed a form, when it could not and with the draft it created", () => {
    expect(readDocumentFormProposal(pending)).toEqual(pending);
    expect(readDocumentFormProposal(completed)).toEqual(completed);
    expect(readDocumentFormProposal(failed)).toEqual(failed);
    // The draft «Crear borrador» created stays, also once the engine no longer knows the request.
    expect(readDocumentFormProposal({ ...completed, definitionId: id(971) }).definitionId).toBe(id(971));
    expect(readDocumentFormProposal({ ...failed, failureCode: "Forms.ReceivedDocument.ProposalNotFound", definitionId: id(971) }).definitionId).toBe(id(971));
    // The assistant finished without a form, and the documents of a request that the inbox already deleted.
    expect(readDocumentFormProposal({ ...failed, failureCode: "Forms.ReceivedDocument.NoFormProposal", documents: [] }).documents).toEqual([]);
    // A group is built from up to 20 documents.
    expect(readDocumentFormProposal({ ...completed, documents: twenty }).documents).toHaveLength(20);
    // A similar standard of the library and a catalog question.
    const standard = { key: "transfer-receipt", name: "Comprobante de transferencia" };
    const catalog = { label: "Estación", type: "catalog", required: false, options: [], catalog: { id: id(981), name: "Estaciones" }, sample: "Estación Ruta 9" };
    const withStandard = { ...completed, proposal: { ...proposal, content: { ...content, questions: [content.questions[0], catalog], standard } } };
    expect(readDocumentFormProposal(withStandard)).toEqual(withStandard);
  });

  it("read the draft «Crear borrador» created", () => {
    expect(readDocumentFormDraft({ proposalId: proposal.id, definitionId: id(971) })).toEqual({ proposalId: proposal.id, definitionId: id(971) });
  });

  it.each<[string, unknown]>([
    ["an unknown member", { ...pending, private: true }],
    ["an unknown state", { ...pending, state: "running" }],
    ["a code of a request that did not fail", { ...pending, failureCode: "Ai.Assistant.Expired" }],
    ["a failure without its code", { ...failed, failureCode: null }],
    ["an empty code", { ...failed, failureCode: "" }],
    ["a completed request without its proposal", { ...completed, proposal: null }],
    ["a proposal of a request that is not completed", { ...pending, proposal }],
    ["a proposal of a failed request", { ...failed, proposal }],
    ["a proposal of another capability", { ...completed, proposal: { ...proposal, capability: "forms.authoring.propose-catalog" } }],
    ["a proposal of version 1", { ...completed, proposal: { ...proposal, version: 1 } }],
    ["a proposal without its identity", { ...completed, proposal: { ...proposal, id: "proposal" } }],
    ["a proposal without what each question read", { ...completed, proposal: { ...proposal, content: { ...content, questions: content.questions.map(({ sample: _sample, ...question }) => question) } } }],
    ["a proposal without questions", { ...completed, proposal: { ...proposal, content: { ...content, questions: [] } } }],
    ["a proposal with an unknown member", { ...completed, proposal: { ...proposal, reason: "PRIVATE" } }],
    ["a topic without its name", { ...completed, topic: { ...topic, name: "" } }],
    ["a topic without its identity", { ...completed, topic: { ...topic, id: "tickets" } }],
    ["a document twice", { ...completed, documents: [unclassified[0], unclassified[0]] }],
    ["more documents than a request takes", { ...completed, documents: [...twenty, { ...unclassified[0], id: id(1020) }] }],
    ["a document out of the inbox's contract", { ...pending, documents: [{ ...unclassified[0], forReview: true }] }],
    ["a draft that is not an identity", { ...completed, definitionId: "draft" }],
    ["no draft", withoutDraft],
    ["no topic", withoutTopic],
    ["a request that is not an identity", { ...pending, requestId: "request" }],
  ])("reject a request with %s", (_case, body) => {
    expect(() => readDocumentFormProposal(body)).toThrow("Unsupported form response.");
  });

  it.each<[string, unknown]>([
    ["no draft", { proposalId: proposal.id, definitionId: null }],
    ["an unknown member", { proposalId: proposal.id, definitionId: id(971), requestId }],
    ["a proposal that is not an identity", { proposalId: "proposal", definitionId: id(971) }],
  ])("reject a created draft with %s", (_case, body) => {
    expect(() => readDocumentFormDraft(body)).toThrow("Unsupported form response.");
  });
});

describe("the requests", () => {
  it("ask for a form from one document or from a group, never cached, and check the request asked", async () => {
    const bodies: unknown[] = []; const caches: RequestCache[] = [];
    server.use(http.post("/api/forms/documents/form-proposals", async ({ request }) => {
      const body = await request.json() as { topicId?: string };
      bodies.push(body); caches.push(request.cache);
      return HttpResponse.json(body.topicId ? completed : pending, { status: 202 });
    }));
    expect(await requestDocumentFormProposal({ requestId, documentId: unclassified[0]!.id })).toEqual(pending);
    expect(await requestDocumentFormProposal({ requestId, topicId: topic.id })).toEqual(completed);
    expect(bodies).toEqual([{ requestId, documentId: unclassified[0]!.id }, { requestId, topicId: topic.id }]);
    expect(caches).toEqual(["no-store", "no-store"]);
    // The answer of another request is not this one.
    await expect(requestDocumentFormProposal({ requestId: id(902), documentId: unclassified[0]!.id })).rejects.toThrow("Unsupported form response.");
  });

  it("read a request by its route, never cached, and compose the route only with an identity", async () => {
    let cache: RequestCache | undefined;
    server.use(http.get("/api/forms/documents/form-proposals/:requestId", ({ request, params }) => {
      cache = request.cache;
      return HttpResponse.json(params.requestId === requestId ? failed : { ...failed, requestId: id(903) });
    }));
    expect(await fetchDocumentFormProposal(requestId)).toEqual(failed);
    expect(cache).toBe("no-store");
    await expect(fetchDocumentFormProposal(id(902))).rejects.toThrow("Unsupported form response.");
    await expect(fetchDocumentFormProposal("../counts")).rejects.toThrow("Unsupported form response.");
  });

  it("create the draft from the edited proposal, and the same request again answers the draft it created", async () => {
    let body: unknown; let cache: RequestCache | undefined;
    server.use(http.post("/api/forms/definitions/document-proposals", async ({ request }) => {
      body = await request.json(); cache = request.cache;
      return HttpResponse.json({ proposalId: proposal.id, definitionId: id(971) }, { status: 201 });
    }));
    const draft = { requestId, proposalId: proposal.id, name: "Tickets de combustible", prefix: "TCB", submitLabel: "Cargar ticket", recognition: "Un ticket de carga de combustible.",
      questions: [{ label: "Monto", type: "number", required: true, options: [], catalogId: null }, { label: "Estación", type: "catalog", required: false, options: [], catalogId: id(981) },
        { label: "Combustible", type: "choice", required: true, options: ["Nafta", "Gasoil"], catalogId: null }] } as const;
    expect(await createDocumentFormDraft(draft)).toEqual({ proposalId: proposal.id, definitionId: id(971) });
    expect(body).toEqual(draft);
    expect(cache).toBe("no-store");
    // The server answers a request that already created its draft with that draft and the proposal it came from, whatever the body names.
    expect(await createDocumentFormDraft({ ...draft, proposalId: id(962) })).toEqual({ proposalId: proposal.id, definitionId: id(971) });
  });
});
