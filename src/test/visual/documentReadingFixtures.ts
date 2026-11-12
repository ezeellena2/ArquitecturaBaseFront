import type { CatalogDetail } from "@/features/business-forms/api/catalogResponse";
import type { FormDocumentReadingStats } from "@/features/business-forms/api/documentReading";
import type { FormLibrary, FormStandard } from "@/features/business-forms/api/library";
import type { CanonicalQuestion, FormCulture, FormDefinitionSnapshot } from "@/features/business-forms/model";

// DOC1: synthetic examples for «Lectura de documentos» and the library: «Pagos de clientes», a copy of «Comprobante de transferencia»
// with an own question «Cliente» filled by a lookup in «Clientes» by the source CUIT, and its «Cómo viene leyendo». Fictional data;
// the real contract arrives with the backend's export (task 5) and its *HttpContract test.
const guid = (n: number) => "01990000-0000-7000-8000-" + String(n).padStart(12, "0");
const key = (id: string) => "field_" + id.replaceAll("-", "");
export const readingFormId = guid(1);
export const readingCatalogId = guid(960);
export const readingCatalogTaxField = guid(961);
const bankCatalogId = guid(962);
export const readingIds = {
  client: guid(940), sourceBank: guid(941), sourceAccount: guid(942), sourceHolder: guid(943), sourceTaxId: guid(944), destinationBank: guid(945),
  destinationAccount: guid(946), destinationHolder: guid(947), destinationTaxId: guid(948), amount: guid(949), currency: guid(950), date: guid(951), time: guid(952),
  operationNumber: guid(953), concept: guid(954), receipt: guid(955), pesos: guid(956), dollars: guid(957),
};

export function readingDefinition(culture: FormCulture): FormDefinitionSnapshot {
  const ids = readingIds;
  const question = (fieldId: string, es: string, en: string, rest: object, required = false) => ({ fieldId, key: key(fieldId), label: { es, en }, help: null, required, ...rest }) as unknown as CanonicalQuestion;
  const text = (fieldId: string, es: string, en: string, extra: object = {}) => question(fieldId, es, en, { type: "shortText", maxLength: 80, ...extra });
  const catalog = (fieldId: string, es: string, en: string, catalogId: string) => question(fieldId, es, en, { type: "choice", source: { catalog: catalogId } });
  const { client: _own, pesos: _pesos, dollars: _dollars, ...bound } = ids;
  return { offerWhen: null, id: readingFormId, name: { es: "Pagos de clientes", en: "Customer payments" }, prefix: "REC", prefixLocked: false, revision: 1,
    standard: { key: "forms.transfer-receipt", version: 1, bound },
    draft: { format: 1, culture, submitLabel: { es: "Cargar transferencia", en: "Load transfer" },
      documentReading: { enabled: true, recognition: culture === "es"
        ? "Comprobante de una transferencia que nos hizo un cliente: banco o billetera, cuentas de origen y de destino, titulares con CUIT, monto, fecha y número de operación. El destino es nuestra cuenta del Banco Ejemplo."
        : "Receipt of a transfer a customer made to us: bank or wallet, source and destination accounts, holders with their CUIT, amount, date and operation number. The destination is our account at Example Bank.",
        lookups: [{ questionId: ids.client, sourceQuestionId: ids.sourceTaxId, field: readingCatalogTaxField }] },
      fields: [
        catalog(ids.client, "Cliente", "Customer", readingCatalogId),
        catalog(ids.sourceBank, "Banco o billetera de origen", "Source bank or wallet", bankCatalogId),
        text(ids.sourceAccount, "Cuenta de origen", "Source account", { validation: "bankAccount" }),
        // Renamed in the copy: the standard still reads its holder into it.
        text(ids.sourceHolder, "Quién transfirió", "Who transferred"),
        text(ids.sourceTaxId, "CUIT o CUIL de origen", "Source CUIT or CUIL", { validation: "taxId" }),
        catalog(ids.destinationBank, "Banco o billetera de destino", "Destination bank or wallet", bankCatalogId),
        text(ids.destinationAccount, "Cuenta de destino", "Destination account", { validation: "bankAccount" }),
        text(ids.destinationHolder, "Titular de destino", "Destination account holder"),
        text(ids.destinationTaxId, "CUIT o CUIL de destino", "Destination CUIT or CUIL", { validation: "taxId" }),
        question(ids.amount, "Monto", "Amount", { type: "decimal" }, true),
        question(ids.currency, "Moneda", "Currency", { type: "choice", options: [{ choiceId: ids.pesos, label: { es: "Pesos", en: "Pesos" } }, { choiceId: ids.dollars, label: { es: "Dólares", en: "Dollars" } }] }, true),
        question(ids.date, "Fecha", "Date", { type: "date" }, true),
        text(ids.time, "Hora", "Time"),
        text(ids.operationNumber, "Número de operación", "Operation number"),
        question(ids.concept, "Concepto", "Concept", { type: "longText", maxLength: 600 }),
        question(ids.receipt, "Comprobante", "Receipt", { type: "document", files: { minFiles: 1, maxFiles: 1, photoSource: null } }, true),
      ] } };
}

