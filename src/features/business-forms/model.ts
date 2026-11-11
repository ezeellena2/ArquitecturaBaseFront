// Closed draft model. Authored options and source.catalog are mutually exclusive.
export type FormCulture = "es" | "en";
export type LocalizedText = Readonly<Record<string, string>>;
export interface FormFileSettings { readonly minFiles: number; readonly maxFiles: number; readonly photoSource?: "cameraOrGallery" | "camera" | null }

export interface FormSelectionSettings { readonly minSelected: number; readonly maxSelected: number }
export interface DraftSelectionSettings { readonly minSelected: number | null; readonly maxSelected: number | null }
// The block of rows (RG1-A) is a question of its own; the questions of each row follow it, marked repeated (RG6-A).
export interface FormRowSettings { readonly minRows: number; readonly maxRows: number }
export interface DraftRowSettings { readonly minRows: number | null; readonly maxRows: number | null }

export interface FormCatalogPresentation { readonly title: readonly string[]; readonly description: readonly string[] }
// A filter compares a catalog field with a fixed value, a datum of the person or the answer of another question (CW7), which it
// names by its field identity or, while new, by its local one.
export type FormCatalogMatch<TValue = string> = { readonly fieldId: string } & (
  | { readonly value: TValue; readonly personAttributeId?: never; readonly questionId?: never }
  | { readonly personAttributeId: TValue; readonly value?: never; readonly questionId?: never }
  | { readonly questionId: TValue; readonly value?: never; readonly personAttributeId?: never }
);
// LD1-A: `groupBy` is the catalog field whose value is chosen first; the list then brings only the options with that value.
// IV1-A: `default` is the option a new answer starts with, which only a library standard declares; the editor keeps it as it came.
export interface FormQuestionSource {
  readonly catalog: string;
  readonly match?: readonly FormCatalogMatch[] | null;
  readonly presentation?: FormCatalogPresentation | null;
  readonly groupBy?: string | null;
  readonly default?: string | null;
}
export interface DraftQuestionSource {
  readonly catalog: string | null;
  readonly match?: readonly FormCatalogMatch<string | null>[] | null;
  readonly presentation?: FormCatalogPresentation | null;
  readonly groupBy?: string | null;
  readonly default?: string | null;
}
// CA1-A: a calculation is a read-only number the server computes with one fixed operation over questions that go before it,
// named like a filter by another answer: by their field identity once saved, by their local one while new. Only a decimal has it.
export type FormCalculationOperation = "multiply" | "sum" | "percent";
export interface FormCalculation { readonly operation: FormCalculationOperation; readonly operands: readonly string[] }
// While editing, multiply and percent keep their two places, empty (null) until a question is chosen.
export interface DraftCalculation { readonly operation: FormCalculationOperation; readonly operands: readonly (string | null)[] }
// CO1-A: the question shows only when an earlier question outside the block has one of these answers: an own option (by its
// identity, or its local one while new), a catalog option or "true"/"false".
export interface FormShowWhen { readonly questionId: string; readonly values: readonly string[] }
// While editing, «Según otra respuesta» exists before its question is chosen.
export interface DraftShowWhen { readonly questionId: string | null; readonly values: readonly string[] }
// BI1-A: the library standard a form was copied from, its version and which question holds each datum it needs (datum → fieldId).
export interface FormDefinitionStandard { readonly key: string; readonly version: number; readonly bound: Readonly<Record<string, string>> }
// IV2-A: a yes-or-no setting the standard declares on a bound question («El precio incluye IVA»), with its text and its (i) in
// both languages; only `value` changes, and the whole toggle goes back to the server as it came. `whenOn` and `whenOff` (IV1-A)
// are what the (i) of the question says in the entry with each value; the server adds it to the question's help.
export interface FormQuestionToggle {
  readonly key: string; readonly label: LocalizedText; readonly help: LocalizedText; readonly value: boolean;
  readonly whenOn?: LocalizedText; readonly whenOff?: LocalizedText;
}
// DOC1: the fixed validation of a question bound by a library standard: an account (CBU, CVU or alias) or a CUIT or CUIL. Only a
// short text has it.
export type FormQuestionValidation = "bankAccount" | "taxId";
// DOC1: the reading of documents, a setting of the form like «Dónde se completa»: whether it is on, «Cómo reconocerlo» (up to 1000
// characters, required while on) and up to five lookups in catalogs. Each fills a catalog question (`questionId`) with what another
// question read (`sourceQuestionId`), compared with the option's code ("code"), its text ("text") or a catalog field, by its id.
export interface FormDocumentLookup { readonly questionId: string; readonly sourceQuestionId: string; readonly field: string }
export interface FormDocumentReading { readonly enabled: boolean; readonly recognition: string; readonly lookups: readonly FormDocumentLookup[] }

export type DraftFileSettings = Omit<FormFileSettings,"minFiles"|"maxFiles"> & { readonly minFiles:number|null; readonly maxFiles:number|null };

