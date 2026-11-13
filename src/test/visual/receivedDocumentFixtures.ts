import type { ReceivedDocument, ReceivedDocumentDetail, ReceivedDocumentEvent, ReceivedDocumentsPage, ReceivedDocumentValue } from "@/features/business-forms/api/receivedDocuments";

// «Documentos recibidos» (DOC5-A) as the board draws it: 27 documents of «Pagos de clientes» and others that came by WhatsApp, the
// comprobante of Banco Macro that Pablo Sosa sent and did not confirm (for review here), a PDF, one that waits for its person, the
// unclassified, the confirmed and the discarded. Synthetic bodies on the backend's shape (task 7 and its correction «7b»), for the page's
// tests and the scenes («documents*»): they do not accredit the server's reading, search, counts or options. Every amount, CBU and CUIT
// is invented.
const id = (n: number) => `0199b0c0-0000-7000-8000-${String(n).padStart(12, "0")}`;
export const receivedDocumentIds = { forReview: id(5), pdf: id(2), waiting: id(6), confirmed: id(8), unclassified: id(3), discarded: id(7), other: id(4), rejected: id(9) } as const;
export const receivedDocumentForms = { payments: id(401), expenses: id(402) } as const;
const versions = { payments: id(411), expenses: id(412) } as const;
const field = (n: number) => id(500 + n);
export const receivedDocumentFields = { client: field(1), amount: field(2), currency: field(3), date: field(4), operation: field(5), concept: field(6),
  account: field(7), taxId: field(8), holder: field(9), bank: field(10), time: field(11), destinationAccount: field(12), destinationHolder: field(13),
  destinationTaxId: field(14), destinationBank: field(15) } as const;
const people = { juan: { userId: id(301), displayName: "Juan Gómez" }, pablo: { userId: id(302), displayName: "Pablo Sosa" },
  marta: { userId: id(303), displayName: "Marta Ruiz" }, ana: { userId: id(304), displayName: "Ana Pérez" } } as const;
export const receivedDocumentReviewer = people.ana;

function texts(language: "es" | "en") {
  const en = language === "en";
  return {
    payments: en ? "Customer payments" : "Pagos de clientes", expenses: en ? "Expenses" : "Gastos",
    amount: en ? "Amount" : "Monto", bank: en ? "Bank or wallet of origin" : "Banco o billetera de origen", taxId: en ? "CUIT or CUIL of origin" : "CUIT o CUIL de origen",
    client: en ? "Customer" : "Cliente", currency: en ? "Currency" : "Moneda", date: en ? "Date" : "Fecha", operation: en ? "Operation number" : "Número de operación",
    concept: en ? "Concept" : "Concepto", account: en ? "Account of origin" : "Cuenta de origen", holder: en ? "Holder of origin" : "Titular de origen",
    time: en ? "Time" : "Hora", destinationAccount: en ? "Destination account" : "Cuenta de destino", destinationHolder: en ? "Destination holder" : "Titular de destino",
    destinationTaxId: en ? "Destination CUIT or CUIL" : "CUIT o CUIL de destino", destinationBank: en ? "Destination bank or wallet" : "Banco o billetera de destino",
    // An amount as the server writes it for whoever reads (whole pesos, grouped by thousands in each language's way).
    pesos: en ? "Pesos" : "Pesos", dollars: en ? "Dollars" : "Dólares", bakery: en ? "Don Ángel bakery" : "Panadería Don Ángel",
    hardware: en ? "North hardware store" : "Ferretería Norte", number: (value: number) => String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/g, en ? "," : "."),
    date21: en ? "10/21/2026" : "21/10/2026",
  };
}

const file = (name: string, mediaType: string, size: number, pages: number | null = null, stored = true) => ({ name, mediaType, size, pages, stored });
function item(n: number, values: Partial<ReceivedDocument> & Pick<ReceivedDocument, "receivedAtUtc" | "sender" | "state" | "file">): ReceivedDocument {
  return { id: id(n), channelId: "whatsapp", form: null, forReview: false, reasonCode: null, documentType: null, record: null, highlights: [], deleteAfterUtc: null,
    replyExpiresAtUtc: null, revision: 1, ...values };
}

