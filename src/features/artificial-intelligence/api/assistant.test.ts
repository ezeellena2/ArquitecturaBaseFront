import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/test/mocks/server";
import { captureUploads } from "@/test/mocks/xhrUpload";
import { assistantApi } from "./assistant";
const requestId = "0199a0c0-0000-7000-8000-000000000333";
const audioRequestId = "0199a0c0-0000-7000-8000-000000000555";
const turn = {
  turnId: "0199a0c0-0000-7000-8000-000000000222",
  conversationId: "0199a0c0-0000-7000-8000-000000000111",
  requestId,
  ordinal: 1,
  conversationRevision: 2,
  turnRevision: 4,
  state: "completed",
  stage: "finished",
  contentAccess: "allowed",
  question: "¿Cuántos usuarios activos hay?",
  answer: {
    kind: "answer",
    text: "Hay tres usuarios activos.",
    evidenceIds: ["0199a0c0-0000-7000-8000-000000000444"],
  },
  evidences: [
    {
      id: "0199a0c0-0000-7000-8000-000000000444",
      sourceId: "users.summary",
      sourceVersion: 1,
      observedAtUtc: "2026-10-04T12:00:01Z",
      revision: null,
      destination: "users",
      requiredPermissions: ["users.read"],
      rows: [{ id: null, values: [{ label: "Activos", value: "3" }] }],
      isComplete: true,
    },
  ],
  failure: null,
  usage: { inputTokens: 20, outputTokens: 4, audioSeconds: null },
  culture: "es",
  timeZoneId: "America/Argentina/Buenos_Aires",
  submittedAtUtc: "2026-10-04T12:00:00Z",
  serverNowUtc: "2026-10-04T12:00:02Z",
  pollingAfterSeconds: 1,
  cancelRequestedAtUtc: null,
};
describe("assistant contract", () => {
  it("rejects a turn whose state is outside the published lowercase values", async () => {
    server.use(
      http.get("/api/ai/assistant/turns/:id", () =>
        HttpResponse.json({ ...turn, state: "Pending" }),
      ),
    );
    await expect(assistantApi.turn(requestId)).rejects.toThrow(
      "Invalid assistant contract.",
    );
  });
  it("rejects an acceptance receipt with fields outside the contract", async () => {
    server.use(
      http.post("/api/ai/assistant/turns", () =>
        HttpResponse.json(turn, { status: 202 }),
      ),
    );
    await expect(
      assistantApi.submit({
        requestId,
        conversationId: null,
        expectedRevision: null,
        expectedConnectionRevision: 7,
        question: turn.question,
      }),
    ).rejects.toThrow("Invalid assistant contract.");
  });
  it("reads a complete turn including usage and cancellation time", async () => {
    server.use(
      http.get("/api/ai/assistant/turns/:id", () => HttpResponse.json(turn)),
    );
    await expect(assistantApi.turn(requestId)).resolves.toEqual(turn);
  });
  it("reads a dictated turn with its recording and what the server heard", async () => {
    const dictated = { ...turn, question: "", audio: { requestId: audioRequestId, transcript: "Armame un formulario de visitas" } };
    server.use(http.get("/api/ai/assistant/turns/:id", () => HttpResponse.json(dictated)));
    await expect(assistantApi.turn(requestId)).resolves.toEqual(dictated);
    server.use(http.get("/api/ai/assistant/turns/:id", () => HttpResponse.json({ ...dictated, audio: { ...dictated.audio, extra: 1 } })));
    await expect(assistantApi.turn(requestId)).rejects.toThrow("Invalid assistant contract.");
  });
  it("uploads a recording in multipart under its own request and follows its normalization", async () => {
    const sends = captureUploads([{ status: 202,
      body: { requestId: audioRequestId, state: "pending", transcript: null, failure: null, pollingAfterSeconds: 1 } }]);
    server.use(http.get("/api/ai/assistant/audio/:id", () => HttpResponse.json(
      { requestId: audioRequestId, state: "completed", transcript: "Armame un formulario", failure: null, pollingAfterSeconds: 1 })));
    try {
      await expect(assistantApi.uploadAudio(audioRequestId, new Blob(["webm"], { type: "audio/webm;codecs=opus" })))
        .resolves.toMatchObject({ state: "pending", transcript: null });
      expect(sends[0].url).toBe("/api/ai/assistant/audio");
      expect(sends[0].body.get("requestId")).toBe(audioRequestId);
      expect((sends[0].body.get("file") as File).name).toBe("recording.webm");
      await assistantApi.uploadAudio(audioRequestId, new Blob(["mp4"], { type: "audio/mp4" }));
      expect((sends[1].body.get("file") as File).name).toBe("recording.m4a");
    } finally { vi.unstubAllGlobals(); }
    await expect(assistantApi.audio(audioRequestId)).resolves.toMatchObject({ state: "completed", transcript: "Armame un formulario" });
  });
  it("reads whether this person may attach a spreadsheet in the bootstrap, and a bootstrap without it as not attaching", async () => {
    const bootstrap = { availability: "available", connectionRevision: 7, suggestions: [], limits: { questionMaxLength: 4000 },
      configurationDestination: null, audio: false, attachments: true };
    server.use(http.get("/api/ai/assistant/bootstrap", () => HttpResponse.json(bootstrap)));
    await expect(assistantApi.bootstrap()).resolves.toStrictEqual(bootstrap);
    // Until the joint export brings the field to the captured bootstrap, it may be missing: no clip then.
    const { attachments: _, ...withoutAttachments } = bootstrap;
    server.use(http.get("/api/ai/assistant/bootstrap", () => HttpResponse.json(withoutAttachments)));
    const read = await assistantApi.bootstrap();
    expect(read).toStrictEqual(withoutAttachments);
    expect(read.attachments ?? false).toBe(false);
    server.use(http.get("/api/ai/assistant/bootstrap", () => HttpResponse.json({ ...bootstrap, attachments: "yes" })));
    await expect(assistantApi.bootstrap()).rejects.toThrow("Invalid assistant contract.");
  });
  // Stage 3: optional until the joint export brings them to the captured bootstrap, like `attachments`.
  it("reads whether this person may attach a Word and also a photo or a PDF in the bootstrap, as optional booleans", async () => {
    const bootstrap = { availability: "available", connectionRevision: 7, suggestions: [], limits: { questionMaxLength: 4000 },
      configurationDestination: null, audio: false, attachments: true, documents: true, documentReading: false };
    server.use(http.get("/api/ai/assistant/bootstrap", () => HttpResponse.json(bootstrap)));
    await expect(assistantApi.bootstrap()).resolves.toStrictEqual(bootstrap);
    for (const field of ["documents", "documentReading"]) {
      server.use(http.get("/api/ai/assistant/bootstrap", () => HttpResponse.json({ ...bootstrap, [field]: "yes" })));
      await expect(assistantApi.bootstrap()).rejects.toThrow("Invalid assistant contract.");
    }
  });
  it("reads the spreadsheet of the turn that brought it, with its name, kind, rows and size", async () => {
    const withFile = { ...turn, question: "", attachment: { name: "clientes.xlsx", kind: "xlsx", rows: 86, size: 24576 } };
    server.use(http.get("/api/ai/assistant/turns/:id", () => HttpResponse.json(withFile)));
    await expect(assistantApi.turn(requestId)).resolves.toStrictEqual(withFile);
    server.use(http.get("/api/ai/assistant/turns/:id", () => HttpResponse.json({ ...withFile, attachment: { ...withFile.attachment, kind: "xls" } })));
    await expect(assistantApi.turn(requestId)).rejects.toThrow("Invalid assistant contract.");
  });
  // Stage 3: a photo or a PDF counts its pages (a photo is one) and a Word has none; no document counts rows. A Word renamed .xlsx
  // passes the clip's filter and comes back as what it is.
  it("reads the document of the turn that brought it: a photo or a PDF with its pages, a Word without them", async () => {
    for (const attachment of [
      { name: "acta.pdf", kind: "pdf", size: 98304, pages: 3 },
      { name: "remito.jpeg", kind: "jpeg", size: 40960, pages: 1 },
      { name: "remito.png", kind: "png", size: 40960 },
      { name: "acta.xlsx", kind: "docx", size: 12288 },
    ]) {
      const withDocument = { ...turn, question: "", attachment };
      server.use(http.get("/api/ai/assistant/turns/:id", () => HttpResponse.json(withDocument)));
      await expect(assistantApi.turn(requestId)).resolves.toStrictEqual(withDocument);
    }
  });
  it.each([
    ["a spreadsheet without rows", { name: "clientes.xlsx", kind: "xlsx", size: 24576 }],
    ["a spreadsheet with pages", { name: "clientes.csv", kind: "csv", rows: 86, size: 24576, pages: 1 }],
    ["a document with rows", { name: "acta.pdf", kind: "pdf", rows: 3, size: 98304, pages: 3 }],
    ["a Word with pages", { name: "acta.docx", kind: "docx", size: 12288, pages: 1 }],
    ["a PDF without a page", { name: "acta.pdf", kind: "pdf", size: 98304, pages: 0 }],
    ["a PDF with more than ten pages", { name: "acta.pdf", kind: "pdf", size: 98304, pages: 11 }],
    ["a kind outside the contract", { name: "acta.doc", kind: "doc", size: 12288 }],
  ])("rejects a turn whose file is %s", async (_, attachment) => {
    server.use(http.get("/api/ai/assistant/turns/:id", () => HttpResponse.json({ ...turn, question: "", attachment })));
    await expect(assistantApi.turn(requestId)).rejects.toThrow("Invalid assistant contract.");
  });
  it("sends a turn with a spreadsheet in multipart, with only the fields it has, and says how much went up", async () => {
    const accepted = { conversationId: turn.conversationId, requestId, conversationRevision: 1, turnRevision: 1, state: "pending",
      stage: "pending", submittedAtUtc: turn.submittedAtUtc, serverNowUtc: turn.serverNowUtc, pollingAfterSeconds: 1 };
    const sends = captureUploads([{ status: 202, body: accepted, progress: [0.4, 1] }]);
    const file = new File(["Código,Cliente"], "clientes.csv", { type: "text/csv" });
    const progress: number[] = [];
    try {
      await expect(assistantApi.submitFile({ requestId, conversationId: null, expectedRevision: null, expectedConnectionRevision: 7,
        question: "" }, file, fraction => progress.push(fraction))).resolves.toEqual(accepted);
      expect(sends[0].url).toBe("/api/ai/assistant/file-turns");
      expect([...sends[0].body.keys()].sort()).toEqual(["expectedConnectionRevision", "file", "question", "requestId"]);
      expect(sends[0].body.get("requestId")).toBe(requestId);
      expect(sends[0].body.get("expectedConnectionRevision")).toBe("7");
      expect(sends[0].body.get("question")).toBe("");
      const sent = sends[0].body.get("file") as File;
      expect([sent.name, sent.size, sent.type]).toEqual(["clientes.csv", file.size, "text/csv"]);
      expect(progress).toEqual([0.4, 1]);
      await assistantApi.submitFile({ requestId, conversationId: turn.conversationId, expectedRevision: 2, expectedConnectionRevision: 7,
        question: "Armame un catálogo", audioRequestId }, file, () => {});
      expect(Object.fromEntries([...sends[1].body.entries()].filter(([key]) => key !== "file"))).toEqual({ requestId,
        conversationId: turn.conversationId, expectedRevision: "2", expectedConnectionRevision: "7", question: "Armame un catálogo", audioRequestId });
    } finally { vi.unstubAllGlobals(); }
  });
  // Stage 3: a photo or a PDF goes up under its own request, saying how much went up, and its reading is followed by its status.
  const documentRequestId = "0199a0c0-0000-7000-8000-000000000666";
  const read = { name: "comprobante.pdf", kind: "pdf", pages: 2, size: 421888, readability: "partial", problem: "cut" };
  const documentStatus = (state: string, document: unknown = null, failure: unknown = null) =>
    ({ requestId: documentRequestId, state, document, failure, pollingAfterSeconds: 1 });
  it("uploads a photo or a PDF in multipart under its own request, says how much went up and follows its reading", async () => {
    const sends = captureUploads([{ status: 202, body: documentStatus("pending"), progress: [0.4, 1] }]);
    const file = new File(["%PDF"], "comprobante.pdf", { type: "application/pdf" });
    const progress: number[] = [];
    try {
      await expect(assistantApi.uploadDocument(documentRequestId, file, fraction => progress.push(fraction)))
        .resolves.toStrictEqual(documentStatus("pending"));
      expect(sends[0].url).toBe("/api/ai/assistant/documents");
      expect([...sends[0].body.keys()].sort()).toEqual(["file", "requestId"]);
      expect(sends[0].body.get("requestId")).toBe(documentRequestId);
      expect((sends[0].body.get("file") as File).name).toBe("comprobante.pdf");
      expect(progress).toEqual([0.4, 1]);
    } finally { vi.unstubAllGlobals(); }
    for (const body of [documentStatus("completed", read), documentStatus("completed", { ...read, kind: "jpeg", pages: 1, readability: "readable", problem: null }),
      documentStatus("failed", null, { code: "Ai.Assistant.ProviderRejected", detail: "No se pudo leer el documento.", recovery: "newAttempt" })]) {
      server.use(http.get("/api/ai/assistant/documents/:id", () => HttpResponse.json(body)));
      await expect(assistantApi.document(documentRequestId)).resolves.toStrictEqual(body);
    }
  });
  it.each([
    ["a Word, which goes with its turn", { ...read, kind: "docx" }],
    ["no page", { ...read, pages: 0 }],
    ["more than ten pages", { ...read, pages: 11 }],
    ["a readability outside the contract", { ...read, readability: "blurry" }],
    ["a cause outside the contract", { ...read, problem: "torn" }],
    ["a field outside the contract", { ...read, text: "Monto $ 1.000" }],
    ["no cause at all", { name: read.name, kind: read.kind, pages: read.pages, size: read.size, readability: read.readability }],
  ])("rejects the status of a reading whose document has %s", async (_, document) => {
    server.use(http.get("/api/ai/assistant/documents/:id", () => HttpResponse.json(documentStatus("completed", document))));
    await expect(assistantApi.document(documentRequestId)).rejects.toThrow("Invalid assistant contract.");
  });
  it("names the reading in the turn's body, and only there", async () => {
    let sent: unknown;
    server.use(http.post("/api/ai/assistant/turns", async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json({ conversationId: turn.conversationId, requestId, conversationRevision: 1, turnRevision: 1, state: "pending",
        stage: "pending", submittedAtUtc: turn.submittedAtUtc, serverNowUtc: turn.serverNowUtc, pollingAfterSeconds: 1 }, { status: 202 });
    }));
    await assistantApi.submit({ requestId, conversationId: null, expectedRevision: null, expectedConnectionRevision: 7, question: "",
      documentRequestId });
    expect(sent).toEqual({ requestId, conversationId: null, expectedRevision: null, expectedConnectionRevision: 7, question: "", documentRequestId });
  });
  it("rejects a normalization status outside the contract", async () => {
    server.use(http.get("/api/ai/assistant/audio/:id", () => HttpResponse.json(
      { requestId: audioRequestId, state: "completed", transcript: "Hola", failure: null, pollingAfterSeconds: 1, text: "Hola" })));
    await expect(assistantApi.audio(audioRequestId)).rejects.toThrow("Invalid assistant contract.");
  });
});