type QuestionContent<TOption, THelp, TMaxLength = number, TSource = FormQuestionSource, TFiles = FormFileSettings, TSelection = FormSelectionSettings,
  TRows = FormRowSettings, TCalculation = FormCalculation, TShowWhen = FormShowWhen> = {
  readonly label: LocalizedText;
  readonly help: THelp;
  readonly required: boolean;
  readonly showWhen?: TShowWhen | null;
  readonly toggles?: readonly FormQuestionToggle[];
} & (
  | { readonly type: "shortText" | "longText"; readonly maxLength: TMaxLength; readonly source?: null; readonly repeated?: true; readonly validation?: FormQuestionValidation }
  | { readonly type: "photo" | "document"; readonly files: TFiles; readonly source?: null }
  | { readonly type: "decimal" | "date" | "boolean"; readonly source?: null; readonly repeated?: true; readonly calculation?: TCalculation | null }
  | { readonly type: "choice"; readonly options: readonly TOption[]; readonly source?: null; readonly repeated?: true }
  | { readonly type: "choice"; readonly source: TSource; readonly options?: null; readonly repeated?: true }
  | ({ readonly type: "multiChoice"; readonly selection: TSelection } & (
    | { readonly options: readonly TOption[]; readonly source?: null }
    | { readonly source: TSource; readonly options?: null }
  ))
  | { readonly type: "group"; readonly rows: TRows; readonly source?: null }
  // UB1-A: a point the device reports when the form is loaded; only required or optional, never in the block.
  | { readonly type: "location"; readonly source?: null }
);
export type DraftChoice = { readonly localId: string; readonly choiceId: string | null; readonly label: LocalizedText };
export type CanonicalChoice = { readonly choiceId: string; readonly label: LocalizedText };
export type DraftQuestion = QuestionContent<DraftChoice, Readonly<Record<string, string | null>> | null, number | null, DraftQuestionSource, DraftFileSettings, DraftSelectionSettings, DraftRowSettings,
  DraftCalculation, DraftShowWhen> & {
  readonly localId: string;
  readonly fieldId: string | null;
  readonly replacesFieldId: string | null;
};
export type CanonicalQuestion = QuestionContent<CanonicalChoice, LocalizedText | null> & {
  readonly fieldId: string;
  readonly key: string;
};
// A section title (CW15-B) is not a question: `start` is how many questions go before it. In the editor it also has a local
// identity of its own, which never travels.
export interface FormSection { readonly start: number; readonly title: LocalizedText }
export interface DraftSection extends FormSection { readonly localId: string }
export interface FormDraft<TQuestion, TSection = FormSection> {
  readonly format: 1;
  readonly culture: FormCulture;
  readonly submitLabel: LocalizedText;
  readonly fields: readonly TQuestion[];
  readonly sections?: readonly TSection[];
  // «Dónde se completa» (SA1-A): `true` is «Sólo en la app». «En la app y por WhatsApp», the default, has no key, so a draft that
  // never chose keeps its bytes. It travels with the draft to saving, checking and accepting.
  readonly appOnly?: true;
  // DOC1: the reading of documents; like `appOnly`, it is omitted without it and travels with the draft.
  readonly documentReading?: FormDocumentReading;
}
export interface DraftEditorValue {
  readonly offerWhen: string | null;
  readonly name: LocalizedText;
  readonly prefix: string;
  readonly draft: FormDraft<DraftQuestion, DraftSection>;
}
export interface FormDefinitionSnapshot {
  readonly offerWhen: string | null;
  readonly id: string;
  readonly name: LocalizedText;
  readonly prefix: string;
  readonly prefixLocked: boolean;
  readonly revision: number;
  readonly draft: FormDraft<CanonicalQuestion>;
  // BI1-A: only a form added from the library has it.
  readonly standard?: FormDefinitionStandard;
}
export interface FormIdentityMap {
  readonly fields: readonly {
    readonly localId: string; readonly fieldId: string; readonly key: string; readonly replacesFieldId: string | null;
  }[];
  readonly choices: readonly {
    readonly fieldLocalId: string; readonly localId: string; readonly fieldId: string; readonly choiceId: string;
  }[];
}
export interface FormDraftSaveResult {
  readonly requestId: string;
  readonly definition: FormDefinitionSnapshot;
  readonly identityMap: FormIdentityMap;
  readonly recovery: { readonly path: string; readonly resultExpiresAtUtc: string };
}
export interface DraftWriteBody extends DraftEditorValue {
  readonly requestId: string;
  readonly expectedRevision?: number;
}

export type FormPublicationValue = Omit<DraftEditorValue, "offerWhen">;
export interface FormPublicationWriteBody extends FormPublicationValue {
  readonly requestId: string;
  readonly expectedRevision: number;
  readonly checkToken: string;
}

export interface CatalogQuestionPreview {
  readonly source: DraftQuestionSource;
  readonly culture: FormCulture;
  readonly state: "Ready" | "RecipientDataMissing" | "FilterUnavailable";
  readonly options: readonly { readonly id: string; readonly title: string; readonly description: string | null }[];
}
