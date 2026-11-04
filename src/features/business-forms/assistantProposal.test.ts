import { describe, expect, it } from "vitest";
import { formProposalPreview, newQuestions, readProposal } from "./assistantProposal";
import { acceptsProposal, proposalCapabilities } from "./assistantProposalCapabilities";

const catalogId = "01990000-0000-7000-8000-000000000031";
const formContent = { culture: "es", name: "Control de carga", prefix: "CCC", submitLabel: "Enviar", questions: [
  { label: "Patente", type: "shortText", required: true, options: [], catalog: null },
  { label: "Kilos", type: "number", required: false, options: [], catalog: null },
  { label: "Turno", type: "choice", required: true, options: ["Mañana", "Tarde"], catalog: null },
  { label: "Controles", type: "multiChoice", required: false, options: ["Lona", "Precinto"], catalog: null },
  { label: "Campo", type: "catalog", required: true, options: [], catalog: { id: catalogId, name: "Campos" } },
  { label: "Foto del remito", type: "photo", required: true, options: [], catalog: null },
  { label: "¿Llegó sana?", type: "yesNo", required: false, options: [], catalog: null },
] };
const catalogContent = { culture: "es", name: "Transportistas", description: "Empresas que traen la carga", valueType: "text", code: "CUIT",
  option: "Razón social", fields: [{ name: "Teléfono", type: "text" }] };
const peopleContent = { metadataReadOrdinal: 2, name: "Supervisores", description: "Supervisores activos", limitations: [],
  filters: { textColumn: "name", detailColumn: "role", conditions: [{ column: "active", operator: "equals", value: "true" }], excludeRecipient: false, sortColumn: "name", sortDescending: false } };
const proposal = (capability: string, content: unknown, version = 1) => ({ id: "01990000-0000-7000-8000-000000000041", capability, version, content });
function readForm(content: unknown) {
  const read = readProposal(proposal(proposalCapabilities.form, content));
  if (read?.kind !== "form") throw new Error("The fixture is not a form proposal.");
  return read.content;
}

describe("assistant proposals of the forms module", () => {
  it("reads the three proposals it owns, and no other capability, version or shape", () => {
    expect(readProposal(proposal(proposalCapabilities.form, formContent))?.kind).toBe("form");
    expect(readProposal(proposal(proposalCapabilities.catalog, catalogContent))?.kind).toBe("catalog");
    expect(readProposal(proposal(proposalCapabilities.people, peopleContent))?.kind).toBe("people");
    expect(readProposal(proposal(proposalCapabilities.form, formContent, 2))).toBeNull();
    expect(readProposal(proposal("fixture.propose", formContent))).toBeNull();
    expect(readProposal(proposal(proposalCapabilities.form, { ...formContent, extra: true }))).toBeNull();
    expect(readProposal(proposal(proposalCapabilities.catalog, formContent))).toBeNull();
  });

  it("accepts its capabilities before loading the card, by name and version only", () => {
    expect(acceptsProposal(proposal(proposalCapabilities.people, {}))).toBe(true);
    expect(acceptsProposal(proposal(proposalCapabilities.form, formContent, 2))).toBe(false);
    expect(acceptsProposal(proposal("fixture.propose", formContent))).toBe(false);
  });

  it("previews the same draft the server creates", () => {
    const value = formProposalPreview(readForm(formContent));
    expect(value.name).toEqual({ es: "Control de carga" });
    expect(value.prefix).toBe("CCC");
    expect(value.draft.submitLabel).toEqual({ es: "Enviar" });
    expect(value.draft.fields.map(field => field.type)).toEqual(["shortText", "decimal", "choice", "multiChoice", "choice", "photo", "boolean"]);
    expect(value.draft.fields[2]).toMatchObject({ required: true, options: [{ label: { es: "Mañana" } }, { label: { es: "Tarde" } }] });
    expect(value.draft.fields[3]).toMatchObject({ selection: { minSelected: 0, maxSelected: 2 } });
    expect(value.draft.fields[4]).toMatchObject({ source: { catalog: catalogId } });
    expect(value.draft.fields[5]).toMatchObject({ files: { minFiles: 1, maxFiles: 1, photoSource: "cameraOrGallery" } });
  });

  it("marks as new only what was not, the same, in the proposal it replaced", () => {
    const content = readForm(formContent);
    const before = { ...formContent, questions: [formContent.questions[0], { ...formContent.questions[1], required: true }] };
    expect([...newQuestions(content, proposal(proposalCapabilities.form, before))]).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...newQuestions(content, null)]).toEqual([]);
    expect([...newQuestions(content, proposal(proposalCapabilities.catalog, catalogContent))]).toEqual([]);
  });
});
