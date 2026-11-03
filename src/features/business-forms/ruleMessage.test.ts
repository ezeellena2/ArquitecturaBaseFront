import { describe, expect, it } from "vitest";
import i18n from "@/shared/i18n";
import { hasMissingRuleData, parseRuleMessage, ruleMessageData, ruleMessagePreview, ruleMessageText, serializeRuleMessage, type RuleMessageQuestion } from "./ruleMessage";

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
});
