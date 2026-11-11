import { describe, expect, it } from "vitest";
import i18n from "@/shared/i18n";
import { hasMissingRuleData, hasUnavailableResults, parseRuleMessage, ruleMessageData, ruleMessageDataLabel, ruleMessagePreview, ruleMessageText, serializeRuleMessage, type RuleMessageQuestion, type RuleMessageResult } from "./ruleMessage";

const remito = "0199a0c0-0000-7000-8000-000000000001", photo = "0199a0c0-0000-7000-8000-000000000002", supplier = "0199a0c0-0000-7000-8000-000000000003";
const received = "0199a0c0-0000-7000-8000-000000000004", amount = "0199a0c0-0000-7000-8000-000000000005", complete = "0199a0c0-0000-7000-8000-000000000006", issues = "0199a0c0-0000-7000-8000-000000000007";
const questions: RuleMessageQuestion[] = [
  { fieldId: remito, type: "shortText", label: { es: "N° de remito", en: "Delivery note" } },
  { fieldId: photo, type: "photo", label: { es: "Foto del remito", en: "Delivery note photo" } },
  { fieldId: supplier, type: "choice", label: { es: "Proveedor", en: "Supplier" }, options: null },
  { fieldId: received, type: "date", label: { es: "Fecha de recepción", en: "Received on" } },
  { fieldId: amount, type: "decimal", label: { es: "Importe", en: "Amount" } },
  { fieldId: complete, type: "boolean", label: { es: "Completa", en: "Complete" } },
  { fieldId: issues, type: "multiChoice", label: { es: "Fallas", en: "Issues" }, options: [{ label: { es: "Golpe", en: "Dent" } }, { label: { es: "Faltante", en: "Missing" } }, { label: { es: "Mojado", en: "Wet" } }], selection: { minSelected: 2 } },
];
const choices = { [supplier]: [{ id: "0199a0c0-0000-7000-8000-000000000100", label: "Distribuidora Norte" }] };

const voucher: RuleMessageResult[] = [
  { source: "arca.invoice", sourceName: { es: "Emitir comprobante en ARCA", en: "Issue an ARCA voucher" }, key: "number", label: { es: "Número de comprobante", en: "Voucher number" }, kind: "text" },
  { source: "arca.invoice", sourceName: { es: "Emitir comprobante en ARCA", en: "Issue an ARCA voucher" }, key: "total", label: { es: "Total", en: "Total" }, kind: "number" },
];
describe("rule message with the data of a result (RE1-A)", () => {
  const t = i18n.getFixedT("es", "forms");
  it("reads and writes a datum of a result by its source and key", () => {
    const parts = parseRuleMessage("Comprobante {result:arca.invoice.number}");
    expect(parts).toEqual([{ kind: "text", text: "Comprobante " }, { kind: "result", source: "arca.invoice", key: "number" }]);
    expect(serializeRuleMessage(parts, "es")).toBe("Comprobante {result:arca.invoice.number}");
    expect(parseRuleMessage("{result:sinclave}")).toEqual([{ kind: "text", text: "{result:sinclave}" }]);
  });
  it("offers the data of the earlier actions after the response data, and names them", () => {
    expect(ruleMessageData([], "Received", voucher)).toEqual([{ kind: "number" }, { kind: "result", source: "arca.invoice", key: "number" }, { kind: "result", source: "arca.invoice", key: "total" }]);
    expect(ruleMessageDataLabel({ kind: "result", source: "arca.invoice", key: "number" }, [], "es", "es", t, voucher)).toBe("Número de comprobante");
    expect(ruleMessageDataLabel({ kind: "result", source: "arca.invoice", key: "cae" }, [], "es", "es", t, voucher)).toBeNull();
  });
  it("shows an example of its kind, and a datum no earlier action brings as missing", () => {
    expect(ruleMessagePreview("Total {result:arca.invoice.total}", [], {}, "es", "es", "FAC", t, voucher)).toEqual([{ text: "Total " }, { text: "12.500,5", sample: true }]);
    expect(ruleMessagePreview("{result:arca.invoice.number}", [], {}, "es", "es", "FAC", t)).toEqual([{ text: t("rules.missingResult"), missing: true }]);
    expect(hasUnavailableResults("{result:arca.invoice.number}", voucher)).toBe(false);
    expect(hasUnavailableResults("{result:arca.invoice.number}", [])).toBe(true);
  });
});
describe("rule message", () => {
  it("reads the number and the reason in either language and a question by its identity, and keeps any other braces as text", () => {
    expect(parseRuleMessage(`Llegó {${remito}} de {número}, {reason}. {Proveedor}`)).toEqual([
      { kind: "text", text: "Llegó " }, { kind: "question", fieldId: remito }, { kind: "text", text: " de " }, { kind: "number" },
      { kind: "text", text: ", " }, { kind: "reason" }, { kind: "text", text: ". {Proveedor}" }]);
    expect(parseRuleMessage("")).toEqual([]);
  });

  it("writes the number and the reason with the words of the message's language and a question by its identity", () => {
    const parts = parseRuleMessage(`Llegó {${remito}} de {number}: {motivo}`);
    expect(serializeRuleMessage(parts, "es")).toBe(`Llegó {${remito}} de {número}: {motivo}`);
    expect(serializeRuleMessage(parts, "en")).toBe(`Llegó {${remito}} de {number}: {reason}`);
  });

  it("offers the number, the reason only when rejecting and the questions in order, without photos or documents", () => {
    const offered = [remito, supplier, received, amount, complete, issues].map(fieldId => ({ kind: "question", fieldId }));
    expect(ruleMessageData(questions, "Received")).toEqual([{ kind: "number" }, ...offered]);
    expect(ruleMessageData(questions, "Rejected")).toEqual([{ kind: "number" }, { kind: "reason" }, ...offered]);
  });

  it.each([
    ["es", "Ejemplo de respuesta · Distribuidora Norte · 16/10/2026 · 12.500,5 · Sí · Golpe, Faltante · REC-000001 · Ejemplo de motivo"],
    ["en", "Example response · Distribuidora Norte · 10/16/2026 · 12,500.5 · Yes · Dent, Missing · REC-000001 · Example reason"],
  ] as const)("previews the message in %s with the examples of the PDF preview", async (culture, expected) => {
    await i18n.loadLanguages(culture);
    const template = [remito, supplier, received, amount, complete, issues].map(fieldId => `{${fieldId}}`).join(" · ") + " · {número} · {motivo}";
    const preview = ruleMessagePreview(template, questions, choices, culture, "es", "REC", i18n.getFixedT(culture, "forms"));
    expect(preview.map(segment => segment.text).join("")).toBe(expected);
    expect(preview.filter(segment => segment.sample)).toHaveLength(8);
  });

  it("writes a message with the names of its data, for the original shown while translating", () => {
    expect(ruleMessageText(`Llegó {${remito}} de {${supplier}}: {número} {0199a0c0-0000-7000-8000-000000000999}`, questions, "es", "es", i18n.getFixedT("es", "forms")))
      .toBe("Llegó N° de remito de Proveedor: Número Pregunta no disponible");
  });

  it("marks a question that is no longer among the options", () => {
    const gone = "0199a0c0-0000-7000-8000-000000000999";
    expect(ruleMessagePreview(`Llegó {${gone}}`, questions, choices, "es", "es", "REC", i18n.getFixedT("es", "forms")))
      .toEqual([{ text: "Llegó " }, { text: "Pregunta no disponible", missing: true }]);
    expect(hasMissingRuleData(`Llegó {${gone}}`, questions)).toBe(true);
    expect(hasMissingRuleData(`Llegó {${remito}} {número}`, questions)).toBe(false);
  });

  // UB4-A: a location arrives as the point and, on the line below, its map link (FormActionMessagePolicy).
  it("shows a location as an example point with its map link on the line below", () => {
    const where = "0199a0c0-0000-7000-8000-000000000008";
    expect(ruleMessagePreview(`Visita en {${where}}`, [{ fieldId: where, type: "location", label: { es: "Dónde estás" } }], {}, "es", "es", "REG", i18n.getFixedT("es", "forms")))
      .toEqual([{ text: "Visita en " }, { text: "-34.603722, -58.381592\nhttps://www.google.com/maps?q=-34.603722,-58.381592", sample: true }]);
  });
});