// «Clientes», with its CUIT as a text field: what the lookup compares; and «Bancos y billeteras», the standard's own catalog.
export function readingCatalog(id: string = readingCatalogId): CatalogDetail | undefined {
  const common = { valueType: "Text" as const, proposal: null, description: {}, kind: "Manual" as const, revision: 1, isActive: true, usageCount: null, originalCulture: "es" as const,
    unavailableReasonCode: null, filters: null, presentation: null, presentationCheck: { cultures: [{ culture: "es" as const, titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] },
      { culture: "en" as const, titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }] } };
  if (id === bankCatalogId) return { ...common, id, key: "forms.bank-entities", name: { es: "Bancos y billeteras", en: "Banks and wallets" }, itemsCount: 40, fields: [] };
  return id === readingCatalogId ? { ...common, id, key: id.replaceAll("-", ""), name: { es: "Clientes", en: "Customers" }, itemsCount: 3,
    fields: [{ id: readingCatalogTaxField, key: "cuit", name: { es: "CUIT", en: "CUIT" }, type: "text", sourceCatalogId: null, required: false, unique: false, min: null, max: null,
      maxLength: 13, role: "data", position: 0, isActive: true, valuesCount: 3, usedBy: [] }] } : undefined;
}

export function readingStats(culture: FormCulture, examples = true): FormDocumentReadingStats {
  const ids = readingIds;
  const stats: FormDocumentReadingStats = { sinceUtc: "2026-10-12T03:00:00Z", documents: 118,
    questions: [{ questionId: ids.sourceAccount, read: 118, unchanged: 116 }, { questionId: ids.sourceHolder, read: 118, unchanged: 109 }, { questionId: ids.sourceTaxId, read: 118, unchanged: 117 },
      { questionId: ids.amount, read: 118, unchanged: 118 }, { questionId: ids.date, read: 117, unchanged: 115 }, { questionId: ids.operationNumber, read: 112, unchanged: 98 }],
    mostCorrected: { questionId: ids.operationNumber, corrections: 14 }, duplicateQuestionIds: [ids.operationNumber, ids.amount, ids.date] };
  return examples ? { ...stats, examples: [
    { recordId: guid(970), recordNumber: "REC-000118", confirmedAtUtc: "2026-11-10T14:30:00Z", questionId: ids.operationNumber, read: "0012345678", confirmed: "0012345679" },
    { recordId: guid(970), recordNumber: "REC-000118", confirmedAtUtc: "2026-11-10T14:30:00Z", questionId: ids.amount, read: culture === "es" ? "150.000,00" : "150,000.00", confirmed: culture === "es" ? "15.000,00" : "15,000.00" },
    { recordId: guid(971), recordNumber: "REC-000117", confirmedAtUtc: "2026-11-09T18:05:00Z", questionId: ids.sourceHolder, read: "", confirmed: "Pérez Hnos." },
  ] } : stats;
}

const receiptReads = {
  es: ["Banco o billetera de origen", "Cuenta de origen", "Titular de origen", "CUIT o CUIL de origen", "Banco o billetera de destino", "Cuenta de destino", "Titular de destino",
    "CUIT o CUIL de destino", "Monto", "Moneda", "Fecha", "Hora", "Número de operación", "Concepto"],
  en: ["Source bank or wallet", "Source account", "Source account holder", "Source CUIT or CUIL", "Destination bank or wallet", "Destination account", "Destination account holder",
    "Destination CUIT or CUIL", "Amount", "Currency", "Date", "Time", "Operation number", "Concept"],
};
// The keys are the ones of `standard.bound` in the copy, in the standard's order (the document, read whole, is not a datum).
const receiptKeys = ["sourceBank", "sourceAccount", "sourceHolder", "sourceTaxId", "destinationBank", "destinationAccount", "destinationHolder", "destinationTaxId", "amount", "currency",
  "date", "time", "operationNumber", "concept"];
