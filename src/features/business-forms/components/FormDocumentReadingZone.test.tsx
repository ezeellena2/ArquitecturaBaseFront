import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { cellUnder } from "@/test/utils/tableCells";
import { readingCatalog, readingDefinition, readingIds, readingStats, transferReceiptStandard } from "@/test/visual/documentReadingFixtures";
import { fixtureDefinition } from "@/test/visual/formFixtures";
import { openDraftSession } from "../draftSession";
import type { DraftEditorValue, FormDefinitionSnapshot } from "../model";
import type { DraftFieldIssue } from "../validationPaths";
import { FormDocumentReadingZone } from "./FormDocumentReadingZone";

// DOC1: «Lectura de documentos» after «Preguntas». A copy of «Comprobante de transferencia» shows the questions that receive its data,
// sealed with their fixed validations, its lookup, what marks a repeated document and «Cómo viene leyendo»; an own form, only the
// switch, «Cómo reconocerlo» and the lookups. Synthetic bodies: no HTTP capture of the stats exists yet.
const manage = ["formtemplates.read", "formtemplates.manage", "formcatalogs.read", "formrecords.read"];
let statsReads = 0;
function Harness({ definition, readOnly = false, permissions = manage, issues = [], showIncomplete = false, onValue, onClient }: {
  definition: FormDefinitionSnapshot; readOnly?: boolean; permissions?: string[]; issues?: DraftFieldIssue[]; showIncomplete?: boolean; onValue?: (value: DraftEditorValue) => void;
  onClient?: (client: QueryClient) => void;
}) {
  const [value, setValue] = useState(() => openDraftSession({ actorId: "actor", editorId: "editor" }, definition).value);
  const client = useQueryClient();
  onClient?.(client);
  return <FormDocumentReadingZone value={value} onChange={next => { setValue(next); onValue?.(next); }} readOnly={readOnly} scope={{ actorId: "actor", culture: "es", permissions }}
    standard={definition.standard} definitionId={definition.id} culture="es" timeZoneId="America/Argentina/Buenos_Aires" issues={issues} showIncomplete={showIncomplete} />;
}
const open = async () => userEvent.click(await screen.findByRole("button", { name: "Expandir «Lectura de documentos»" }));
const fold = async () => userEvent.click(screen.getByRole("button", { name: "Plegar «Lectura de documentos»" }));
// The real texts of the server: a value of the draft it rejects, and a lookup whose field no longer compares when publishing.
const contentInvalid = "Revisá el valor y los límites de autoría del borrador.";
const lookupInvalid = "Revisá el cruce con el catálogo de la lectura de documentos: el campo ya no está o no se puede comparar con esa pregunta.";
const onPhone = () => vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(max-width: 639px)", media: query, onchange: null,
  addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));

beforeEach(() => {
  statsReads = 0;
  server.use(
    http.get("/api/forms/library", () => HttpResponse.json({ standards: [transferReceiptStandard("es")] })),
    http.get("/api/forms/catalogs/:id", ({ params }) => { const catalog = readingCatalog(String(params.id)); return catalog ? HttpResponse.json(catalog) : HttpResponse.json({ code: "Forms.Catalog.NotFound" }, { status: 404 }); }),
    http.get("/api/forms/definitions/:id/document-reading", () => { statsReads++; return HttpResponse.json(readingStats("es")); }));
});

