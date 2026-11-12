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
// Stage 2: the catalog that maps the turn's spreadsheet and the import into a catalog that exists, as the server serializes them.
const code = { target: "code", field: null, key: null, letter: "A", header: "CUIT" };
const option = { target: "option", field: null, key: null, letter: "B", header: "Razón social" };
const sheet = { fileName: "contratistas.xlsx", sheetName: "Hoja1", rowCount: 86, hasHeaders: true,
  columns: [code, option, { target: "field", field: "Rubro", key: null, letter: "C", header: "Rubro" }],
  sample: [["20-11111111-1", "Transportes Sur", "Granos"], ["20-22222222-2", "Logística Pampa", "Hacienda"], ["20-33333333-3", "Fletes del Oeste", "Granos"]] };
const mappedContent = { ...catalogContent, fields: [{ name: "Rubro", type: "text" }], spreadsheet: sheet };
const importContent = { catalog: { id: catalogId, name: "Contratistas", valueType: "text" },
  spreadsheet: { ...sheet, columns: [code, option, { target: "field", field: "Rubro", key: "rubro", letter: "C", header: "Rubro" }] } };
const peopleContent = { metadataReadOrdinal: 2, name: "Supervisores", description: "Supervisores activos", limitations: [],
  filters: { textColumn: "name", detailColumn: "role", conditions: [{ column: "active", operator: "equals", value: "true" }], excludeRecipient: false, sortColumn: "name", sortDescending: false } };
const proposal = (capability: string, content: unknown, version = 1) => ({ id: "01990000-0000-7000-8000-000000000041", capability, version, content });
function readForm(content: unknown) {
  const read = readProposal(proposal(proposalCapabilities.form, content));
  if (read?.kind !== "form") throw new Error("The fixture is not a form proposal.");
  return read.content;
}