export function transferReceiptStandard(culture: FormCulture, copies = 2): FormStandard {
  const names = receiptReads[culture];
  const reads = names.map((name, index) => ({ key: receiptKeys[index]!, name }));
  return { key: "forms.transfer-receipt", version: 1, name: culture === "es" ? "Comprobante de transferencia" : "Transfer receipt",
    description: culture === "es" ? "Lee el comprobante de una transferencia y lo carga: las cuentas de origen y de destino con sus titulares, el monto, la fecha y el número de operación."
      : "Reads the receipt of a transfer and loads it: the source and destination accounts with their holders, the amount, the date and the operation number.",
    prefix: "REC", copies, culture: "es", suggestedPrefix: "REC2", reads,
    validations: [{ name: names[1]!, kind: "bankAccount" }, { name: names[3]!, kind: "taxId" }, { name: names[5]!, kind: "bankAccount" }, { name: names[7]!, kind: "taxId" }] };
}

const upcoming = {
  es: [["forms.credit-note", "Nota de crédito o débito", "Lee una nota de crédito o de débito: quién la emite, el comprobante que ajusta, el motivo y el importe."],
    ["forms.payment-receipt", "Recibo", "Lee un recibo de pago: quién cobra, quién paga, el concepto, el importe y la fecha."],
    ["forms.delivery-note", "Remito", "Lee un remito: quién entrega, quién recibe y los artículos con sus cantidades."],
    ["forms.expense-ticket", "Ticket de gasto", "Lee el ticket de un gasto: el comercio, la fecha, el importe y el medio de pago."],
    ["forms.purchase-order", "Orden de compra", "Lee una orden de compra: el proveedor, los artículos, las cantidades, los precios y la entrega."],
    ["forms.quote", "Presupuesto", "Lee un presupuesto: quién lo hace, los ítems con sus precios, el total y hasta cuándo vale."],
    ["forms.check", "Cheque o eCheq", "Lee un cheque o un eCheq: el banco, el número, quién lo libra, el importe y la fecha de pago."],
    ["forms.certificate", "Constancias", "Lee constancias, como la de inscripción en ARCA o la de una CBU: quién figura y lo que certifica."],
    ["forms.settlement", "Liquidaciones", "Lee liquidaciones, como la de una tarjeta o la de granos: el período, los conceptos y el neto."],
    ["forms.waybill", "Carta de porte", "Lee una carta de porte: el titular, el transportista, la carga, el origen y el destino."],
    ["forms.dte", "DTE", "Lee el documento de tránsito electrónico de hacienda: el origen, el destino, la especie y la cantidad."]],
  en: [["forms.credit-note", "Credit or debit note", "Reads a credit or debit note: who issues it, the voucher it adjusts, the reason and the amount."],
    ["forms.payment-receipt", "Payment receipt", "Reads a payment receipt: who is paid, who pays, the concept, the amount and the date."],
    ["forms.delivery-note", "Delivery note", "Reads a delivery note: who delivers, who receives and the items with their quantities."],
    ["forms.expense-ticket", "Expense ticket", "Reads the ticket of an expense: the store, the date, the amount and the means of payment."],
    ["forms.purchase-order", "Purchase order", "Reads a purchase order: the supplier, the items, the quantities, the prices and the delivery."],
    ["forms.quote", "Quote", "Reads a quote: who makes it, the items with their prices, the total and until when it is valid."],
    ["forms.check", "Check or eCheq", "Reads a check or an eCheq: the bank, the number, who draws it, the amount and the payment date."],
    ["forms.certificate", "Certificates", "Reads certificates, such as the ARCA registration or a CBU one: who appears and what it certifies."],
    ["forms.settlement", "Settlements", "Reads settlements, such as a card or a grain one: the period, the items and the net amount."],
    ["forms.waybill", "Waybill", "Reads a waybill: the holder, the carrier, the load, the origin and the destination."],
    ["forms.dte", "DTE", "Reads the electronic livestock transit document: the origin, the destination, the species and the number of head."]],
};
/** The standards of the next stages, listed as «Próximamente». */
export const upcomingStandards = (culture: FormCulture): NonNullable<FormLibrary["upcoming"]> =>
  upcoming[culture].map(([standardKey, name, description]) => ({ key: standardKey!, name: name!, description: description! }));
