// Synthetic DTOs of calculations, conditions and a library standard (CA1-A, CO1-A, BI1-A); the exported HTTP cohort is qualified
// separately at the final export.
import { describe, expect, it } from "vitest";
import { readFormDetail } from "./response";
import { openDraftSession } from "../draftSession";
import { fixtureDefinition, fixtureLifecycle, wireDefinition } from "@/test/visual/formFixtures";

const id = (index: number) => "01990000-0000-7000-8000-" + String(980 + index).padStart(12, "0");
const key = (fieldId: string) => "field_" + fieldId.replaceAll("-", "");
const concept = { fieldId: id(0), key: key(id(0)), type: "choice", label: { es: "Concepto" }, help: null, required: true, maxLength: null,
  options: [{ choiceId: id(10), label: { es: "Productos" } }, { choiceId: id(11), label: { es: "Servicios" } }] };
const net = { fieldId: id(1), key: key(id(1)), type: "decimal", label: { es: "Neto" }, help: null, required: false, maxLength: null, options: null,
  showWhen: { questionId: id(0), values: [id(11)] } };
const total = { fieldId: id(2), key: key(id(2)), type: "decimal", label: { es: "Total" }, help: null, required: false, maxLength: null, options: null,
  calculation: { operation: "sum", operands: [id(1)] } };
function detail(fields: readonly Record<string, unknown>[], extra: Record<string, unknown> = {}) {
  const wired = wireDefinition(fixtureDefinition());
  return { definition: { ...wired, draft: { ...wired.draft, fields }, ...extra }, lifecycle: fixtureLifecycle(fixtureDefinition().revision),
    capabilities: { canSave: true, canPublish: true, canPreview: false }, publication: { activeVersion: null, currentOperation: null, displayState: "Draft" },
    audit: { createdAtUtc: "2026-11-11T12:00:00Z", modifiedAtUtc: null, lastChangedAtUtc: "2026-11-11T12:00:00Z", lastChangedBy: null } };
}

describe("calculations, conditions and the library standard in the draft (CA1-A, CO1-A, BI1-A)", () => {
  it("reads them and opens them in the editor as they are", () => {
    const standard = { key: "arca.invoice", version: 1, bound: { total: id(2) } };
    const read = readFormDetail(detail([concept, net, total], { standard })).definition;

    expect(read.standard).toEqual(standard);
    const fields = openDraftSession({ actorId: "actor", editorId: "editor" }, read).value.draft.fields;
    expect(fields[1]).toMatchObject({ showWhen: { questionId: id(0), values: [id(11)] } });
    expect(fields[2]).toMatchObject({ calculation: { operation: "sum", operands: [id(1)] } });
    expect(readFormDetail(detail([concept, net, total])).definition.standard).toBeUndefined();
  });

  it("reads the toggles and the starting option a standard declares, and the editor sends them back as they came (IV1-A, IV2-A)", () => {
    const toggles = [{ key: "pricesIncludeVat", label: { es: "El precio incluye IVA", en: "Prices include VAT" },
      help: { es: "Marcala si cargás precios finales.", en: "Check it if you enter final prices." }, value: false }];
    const rate = { fieldId: id(4), key: key(id(4)), type: "choice", label: { es: "Alícuota" }, help: null, required: false, maxLength: null, options: null,
      source: { catalog: id(30), default: id(31) } };
    const read = readFormDetail(detail([concept, { ...net, toggles }, rate], { standard: { key: "arca.invoice", version: 1, bound: { unitPrice: id(1), vatRate: id(4) } } })).definition;

    const fields = openDraftSession({ actorId: "actor", editorId: "editor" }, read).value.draft.fields;
    expect(fields[1]?.toggles).toEqual(toggles);
    expect(fields[2]).toMatchObject({ source: { catalog: id(30), default: id(31) } });
    expect(() => readFormDetail(detail([concept, { ...net, toggles: [...toggles, ...toggles] }, total]))).toThrow();
    expect(() => readFormDetail(detail([concept, { ...net, toggles: [{ ...toggles[0], extra: true }] }, total]))).toThrow();
  });

  it.each([
    ["a required calculation", [concept, net, { ...total, required: true }]],
    ["a calculation that is not a number", [concept, net, { ...concept, fieldId: id(3), key: key(id(3)), options: concept.options.map((option, index) => ({ ...option, choiceId: id(20 + index) })), calculation: total.calculation }]],
    ["a product of three questions", [concept, net, { ...total, calculation: { operation: "multiply", operands: [id(0), id(1), id(0)] } }]],
    ["a condition without answers", [concept, { ...net, showWhen: { questionId: id(0), values: [] } }, total]],
    ["an unknown member", [concept, { ...net, showWhen: { ...net.showWhen, extra: true } }, total]],
  ])("rejects %s", (_, fields) => {
    expect(() => readFormDetail(detail(fields))).toThrow();
  });
});