describe("a copy of a library standard", () => {
  it("says folded that it reads, and opened, the sealed questions, the lookup, the repeated data and how it is reading", async () => {
    renderWithProviders(<Harness definition={readingDefinition("es")} />);
    // Folded it says what is configured, and «Cómo viene leyendo» waits until it is shown.
    expect(await screen.findByText("Prendida · 1 cruce con catálogos")).toBeInTheDocument();
    expect(statsReads).toBe(0);
    await open();

    expect(screen.getByRole("checkbox", { name: "Leer los documentos que lleguen por WhatsApp" })).toBeChecked();
    expect(screen.getByRole("textbox", { name: /^Cómo reconocerlo/ })).toHaveValue(readingDefinition("es").draft.documentReading!.recognition);
    // Each datum of the standard, in its order, with the question «Agregar» bound to it (its type in grey) and its fixed validation;
    // the renamed question still receives its datum.
    const data = await screen.findByRole("table", { name: "Datos del estándar" });
    expect(within(data).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Dato del estándar", "Pregunta que lo recibe", "Validación fija"]);
    const rows = within(data).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(14);
    expect(cellUnder(data, rows[1]!, "Dato del estándar")).toHaveTextContent("Cuenta de origenTexto corto");
    expect(cellUnder(data, rows[1]!, "Pregunta que lo recibe")).toHaveTextContent(/^Cuenta de origen$/);
    expect(cellUnder(data, rows[1]!, "Validación fija")).toHaveTextContent(/^Dígitos verificadores del CBU y del CVU$/);
    expect(cellUnder(data, rows[2]!, "Dato del estándar")).toHaveTextContent("Titular de origen");
    expect(cellUnder(data, rows[2]!, "Pregunta que lo recibe")).toHaveTextContent(/^Quién transfirió$/);
    expect(cellUnder(data, rows[2]!, "Validación fija")).toHaveTextContent(/^—$/);
    expect(cellUnder(data, rows[3]!, "Validación fija")).toHaveTextContent(/^Dígito verificador del CUIT o CUIL$/);
    expect(cellUnder(data, rows[13]!, "Dato del estándar")).toHaveTextContent("ConceptoTexto largo");
    // The standard and its version are in the (i): the header already names them.
    await userEvent.hover(screen.getByRole("button", { name: "Más información sobre Datos del estándar" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("«Agregar» fijó qué pregunta recibe cada dato de «Comprobante de transferencia», versión 1");

    // The lookup: the question read, the one it fills and the catalog field it compares.
    expect(screen.getByRole("button", { name: "Cruce 1 · Dato leído CUIT o CUIL de origen (pregunta 5)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cruce 1 · Completa Cliente (pregunta 1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cruce 1 · Se busca por CUIT" })).toBeInTheDocument();

    expect(await screen.findByText("El mismo archivo, o uno que coincide en Número de operación, Monto y Fecha.")).toBeInTheDocument();
    expect(statsReads).toBe(1);
    expect(screen.getByText("Documentos confirmados").nextElementSibling).toHaveTextContent(/^118$/);
    expect(screen.getByText("Desde").nextElementSibling).toHaveTextContent(/^12\/10\/2026$/);
    expect(screen.getByText("La que más se corrige").nextElementSibling).toHaveTextContent("Número de operación · 14 correcciones");
    // Per question, the share of what it read that was confirmed without changes: 98 of 112 for the operation number, rounded down,
    // so it never says all of it when something was corrected.
    const reading = screen.getByRole("table", { name: "Cómo viene leyendo" });
    expect(within(reading).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Pregunta", "Sin corregir"]);
    const operation = within(reading).getAllByRole("row").find(row => row.textContent?.startsWith("Número de operación"))!;
    expect(cellUnder(reading, operation, "Sin corregir")).toHaveTextContent(/^87\s?%$/);
  });

  it("takes the fixed validation from the question of the copy, whatever the library names", async () => {
    const definition = readingDefinition("es");
    // The copy's own questions say it: the source account without one, and the holder with the CUIT's.
    const fields = definition.draft.fields.map(question => question.fieldId === readingIds.sourceAccount ? (({ validation: _none, ...rest }) => rest)(question as typeof question & { validation?: string })
      : question.fieldId === readingIds.sourceHolder ? { ...question, validation: "taxId" } : question) as typeof definition.draft.fields;
    renderWithProviders(<Harness definition={{ ...definition, draft: { ...definition.draft, fields } }} />);
    await open();
    const data = await screen.findByRole("table", { name: "Datos del estándar" });
    const [, account, holder] = within(data).getAllByRole("row").slice(1);
    expect(cellUnder(data, account!, "Validación fija")).toHaveTextContent(/^—$/);
    expect(cellUnder(data, holder!, "Validación fija")).toHaveTextContent(/^Dígito verificador del CUIT o CUIL$/);
  });

  it("is not read again when the zone is folded and opened", async () => {
    renderWithProviders(<Harness definition={readingDefinition("es")} />);
    await open();
    expect(await screen.findByText("Documentos confirmados")).toBeInTheDocument();
    await fold();
    await open();
    expect(screen.getByText("Documentos confirmados")).toBeInTheDocument();
    expect(statsReads).toBe(1);
  });

  it("keeps «Reintentar» off with the wait of a 429 as its reason", async () => {
    server.use(http.get("/api/forms/definitions/:id/document-reading", () => HttpResponse.json({ title: "Too many requests", status: 429, code: "RateLimit", retryAfter: 30 },
      { status: 429, headers: { "Retry-After": "30" } })));
    renderWithProviders(<Harness definition={readingDefinition("es")} />);
    await open();
    expect(await screen.findByText("No pudimos cargar cómo viene leyendo.")).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: "Reintentar" });
    await waitFor(() => expect(retry).toHaveAttribute("aria-disabled", "true"));
    expect(retry).toHaveAccessibleDescription(/^Esperá (29|30) segundos para volver a intentar\.$/);
  });

  it("takes how it is reading away with a 403, from the screen and from the cache", async () => {
    let reads = 0;
    server.use(http.get("/api/forms/definitions/:id/document-reading", () => { reads++; return HttpResponse.json({ code: "General.Forbidden" }, { status: 403 }); }));
    let client: QueryClient | undefined;
    renderWithProviders(<Harness definition={readingDefinition("es")} onClient={value => { client = value; }} />);
    await open();
    await waitFor(() => expect(reads).toBe(1));
    await waitFor(() => expect(screen.queryByText("Cómo viene leyendo")).not.toBeInTheDocument());
    expect(screen.queryByText("Repetidos")).not.toBeInTheDocument();
    const cached = client!.getQueryCache().findAll().filter(query => JSON.stringify(query.queryKey).includes("document-reading"));
    expect(cached.every(query => query.state.data === undefined && query.state.error === null)).toBe(true);
    // Folded and opened again, it does not ask once more.
    await fold();
    await open();
    expect(reads).toBe(1);
  });

  it("says «Sin pregunta» for a datum whose question is no longer in the draft, and keeps the others in the standard's order", async () => {
    const definition = readingDefinition("es");
    // The questions moved and the time is gone: each datum still finds its question by its key.
    const fields = [...definition.draft.fields].reverse().filter(question => question.fieldId !== readingIds.time);
    renderWithProviders(<Harness definition={{ ...definition, draft: { ...definition.draft, fields } }} />);
    await open();
    const data = await screen.findByRole("table", { name: "Datos del estándar" });
    const rows = within(data).getAllByRole("row").slice(1);
    expect(rows.map(row => cellUnder(data, row, "Dato del estándar").firstChild?.textContent)).toEqual(transferReceiptStandard("es").reads!.map(read => read.name));
    const time = rows.find(row => row.textContent?.startsWith("Hora"))!;
    expect(cellUnder(data, time, "Pregunta que lo recibe")).toHaveTextContent(/^Sin pregunta$/);
    expect(cellUnder(data, time, "Dato del estándar")).toHaveTextContent(/^Hora$/);
    expect(cellUnder(data, rows[0]!, "Pregunta que lo recibe")).toHaveTextContent(/^Banco o billetera de origen$/);
  });

  it("shows the latest corrections side by side only to whoever reads responses, one group per response", async () => {
    renderWithProviders(<Harness definition={readingDefinition("es")} />);
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Ver los ejemplos (3)" }));
    // The latest ones, up to ten: the title does not say they are all those of the window.
    const dialog = await screen.findByRole("dialog", { name: "Últimas correcciones" });
    expect(within(dialog).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Respuesta", "Fecha", "Pregunta", "Leído", "Confirmado"]);
    // Each response once, with its number (and on the phone its date too), over its corrections.
    const responses = within(dialog).getAllByRole("rowheader").map(header => header.textContent ?? "").filter(text => text.startsWith("REC-"));
    expect(responses.map(text => text.slice(0, 10))).toEqual(["REC-000118", "REC-000117"]);
    expect(within(dialog).getByText("0012345678")).toBeInTheDocument();
    expect(within(dialog).getByText("0012345679")).toBeInTheDocument();
    // What was not read says so in grey.
    const holder = within(dialog).getAllByRole("row").find(row => row.textContent?.includes("Quién transfirió"))!;
    expect(holder).toHaveTextContent("—Pérez Hnos.");
    await userEvent.click(within(dialog).getAllByRole("button", { name: "Cerrar" }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("without «Ver respuestas» shows only the numbers, and says when there were no corrections", async () => {
    server.use(http.get("/api/forms/definitions/:id/document-reading", () => HttpResponse.json(readingStats("es", false))));
    const { unmount } = renderWithProviders(<Harness definition={readingDefinition("es")} permissions={["formtemplates.read", "formtemplates.manage"]} />);
    await open();
    expect(await screen.findByText("Documentos confirmados")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ver los ejemplos/ })).not.toBeInTheDocument();
    unmount();
    server.use(http.get("/api/forms/definitions/:id/document-reading", () => HttpResponse.json({ ...readingStats("es", false), examples: [] })));
    renderWithProviders(<Harness definition={readingDefinition("es")} />);
    await open();
    const button = await screen.findByRole("button", { name: "Ver los ejemplos (0)" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("No hubo correcciones en los últimos 30 días.");
  });

  it("says when it could not read how it is reading, and reads it again with «Reintentar»", async () => {
    let fail = true;
    server.use(http.get("/api/forms/definitions/:id/document-reading", () => fail ? HttpResponse.json({ code: "General.Unexpected" }, { status: 500 }) : HttpResponse.json(readingStats("es"))));
    renderWithProviders(<Harness definition={readingDefinition("es")} />);
    await open();
    expect(await screen.findByText("No pudimos cargar cómo viene leyendo.")).toBeInTheDocument();
    // What marks a repeated document comes in the same reading: it is not shown half.
    expect(screen.queryByText("Repetidos")).not.toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Documentos confirmados")).toBeInTheDocument();
    expect(screen.getByText("Repetidos")).toBeInTheDocument();
  });
});

describe("the reading of an own form", () => {
  const own = (): FormDefinitionSnapshot => { const base = fixtureDefinition("es"); return { ...base, draft: { ...base.draft, documentReading: { enabled: true, recognition: "Remito firmado por el cliente.", lookups: [] } } }; };

  it("has only the switch, «Cómo reconocerlo» and the lookups, without asking how it is reading", async () => {
    renderWithProviders(<Harness definition={own()} />);
    await open();
    expect(screen.getByRole("textbox", { name: /^Cómo reconocerlo/ })).toHaveValue("Remito firmado por el cliente.");
    expect(screen.getByText("Cruce con catálogos")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Datos del estándar" })).not.toBeInTheDocument();
    expect(screen.queryByText("Repetidos")).not.toBeInTheDocument();
    expect(screen.queryByText("Cómo viene leyendo")).not.toBeInTheDocument();
    expect(statsReads).toBe(0);
    // The visit has no catalog question: there is nothing to fill.
    const add = screen.getByRole("button", { name: "Agregar cruce" });
    expect(add).toHaveAttribute("aria-disabled", "true");
    expect(add).toHaveAccessibleDescription("No hay preguntas «Elegir de un catálogo» para completar.");
  });

  it("turned off shows only the switch and keeps what was written, which comes back when it is turned on", async () => {
    let last: DraftEditorValue | undefined;
    renderWithProviders(<Harness definition={own()} onValue={value => { last = value; }} />);
    await open();
    await userEvent.click(screen.getByRole("checkbox", { name: "Leer los documentos que lleguen por WhatsApp" }));
    expect(screen.queryByRole("textbox", { name: /^Cómo reconocerlo/ })).not.toBeInTheDocument();
    expect(last?.draft.documentReading).toEqual({ enabled: false, recognition: "Remito firmado por el cliente.", lookups: [] });
    await userEvent.click(screen.getByRole("button", { name: "Plegar «Lectura de documentos»" }));
    expect(screen.getByText("Apagada")).toBeInTheDocument();
    await open();
    await userEvent.click(screen.getByRole("checkbox", { name: "Leer los documentos que lleguen por WhatsApp" }));
    expect(screen.getByRole("textbox", { name: /^Cómo reconocerlo/ })).toHaveValue("Remito firmado por el cliente.");
  });

  it("asks for «Cómo reconocerlo» after a save stopped while it is on, opening by itself", async () => {
    const base = own();
    renderWithProviders(<Harness definition={{ ...base, draft: { ...base.draft, documentReading: { enabled: true, recognition: "  ", lookups: [] } } }} showIncomplete />);
    expect(await screen.findByRole("button", { name: "Plegar «Lectura de documentos»" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("textbox", { name: /^Cómo reconocerlo/ })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Escribí cómo reconocer el documento.")).toBeInTheDocument();
  });

  it("read only and without lookups does not show «Cruce con catálogos»", async () => {
    renderWithProviders(<Harness definition={own()} readOnly permissions={["formtemplates.read"]} />);
    await open();
    expect(screen.getByRole("textbox", { name: /^Cómo reconocerlo/ })).toHaveAttribute("readonly");
    expect(screen.queryByText("Cruce con catálogos")).not.toBeInTheDocument();
  });

  it("turned on for the first time starts without text, and off again leaves the draft as it was", async () => {
    let last: DraftEditorValue | undefined;
    renderWithProviders(<Harness definition={fixtureDefinition("es")} onValue={value => { last = value; }} />);
    expect(await screen.findByText("Apagada")).toBeInTheDocument();
    await open();
    await userEvent.click(screen.getByRole("checkbox", { name: "Leer los documentos que lleguen por WhatsApp" }));
    expect(screen.getByRole("textbox", { name: /^Cómo reconocerlo/ })).toHaveValue("");
    await userEvent.click(screen.getByRole("checkbox", { name: "Leer los documentos que lleguen por WhatsApp" }));
    expect(last?.draft).not.toHaveProperty("documentReading");
  });
});

describe("the lookups", () => {
  it("adds one with the focus on what it reads, offers what can be compared and removes it without asking", async () => {
    let last: DraftEditorValue | undefined;
    renderWithProviders(<Harness definition={readingDefinition("es")} onValue={value => { last = value; }} />);
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Agregar cruce" }));
    const read = screen.getByRole("button", { name: /^Cruce 2 · Dato leído / });
    await waitFor(() => expect(read).toHaveFocus());
    // What it reads: texts, numbers and dates outside the block; what it fills: the catalog questions of one choice, without
    // the one another lookup already fills.
    // «Elegí una opción» is what the field says while none is chosen, not an option.
    const reads = await openList(read);
    expect(within(reads).getAllByRole("option").map(option => option.textContent)).toContain("Monto (pregunta 10)");
    await userEvent.click(within(reads).getByRole("option", { name: /^Número de operación \(pregunta \d+\)$/ }));
    const fills = await openList(/^Cruce 2 · Completa /);
    expect(within(fills).getAllByRole("option").map(option => option.textContent)).toEqual(["Banco o billetera de origen (pregunta 2)", "Banco o billetera de destino (pregunta 6)"]);
    await userEvent.click(within(fills).getByRole("option", { name: "Banco o billetera de origen (pregunta 2)" }));
    const by = screen.getByRole("button", { name: /^Cruce 2 · Se busca por / });
    const ways = await openList(by);
    expect(within(ways).getAllByRole("option").map(option => option.textContent)).toEqual(["Código", "Texto"]);
    await userEvent.click(within(ways).getByRole("option", { name: "Código" }));
    expect(last?.draft.documentReading?.lookups[1]).toEqual({ questionId: readingIds.sourceBank, sourceQuestionId: readingIds.operationNumber, field: "code" });
    // Reading a number, the option's code no longer serves: it is chosen again.
    await pick(read, "Monto (pregunta 10)");
    expect(by).toHaveAccessibleName("Cruce 2 · Se busca por Elegí una opción");
    await userEvent.click(screen.getByRole("button", { name: "Quitar el cruce 2" }));
    expect(last?.draft.documentReading?.lookups).toHaveLength(1);
    await waitFor(() => expect(screen.getByRole("button", { name: "Agregar cruce" })).toHaveFocus());
  });

  it("stops at five, and after trying to save opens by itself and says what each lookup lacks", async () => {
    const definition = readingDefinition("es");
    const reading = definition.draft.documentReading!;
    const started = { questionId: "", sourceQuestionId: readingIds.time, field: "" };
    renderWithProviders(<Harness definition={{ ...definition, draft: { ...definition.draft, documentReading: { ...reading, lookups: [...reading.lookups, started, started, started, started] } } }} showIncomplete />);
    // Opened by the problem, without touching the arrow.
    expect(await screen.findByRole("button", { name: "Plegar «Lectura de documentos»" })).toHaveAttribute("aria-expanded", "true");
    const add = screen.getByRole("button", { name: "Agregar cruce" });
    expect(add).toHaveAttribute("aria-disabled", "true");
    expect(add).toHaveAccessibleDescription("Se pueden agregar hasta 5 cruces.");
    expect(screen.getAllByText("Elegí el dato leído, la pregunta que completa y por qué se busca.")).toHaveLength(4);
    // Only what is missing is marked.
    expect(screen.getByRole("button", { name: /^Cruce 2 · Completa / })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: /^Cruce 2 · Se busca por / })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: /^Cruce 2 · Dato leído / })).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("button", { name: /^Cruce 1 · Completa / })).not.toHaveAttribute("aria-invalid");
  });

  it("does not add another one when every catalog question already has its lookup", async () => {
    const definition = readingDefinition("es");
    const reading = definition.draft.documentReading!;
    const lookups = [...reading.lookups, { questionId: readingIds.sourceBank, sourceQuestionId: readingIds.sourceAccount, field: "code" },
      { questionId: readingIds.destinationBank, sourceQuestionId: readingIds.destinationAccount, field: "code" }];
    renderWithProviders(<Harness definition={{ ...definition, draft: { ...definition.draft, documentReading: { ...reading, lookups } } }} />);
    await open();
    const add = screen.getByRole("button", { name: "Agregar cruce" });
    expect(add).toHaveAttribute("aria-disabled", "true");
    expect(add).toHaveAccessibleDescription("Cada pregunta «Elegir de un catálogo» ya tiene su cruce.");
  });

  it("shows the server's problems under their lookup and «Cómo reconocerlo», opening the zone", async () => {
    renderWithProviders(<Harness definition={readingDefinition("es")} issues={[
      { path: "draft.documentReading.recognition", messages: [contentInvalid] },
      { path: "draft.documentReading.lookups[0].field", messages: [lookupInvalid] }]} />);
    expect(await screen.findByText(contentInvalid)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^Cómo reconocerlo/ })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Se busca por: " + lookupInvalid.charAt(0).toLowerCase() + lookupInvalid.slice(1))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Cruce 1 · Se busca por / })).toHaveAttribute("aria-invalid", "true");
  });

  it("turned off, drops a lookup still to complete, and a problem of what it hides neither opens it nor shows", async () => {
    let last: DraftEditorValue | undefined;
    const { unmount } = renderWithProviders(<Harness definition={readingDefinition("es")} onValue={value => { last = value; }} />);
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Agregar cruce" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Leer los documentos que lleguen por WhatsApp" }));
    expect(last?.draft.documentReading).toEqual({ ...readingDefinition("es").draft.documentReading, enabled: false });
    unmount();
    const definition = readingDefinition("es");
    renderWithProviders(<Harness definition={{ ...definition, draft: { ...definition.draft, documentReading: { ...definition.draft.documentReading!, enabled: false } } }}
      issues={[{ path: "draft.documentReading.lookups[0].questionId", messages: [contentInvalid] }]} />);
    expect(await screen.findByText("Apagada")).toBeInTheDocument();
    expect(screen.queryByText(contentInvalid)).not.toBeInTheDocument();
  });

  it("says it is loading the catalog's fields instead of «Campo no disponible», and then names the field", async () => {
    let release = () => {};
    const held = new Promise<void>(resolve => { release = resolve; });
    server.use(http.get("/api/forms/catalogs/:id", async ({ params }) => { await held; return HttpResponse.json(readingCatalog(String(params.id))); }));
    renderWithProviders(<Harness definition={readingDefinition("es")} />);
    await open();
    const by = screen.getByRole("button", { name: /^Cruce 1 · Se busca por / });
    expect(by).toHaveAccessibleName("Cruce 1 · Se busca por Cargando…");
    expect(by).toBeDisabled();
    expect(screen.queryByText("Campo no disponible")).not.toBeInTheDocument();
    release();
    await waitFor(() => expect(by).toHaveAccessibleName("Cruce 1 · Se busca por CUIT"));
    expect(by).toBeEnabled();
  });

  it("without «Ver catálogos» says why «Se busca por» cannot name a field, and offers the option's code or text for a text", async () => {
    renderWithProviders(<Harness definition={readingDefinition("es")} permissions={["formtemplates.read", "formtemplates.manage"]} />);
    await open();
    const saved = screen.getByRole("button", { name: /^Cruce 1 · Se busca por / });
    expect(saved).toBeDisabled();
    expect(saved).toHaveAccessibleName("Cruce 1 · Se busca por Campo no disponible");
    expect(saved).toHaveAccessibleDescription("Necesitás permiso para leer catálogos y ver sus campos.");
    await userEvent.click(screen.getByRole("button", { name: "Agregar cruce" }));
    await pick(/^Cruce 2 · Completa /, "Banco o billetera de origen (pregunta 2)");
    // A text compares with the option's code or text; a number, only with a field it cannot list.
    await pick(/^Cruce 2 · Dato leído /, /^Número de operación \(pregunta \d+\)$/);
    expect(screen.getByRole("button", { name: /^Cruce 2 · Se busca por / })).toBeEnabled();
    await pick(/^Cruce 2 · Dato leído /, "Monto (pregunta 10)");
    expect(screen.getByRole("button", { name: /^Cruce 2 · Se busca por / })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Cruce 2 · Se busca por / })).toHaveAccessibleDescription("Necesitás permiso para leer catálogos y ver sus campos.");
  });

  it("on the phone, adds, removes, retries and chooses on targets of 44 px", async () => {
    onPhone();
    try {
      renderWithProviders(<Harness definition={readingDefinition("es")} />);
      await open();
      expect(await screen.findByRole("button", { name: "Ver los ejemplos (3)" })).toHaveClass("min-h-11");
      expect(screen.getByRole("button", { name: "Agregar cruce" })).toHaveClass("min-h-11");
      expect(screen.getByRole("button", { name: "Quitar el cruce 1" })).toHaveClass("min-h-11");
      for (const select of within(screen.getByRole("heading", { name: "Cruce 1" }).closest("[data-reading-lookup]") as HTMLElement).getAllByRole("button", { name: /^(Dato leído|Completa|Se busca por) / })) expect(select).toHaveClass("h-11");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("is read without changing anything without «Administrar formularios»", async () => {
    renderWithProviders(<Harness definition={readingDefinition("es")} readOnly permissions={["formtemplates.read"]} />);
    await open();
    expect(screen.getByRole("checkbox", { name: "Leer los documentos que lleguen por WhatsApp" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /^Cómo reconocerlo/ })).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: /^Cruce 1 · Dato leído / })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Agregar cruce" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar el cruce 1" })).not.toBeInTheDocument();
    // Without «Ver catálogos» the field it compares cannot be named, and it says why; how it is reading is read with «Ver formularios».
    const by = screen.getByRole("button", { name: /^Cruce 1 · Se busca por / });
    expect(by).toHaveAccessibleName("Cruce 1 · Se busca por Campo no disponible");
    expect(by).toHaveAccessibleDescription("Necesitás permiso para leer catálogos y ver sus campos.");
    expect(await screen.findByText("Documentos confirmados")).toBeInTheDocument();
  });
});

// The Picker opens with the keyboard, like the other Radix lists in the tests; its button says the label and the chosen one.
async function openList(trigger: string | RegExp | HTMLElement) {
  const button = trigger instanceof HTMLElement ? trigger : screen.getByRole("button", { name: trigger });
  await act(async () => { button.focus(); });
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("listbox");
}
async function pick(trigger: string | RegExp | HTMLElement, option: string | RegExp) {
  await userEvent.click(within(await openList(trigger)).getByRole("option", { name: option }));
}