/** The page of the inbox (page 1 of 3, ten documents) with the counts of each state and the forms and people under the other filters. */
export function receivedDocumentsPageFixture(language: "es" | "en" = "es"): ReceivedDocumentsPage {
  const text = texts(language);
  const payments = { definitionId: receivedDocumentForms.payments, name: text.payments };
  const amount = (value: number) => ({ fieldId: receivedDocumentFields.amount, label: text.amount, value: text.number(value) });
  const bank = (value: string) => ({ fieldId: receivedDocumentFields.bank, label: text.bank, value });
  const items: ReceivedDocument[] = [
    item(1, { receivedAtUtc: "2026-10-22T15:04:00Z", sender: people.juan, state: "proposed", forReview: true, form: payments, file: file("comprobante.jpg", "image/jpeg", 186_000),
      highlights: [amount(150000), bank("Banco Galicia")], documentType: "comprobante de transferencia" }),
    item(2, { receivedAtUtc: "2026-10-22T14:20:00Z", sender: people.juan, state: "confirmed", form: payments, file: file("comprobante-nacion.pdf", "application/pdf", 96_000, 1),
      highlights: [amount(98500), bank("Banco Nación")], record: { recordId: id(601), number: "REC-000124" }, revision: 2 }),
    item(3, { receivedAtUtc: "2026-10-22T12:58:00Z", sender: people.juan, state: "unclassified", reasonCode: "unknown", file: file("captura.jpg", "image/jpeg", 240_000),
      deleteAfterUtc: "2027-01-20T12:58:00Z", documentType: "captura de pantalla" }),
    item(4, { receivedAtUtc: "2026-10-22T11:50:00Z", sender: people.juan, state: "unclassified", reasonCode: "other", file: file("ticket.jpg", "image/jpeg", 120_000),
      deleteAfterUtc: "2027-01-20T11:50:00Z", documentType: "ticket de combustible" }),
    item(5, { receivedAtUtc: "2026-10-21T21:12:00Z", sender: people.pablo, state: "proposed", forReview: true, form: payments, file: file("comprobante.jpg", "image/jpeg", 205_000),
      highlights: [amount(68500), { fieldId: receivedDocumentFields.taxId, label: text.taxId, value: "20-23456789-7" }, bank("Banco Macro")], documentType: "comprobante de transferencia" }),
    item(6, { receivedAtUtc: "2026-10-21T19:05:00Z", sender: people.juan, state: "proposed", form: payments, file: file("comprobante.jpg", "image/jpeg", 192_000),
      highlights: [amount(412000), bank("Banco Santander")], replyExpiresAtUtc: "2026-10-22T19:05:00Z" }),
    item(7, { receivedAtUtc: "2026-10-21T14:47:00Z", sender: people.pablo, state: "discarded", reasonCode: "reviewer", form: payments, file: file("ticket-ruta8.jpg", "image/jpeg", 150_000),
      deleteAfterUtc: "2027-01-19T15:00:00Z", revision: 2 }),
    item(8, { receivedAtUtc: "2026-10-20T13:35:00Z", sender: people.juan, state: "confirmed", form: payments, file: file("comprobante.jpg", "image/jpeg", 178_000),
      highlights: [amount(150000), bank("Banco Galicia")], record: { recordId: id(602), number: "REC-000123" }, revision: 2 }),
    // A rejected file the inbox kept no copy of: an old Word.
    item(9, { receivedAtUtc: "2026-10-20T12:40:00Z", sender: people.marta, state: "discarded", reasonCode: "legacy", file: file("planilla-vieja.doc", "application/msword", 310_000, null, false),
      deleteAfterUtc: "2027-01-18T12:40:00Z" }),
    item(10, { receivedAtUtc: "2026-10-19T20:20:00Z", sender: people.marta, state: "unclassified", reasonCode: "quota", file: file("remito.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 24_000),
      deleteAfterUtc: "2027-01-17T20:20:00Z" }),
  ];
  return { items, page: 1, pageSize: 10, totalCount: 27, counts: { proposed: 3, forReview: 2, unclassified: 5, confirmed: 15, discarded: 4 }, facets: {
    forms: [{ ...payments, count: 19 }, { definitionId: receivedDocumentForms.expenses, name: text.expenses, count: 3 }],
    senders: [{ ...people.juan, count: 14 }, { ...people.pablo, count: 7 }, { ...people.marta, count: 6 }], formsTruncated: false, sendersTruncated: false,
  }, groups: [] };
}

function value(fieldId: string, label: string, type: ReceivedDocumentValue["type"], read: string | null, shown: string | null, extra: Partial<ReceivedDocumentValue> = {}): ReceivedDocumentValue {
  return { fieldId, label, type, required: false, value: read, text: shown, mark: read === null ? "notRead" : null, errorCode: null, options: type === "choice" ? [] : null,
    optionsUnavailable: null, ...extra };
}
// The options of a choice: its own, or the ones of the catalog its sender sees.
export const receivedDocumentOptions = { bakery: id(701), pesos: id(702), macro: id(703), hardware: id(704), dollars: id(706), galicia: id(707), nacion: id(708) } as const;
const banks = [{ id: receivedDocumentOptions.macro, text: "Banco Macro", group: null }, { id: receivedDocumentOptions.galicia, text: "Banco Galicia", group: null },
  { id: receivedDocumentOptions.nacion, text: "Banco Nación", group: null }];

/**
 * The data read of a comprobante for «Pagos de clientes», in the form's order: 15 of them, so seven fold under «Ver los N datos más». A
 * choice brings its options only to whoever can change it (`changeable`), as the server.
 */
export function receivedDocumentValuesFixture(language: "es" | "en" = "es", amount = "68500.00", changeable = true): ReceivedDocumentValue[] {
  const text = texts(language);
  const f = receivedDocumentFields;
  const o = receivedDocumentOptions;
  const offered = (options: { id: string; text: string; group: string | null }[]) => changeable ? options : [];
  return [
    value(f.client, text.client, "choice", o.bakery, text.bakery, { mark: "completed", options: offered([{ id: o.bakery, text: text.bakery, group: null }, { id: o.hardware, text: text.hardware, group: null }]) }),
    value(f.amount, text.amount, "decimal", amount, text.number(Number(amount)), { required: true }),
    value(f.currency, text.currency, "choice", o.pesos, text.pesos, { required: true, options: offered([{ id: o.pesos, text: text.pesos, group: null }, { id: o.dollars, text: text.dollars, group: null }]) }),
    value(f.date, text.date, "date", "2026-10-21", text.date21, { required: true }),
    value(f.operation, text.operation, "shortText", "6120093744", "6120093744", { mark: "doubtful" }),
    value(f.concept, text.concept, "shortText", "Factura 0003-00001851", "Factura 0003-00001851"),
    value(f.account, text.account, "shortText", "2850123543000098765437", "2850123543000098765437"),
    value(f.taxId, text.taxId, "shortText", "20-23456789-7", "20-23456789-7"),
    value(f.holder, text.holder, "shortText", "Ángel Ruiz", "Ángel Ruiz"),
    value(f.bank, text.bank, "choice", o.macro, "Banco Macro", { mark: "completed", options: offered(banks) }),
    value(f.time, text.time, "shortText", "18:12", "18:12"),
    value(f.destinationAccount, text.destinationAccount, "shortText", null, null),
    value(f.destinationHolder, text.destinationHolder, "shortText", "Distribuidora Norte SA", "Distribuidora Norte SA"),
    value(f.destinationTaxId, text.destinationTaxId, "shortText", "30-71458236-9", "30-71458236-9"),
    value(f.destinationBank, text.destinationBank, "choice", null, null, { options: offered(banks) }),
  ];
}

const event = (atUtc: string, kind: ReceivedDocumentEvent["kind"], actor: ReceivedDocumentEvent["actor"] = null, detail: string | null = null): ReceivedDocumentEvent => ({ atUtc, kind, actor, detail });

/** A document of the page with its reading, its proposal, the forms it can be read for (only for whoever reviews it) and its history. */
export function receivedDocumentDetailFixture(documentId: string, language: "es" | "en" = "es", canReview = true): ReceivedDocumentDetail {
  const text = texts(language);
  const document = receivedDocumentsPageFixture(language).items.find(entry => entry.id === documentId);
  if (!document) throw new Error("No such received document fixture.");
  // The options of a choice, only for whoever reviews a proposed or unclassified one.
  const changeable = canReview && (document.state === "proposed" || document.state === "unclassified");
  const candidate = (amount: string) => ({ definitionId: receivedDocumentForms.payments, versionId: versions.payments, name: text.payments, values: receivedDocumentValuesFixture(language, amount, changeable) });
  const forms = canReview ? [{ definitionId: receivedDocumentForms.payments, name: text.payments }, { definitionId: receivedDocumentForms.expenses, name: text.expenses }] : [];
  const reading = { readability: "readable" as const, problem: null, language: "es", text: "Banco Macro · Transferencia inmediata · $ 68.500,00", truncated: false };
  const received = event(document.receivedAtUtc, "received", null, document.state === "unclassified" ? document.reasonCode === "quota" ? "quota" : "unknown"
    : document.reasonCode === "unreadable" ? "unreadable" : document.file.stored ? "sure" : "rejected");
  const base: ReceivedDocumentDetail = { document, reading, proposal: null, extraction: null, history: [received], canReview, forms };
  switch (documentId) {
    case receivedDocumentIds.forReview: return { ...base, proposal: { outcome: "sure", documentType: document.documentType, candidates: [candidate("68500.00")], repetition: null } };
    // The AI doubted, Juan chose «Pagos de clientes» in WhatsApp and was sent the form: it waits for him.
    case receivedDocumentIds.waiting: return { ...base, proposal: { outcome: "doubt", documentType: null, candidates: [candidate("412000.00"),
      { definitionId: receivedDocumentForms.expenses, versionId: versions.expenses, name: text.expenses, values: receivedDocumentValuesFixture(language, "412000.00", changeable) }], repetition: null },
      history: [event(document.receivedAtUtc, "received", null, "doubt"), event("2026-10-21T19:07:00Z", "formChosen")] };
    case receivedDocumentIds.pdf: return { ...base, proposal: { outcome: "sure", documentType: null, candidates: [candidate("98500.00")], repetition: null },
      history: [received, event("2026-10-22T14:26:00Z", "confirmed", people.ana, "REC-000124")] };
    case receivedDocumentIds.confirmed: return { ...base, proposal: { outcome: "sure", documentType: null, candidates: [candidate("150000.00")], repetition: null },
      history: [received, event("2026-10-20T13:39:00Z", "confirmed", null, "REC-000123")] };
    case receivedDocumentIds.discarded: return { ...base, history: [received, event("2026-10-21T15:00:00Z", "discarded", people.ana)] };
    case receivedDocumentIds.rejected: return { ...base, reading: null };
    case receivedDocumentIds.unclassified: return { ...base, reading: { ...reading, text: "Captura de una pantalla sin datos de un comprobante" },
      proposal: { outcome: "unknown", documentType: document.documentType, candidates: [], repetition: null } };
    default: return { ...base, reading: document.reasonCode === "quota" ? null : reading };
  }
}

/** A comprobante drawn as a photo (portrait, so turning it shows), with the stamp «EJEMPLO · FICTICIO». */
async function receiptPhoto(language: "es" | "en"): Promise<Blob> {
  const canvas = new OffscreenCanvas(600, 860);
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#f6f4ee"; context.fillRect(0, 0, 600, 860);
  context.fillStyle = "#1f2a24"; context.font = "bold 34px sans-serif"; context.fillText("Banco Macro", 48, 90);
  context.font = "24px sans-serif"; context.fillText(language === "en" ? "Instant transfer" : "Transferencia inmediata", 48, 132);
  context.font = "bold 56px sans-serif"; context.fillText("$ 68.500,00", 48, 230);
  context.font = "24px sans-serif";
  ["21/10/2026 · 18:12", "Nº 6120 0937 44", "Ángel Ruiz", "CUIT 20-23456789-7", "CBU 2850123543000098765437"].forEach((line, index) => context.fillText(line, 48, 310 + index * 52));
  context.strokeStyle = "#b5462f"; context.lineWidth = 4; context.strokeRect(330, 40, 230, 64);
  context.fillStyle = "#b5462f"; context.font = "bold 24px sans-serif"; context.fillText(language === "en" ? "SAMPLE" : "EJEMPLO", 372, 82);
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
}
// A one-page PDF that the browser's viewer opens, with the same stamp.
const receiptPdf = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 420]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 79>>stream\nBT /F1 16 Tf 30 370 Td (Banco Nacion - EJEMPLO) Tj 0 -30 Td ($ 98.500,00) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n";

