import type { AssistantTurn } from "@/features/artificial-intelligence/api/assistant";

// Etapa 3 de la IA: `assistant-proposal-document` is «Pagos de clientes», proposed from the PDF of a transfer receipt (two pages,
// 412 KB) sent with its text, with the reading of documents on: propose-form@2 as the server normalizes it, with what each question
// read in the receipt and no standard (Home never offers the library). The card shows neither: they are for DOC6.
export function documentProposalScene(base: AssistantTurn, en: boolean) {
  const ids = (index: number) => `0199a0c0-0000-7000-8006-${String(index).padStart(12, "0")}`;
  const question = (label: string, type: string, required: boolean, sample: string | null) =>
    ({ label, type, required, options: [], catalog: null, sample });
  const questions = en
    ? [question("Payment date", "date", true, "11/10/2026"), question("Amount", "number", true, "150,000.00"),
      question("Originating bank", "shortText", true, "Banco Ejemplo"), question("Payer's tax ID", "shortText", false, "20-12345678-6"),
      question("Operation number", "shortText", true, "000123456"), question("Receipt", "document", true, null)]
    : [question("Fecha del pago", "date", true, "10/11/2026"), question("Monto", "number", true, "150.000,00"),
      question("Banco de origen", "shortText", true, "Banco Ejemplo"), question("CUIT de quien paga", "shortText", false, "20-12345678-6"),
      question("Número de operación", "shortText", true, "000123456"), question("Comprobante", "document", true, null)];
  const proposal: AssistantTurn["proposal"] = { id: ids(21), capability: "forms.authoring.propose-form", version: 2, content: {
    culture: en ? "en" : "es", name: en ? "Customer payments" : "Pagos de clientes", prefix: "PAG", submitLabel: en ? "Send" : "Enviar", questions,
    documentReading: { recognition: en
      ? "Bank transfer receipts: they show the amount, the date, the originating and destination accounts and the operation number."
      : "Comprobantes de transferencia bancaria: muestran el monto, la fecha, las cuentas de origen y de destino y el número de operación." },
    standard: null } };
  const current: AssistantTurn = {
    ...base, turnId: ids(1), requestId: ids(11), ordinal: 1, state: "completed", stage: "finished",
    question: en ? "Build me a form to load these receipts." : "Armame un formulario para cargar estos comprobantes.",
    attachment: { name: en ? "receipt.pdf" : "comprobante.pdf", kind: "pdf", pages: 2, size: 412 * 1024 },
    answer: { kind: "proposal", evidenceIds: [], text: en
      ? "I built the form with the receipt's data and turned on document reading, so it recognizes the next ones."
      : "Armé el formulario con los datos del comprobante y prendí la lectura de documentos, así reconoce los próximos." },
    evidences: [], proposal,
  };
  return { createdCatalogId: null, previous: [] as AssistantTurn[], current };
}
