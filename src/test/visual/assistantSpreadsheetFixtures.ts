import type { AssistantTurn } from "@/features/artificial-intelligence/api/assistant";

// IA1-A and IA4 (Stage 2): `assistant-proposal-sheet` is the catalog «Contratistas» proposed from an Excel of 86 rows, with its
// columns and three sample rows; `assistant-proposal-import` imports that spreadsheet into the catalog that exists;
// `assistant-proposal-single` is a catalog of one column, its code and its option from the same letter (TC1-B, 2026-11-25).
export function spreadsheetProposalScene(base: AssistantTurn, en: boolean, scenario: string) {
  const ids = (index: number) => `0199a0c0-0000-7000-8005-${String(index).padStart(12, "0")}`;
  if (scenario === "assistant-proposal-single") return singleColumnScene(base, en, ids);
  const name = en ? "Contractors" : "Contratistas";
  const [codeHeader, optionHeader, trade, area] = en ? ["Tax ID", "Company name", "Trade", "Area"] : ["CUIT", "Razón social", "Rubro", "Zona"];
  const column = (target: string, letter: string, header: string, field: string | null = null, key: string | null = null) => ({ target, field, key, letter, header });
  const sample = [["20-11111111-1", "Transportes Sur", en ? "Grain" : "Granos", en ? "North" : "Norte"],
    ["20-22222222-2", "Logística Pampa", en ? "Livestock" : "Hacienda", en ? "South" : "Sur"],
    ["20-33333333-3", "Fletes del Oeste", en ? "Grain" : "Granos", en ? "West" : "Oeste"]];
  const sheet = (fields: readonly ReturnType<typeof column>[]) => ({ fileName: "contratistas.xlsx", sheetName: en ? "Sheet1" : "Hoja1", rowCount: 86,
    hasHeaders: true, columns: [column("code", "A", codeHeader), column("option", "B", optionHeader), ...fields], sample });
  const importing = scenario === "assistant-proposal-import";
  const proposal: AssistantTurn["proposal"] = importing
    ? { id: ids(22), capability: "forms.authoring.propose-import", version: 1, content: { catalog: { id: ids(90), name, valueType: "text" },
        spreadsheet: sheet([column("field", "C", trade, trade, "rubro"), column("field", "D", area, area, "zona")]) } }
    : { id: ids(21), capability: "forms.authoring.propose-catalog", version: 2, content: { culture: en ? "en" : "es", name,
        description: en ? "Companies that bring the load" : "Empresas que traen la carga", valueType: "text", code: codeHeader, option: optionHeader,
        fields: [{ name: trade, type: "text" }, { name: area, type: "text" }], spreadsheet: sheet([column("field", "C", trade, trade), column("field", "D", area, area)]) } };
  const current: AssistantTurn = {
    ...base, turnId: ids(1), requestId: ids(11), ordinal: 1, state: "completed", stage: "finished",
    question: importing ? (en ? "Import this spreadsheet into Contractors." : "Importá esta planilla en Contratistas.")
      : (en ? "Build me a catalog from this spreadsheet." : "Armame un catálogo con esta planilla."),
    answer: { kind: "proposal", evidenceIds: [], text: importing
      ? (en ? "Review the import in Contractors: the options the spreadsheet does not bring are deactivated."
        : "Revisá la importación en Contratistas: las opciones que no vienen en la planilla se dan de baja.")
      : (en ? "The code is the tax ID and each option, the company name, with the fields Trade and Area. There are 86 rows."
        : "El código es el CUIT y cada opción, la razón social, con los campos Rubro y Zona. Son 86 filas.") },
    evidences: [], proposal,
  };
  return { createdCatalogId: null, previous: [] as AssistantTurn[], current };
}

function singleColumnScene(base: AssistantTurn, en: boolean, ids: (index: number) => string) {
  const header = en ? "Task" : "Tarea";
  const column = (target: string) => ({ target, field: null, key: null, letter: "A", header });
  const sample = (en ? ["Sowing", "Harvest", "Spraying"] : ["Siembra", "Cosecha", "Fumigación"]).map(value => [value, value]);
  const proposal: AssistantTurn["proposal"] = { id: ids(23), capability: "forms.authoring.propose-catalog", version: 2, content: {
    culture: en ? "en" : "es", name: en ? "Task types" : "Tipos de tarea", valueType: "text", code: header, option: header, fields: [],
    description: en ? "The tasks recorded in each report" : "Las tareas que se cargan en cada parte",
    spreadsheet: { fileName: en ? "tasks.xlsx" : "tareas.xlsx", sheetName: en ? "Sheet1" : "Hoja1", rowCount: 12, hasHeaders: true,
      columns: [column("code"), column("option")], sample } } };
  const current: AssistantTurn = {
    ...base, turnId: ids(1), requestId: ids(11), ordinal: 1, state: "completed", stage: "finished",
    question: en ? "Build me a catalog from this spreadsheet." : "Armame un catálogo con esta planilla.",
    answer: { kind: "proposal", evidenceIds: [], text: en ? "Each option is a task, and its code is the same text. There are 12 rows."
      : "Cada opción es una tarea y su código es el mismo texto. Son 12 filas." },
    evidences: [], proposal,
  };
  return { createdCatalogId: null, previous: [] as AssistantTurn[], current };
}