describe("assistant proposals of the forms module", () => {
  it("reads the proposals it owns, and no other capability, version or shape", () => {
    expect(readProposal(proposal(proposalCapabilities.form, formContent))?.kind).toBe("form");
    expect(readProposal(proposal(proposalCapabilities.catalog, catalogContent))?.kind).toBe("catalog");
    expect(readProposal(proposal(proposalCapabilities.people, peopleContent))?.kind).toBe("people");
    expect(readProposal(proposal(proposalCapabilities.form, formContent, 2))).toBeNull();
    expect(readProposal(proposal("fixture.propose", formContent))).toBeNull();
    expect(readProposal(proposal(proposalCapabilities.form, { ...formContent, extra: true }))).toBeNull();
    expect(readProposal(proposal(proposalCapabilities.catalog, formContent))).toBeNull();
  });

  it("reads the catalog with its spreadsheet (version 2), without one, and version 1 as a catalog without a spreadsheet", () => {
    expect(readProposal(proposal(proposalCapabilities.catalog, mappedContent, 2))).toEqual({ kind: "catalog", content: mappedContent });
    expect(readProposal(proposal(proposalCapabilities.catalog, { ...mappedContent, spreadsheet: null }, 2))).toEqual({ kind: "catalog", content: { ...mappedContent, spreadsheet: null } });
    expect(readProposal(proposal(proposalCapabilities.catalog, catalogContent))).toEqual({ kind: "catalog", content: { ...catalogContent, spreadsheet: null } });
    expect(readProposal(proposal(proposalCapabilities.catalog, mappedContent))).toBeNull();
    expect(readProposal(proposal(proposalCapabilities.catalog, catalogContent, 2))).toBeNull();
    expect(readProposal(proposal(proposalCapabilities.catalog, { ...mappedContent, spreadsheet: { ...sheet, extra: true } }, 2))).toBeNull();
    expect(readProposal(proposal(proposalCapabilities.catalog, { ...mappedContent, spreadsheet: { ...sheet, columns: [{ ...code, target: "other" }, option] } }, 2))).toBeNull();
  });

  it("reads the import into a catalog that exists, with its mapping, and no other version or shape", () => {
    expect(readProposal(proposal(proposalCapabilities.catalogImport, importContent))).toEqual({ kind: "import", content: importContent });
    expect(readProposal(proposal(proposalCapabilities.catalogImport, importContent, 2))).toBeNull();
    expect(readProposal(proposal(proposalCapabilities.catalogImport, { ...importContent, spreadsheet: null }))).toBeNull();
    expect(readProposal(proposal(proposalCapabilities.catalogImport, { ...importContent, catalog: { ...importContent.catalog, kind: "manual" } }))).toBeNull();
  });

  // Etapa 3 de la IA: version 2 adds the reading the proposal turns on, what each question read in the document and a similar library
  // standard, each one null or exactly its object; version 1 reads as a form without them.
  const recognition = "Comprobantes de transferencia: muestran el monto, la fecha y las cuentas de origen y de destino.";
  const documentContent = { ...formContent, questions: formContent.questions.map((question, index) => ({ ...question, sample: index === 0 ? "AB 123 CD" : null })),
    documentReading: { recognition }, standard: { key: "transfer-receipt", name: "Comprobante de transferencia" } };
  it("reads the form with a document (version 2), with its reading, samples and standard, and version 1 as a form without them", () => {
    expect(readProposal(proposal(proposalCapabilities.form, documentContent, 2))).toEqual({ kind: "form", content: documentContent });
    const off = { ...documentContent, documentReading: null, standard: null };
    expect(readProposal(proposal(proposalCapabilities.form, off, 2))).toEqual({ kind: "form", content: off });
    expect(readForm(formContent)).toEqual({ ...formContent, questions: formContent.questions.map(question => ({ ...question, sample: null })),
      documentReading: null, standard: null });
  });

  const { documentReading: _reading, ...withoutReading } = documentContent;
  const { standard: _standard, ...withoutStandard } = documentContent;
  it.each([
    ["version 1's shape", formContent],
    ["no reading", withoutReading],
    ["no standard", withoutStandard],
    ["a question without its sample", { ...documentContent, questions: formContent.questions }],
    ["a reading without its text", { ...documentContent, documentReading: {} }],
    ["a reading with more than its text", { ...documentContent, documentReading: { recognition, crossings: [] } }],
    ["a standard without its name", { ...documentContent, standard: { key: "transfer-receipt" } }],
    ["a field outside the contract", { ...documentContent, extra: true }],
  ])("reads no form with a document whose content has %s", (_, content) => {
    expect(readProposal(proposal(proposalCapabilities.form, content, 2))).toBeNull();
  });

  it("accepts its capabilities before loading the card, by name and version only", () => {
    expect(acceptsProposal(proposal(proposalCapabilities.people, {}))).toBe(true);
    expect(acceptsProposal(proposal(proposalCapabilities.form, formContent, 2))).toBe(true);
    expect(acceptsProposal(proposal(proposalCapabilities.form, formContent, 3))).toBe(false);
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
    expect([...newQuestions(content, proposal(proposalCapabilities.catalogImport, importContent))]).toEqual([]);
  });

  it("compares the questions of the two versions without what they read: a sample is not a new question", () => {
    const read = readProposal(proposal(proposalCapabilities.form, documentContent, 2));
    if (read?.kind !== "form") throw new Error("The fixture is not a form proposal.");
    expect([...newQuestions(read.content, proposal(proposalCapabilities.form, formContent))]).toEqual([]);
    const resampled = { ...documentContent, questions: documentContent.questions.map(question => ({ ...question, sample: "Otro" })) };
    expect([...newQuestions(readForm(formContent), proposal(proposalCapabilities.form, resampled, 2))]).toEqual([]);
    const changed = { ...documentContent, questions: [{ ...documentContent.questions[0], label: "Dominio" }, ...documentContent.questions.slice(1)] };
    expect([...newQuestions(read.content, proposal(proposalCapabilities.form, changed, 2))]).toEqual([0]);
  });
});