/**
 * The scenes of the inbox: «documents» (who reviews), «documents-read» (only «Ver documentos recibidos»), «documents-empty» and
 * «documents-error». The search (with its body, as the server) and the filters of the state, the form and the person answer as the
 * server would for these documents; the rest of the pages repeat the first.
 */
export function createReceivedDocumentVisualFixtures(language: "es" | "en", scenario: string) {
  const review = scenario !== "documents-read";
  const json = (body: unknown, status = 200) => Response.json(body, { status });
  return {
    permissions: ["formdocuments.read", ...review ? ["formdocuments.review"] : [], "formrecords.read"],
    async handle(request: Request): Promise<Response | undefined> {
      const url = new URL(request.url);
      if (!url.pathname.startsWith("/api/forms/documents")) return undefined;
      if (url.pathname === "/api/forms/documents/counts") return json(scenario === "documents-empty" ? { forReview: 0, unclassified: 0, total: 0 } : { forReview: 2, unclassified: 5, total: 7 });
      if (url.pathname === "/api/forms/documents/search" && request.method === "POST") {
        if (scenario === "documents-error") return json({ status: 500, title: "Error", traceId: "visual-trace" }, 500);
        const page = receivedDocumentsPageFixture(language);
        const body = await request.clone().json() as { page?: number; pageSize?: number; state?: string; search?: string; definitionId?: string; senderUserId?: string };
        const pageSize = body.pageSize ?? 10, number = body.page ?? 1;
        if (scenario === "documents-empty") return json({ items: [], page: number, pageSize, totalCount: 0, counts: { proposed: 0, forReview: 0, unclassified: 0, confirmed: 0, discarded: 0 },
          facets: { forms: [], senders: [], formsTruncated: false, sendersTruncated: false }, groups: [] });
        const search = body.search?.replace(/\D/g, "");
        const items = page.items.filter(entry => (!body.state || (body.state === "forReview" ? entry.forReview : entry.state === body.state))
          && (!body.definitionId || entry.form?.definitionId === body.definitionId) && (!body.senderUserId || entry.sender.userId === body.senderUserId)
          && (!search || entry.highlights.some(highlight => highlight.value.replace(/\D/g, "").startsWith(search))));
        const filtered = !!body.state || !!search || !!body.definitionId || !!body.senderUserId;
        return json({ ...page, items: items.slice(0, pageSize), page: number, pageSize, totalCount: filtered ? items.length : page.totalCount });
      }
      const match = /^\/api\/forms\/documents\/([^/]+)(\/file)?$/.exec(url.pathname);
      if (!match) return undefined;
      const documentId = match[1]!;
      if (match[2]) return documentId === receivedDocumentIds.pdf ? new Response(receiptPdf, { headers: { "content-type": "application/pdf" } })
        : new Response(await receiptPhoto(language), { headers: { "content-type": "image/jpeg" } });
      return json(receivedDocumentDetailFixture(documentId, language, review));
    },
  };
}