describe("the block of rows as a datum", () => {
  const block = "0199a0c0-0000-7000-8000-000000000010", article = "0199a0c0-0000-7000-8000-000000000011", quantity = "0199a0c0-0000-7000-8000-000000000012", good = "0199a0c0-0000-7000-8000-000000000013";
  const rows: RuleMessageQuestion[] = [
    { fieldId: remito, type: "shortText", label: { es: "N° de remito", en: "Delivery note" } },
    { fieldId: block, type: "group", label: { es: "Artículos", en: "Items" } },
    { fieldId: article, type: "choice", label: { es: "Artículo", en: "Product" }, options: null, repeated: true },
    { fieldId: quantity, type: "decimal", label: { es: "Cantidad", en: "Quantity" }, repeated: true },
    { fieldId: good, type: "boolean", label: { es: "¿Llegó en buen estado?", en: "Arrived in good condition?" }, repeated: true },
  ];
  const rowChoices = { [article]: [{ id: "0199a0c0-0000-7000-8000-000000000101", label: "GLIFOSATO 64%" }] };
  const preview = (template: string, culture: "es" | "en" = "es") => ruleMessagePreview(template, rows, rowChoices, culture, "es", "REC", i18n.getFixedT(culture, "forms"));

  it("is offered, and its questions are not", () => {
    expect(ruleMessageData(rows, "Received")).toEqual([{ kind: "number" }, { kind: "question", fieldId: remito }, { kind: "question", fieldId: block }]);
  });

  it.each([
    ["es", "1. GLIFOSATO 64% · 12.500,5 · Sí"],
    ["en", "1. GLIFOSATO 64% · 12,500.5 · Yes"],
  ] as const)("arrives in %s with an example item on its own line, with the example of each of its questions", async (culture, item) => {
    await i18n.loadLanguages(culture);
    const segments = preview(`Llegó: {${block}}`, culture);
    expect(segments.map(segment => segment.text).join("")).toBe("Llegó: \n" + item);
    expect(segments.filter(segment => segment.sample).map(segment => segment.text)).toEqual([item]);
  });

  it("starts its item on a new line unless the message starts there or a line break comes before", () => {
    const text = (template: string) => preview(template).map(segment => segment.text).join("");
    expect(text(`{${block}}`)).toBe("1. GLIFOSATO 64% · 12.500,5 · Sí");
    expect(text(`Llegó:\n{${block}}\nGracias`)).toBe("Llegó:\n1. GLIFOSATO 64% · 12.500,5 · Sí\nGracias");
  });
});
