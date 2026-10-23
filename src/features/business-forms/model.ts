// Closed draft model. Authored options and source.catalog are mutually exclusive.
export type FormCulture = "es" | "en";
export type LocalizedText = Readonly<Record<string, string>>;
export interface FormFileSettings { readonly minFiles: number; readonly maxFiles: number; readonly photoSource?: "cameraOrGallery" | "camera" | null }

export interface FormSelectionSettings { readonly minSelected: number; readonly maxSelected: number }
export interface DraftSelectionSettings { readonly minSelected: number | null; readonly maxSelected: number | null }

export interface FormCatalogPresentation { readonly title: readonly string[]; readonly description: readonly string[] }
export type FormCatalogMatch<TValue = string> = { readonly fieldId: string } & (
  | { readonly value: TValue; readonly personAttributeId?: never }
  | { readonly personAttributeId: TValue; readonly value?: never }
);
export interface FormQuestionSource {
  readonly catalog: string;
  readonly match?: readonly FormCatalogMatch[] | null;
  readonly presentation?: FormCatalogPresentation | null;
}
export interface DraftQuestionSource {
  readonly catalog: string | null;
  readonly match?: readonly FormCatalogMatch<string | null>[] | null;
  readonly presentation?: FormCatalogPresentation | null;
}

export type DraftFileSettings = Omit<FormFileSettings,"minFiles"|"maxFiles"> & { readonly minFiles:number|null; readonly maxFiles:number|null };

type QuestionContent<TOption, THelp, TMaxLength = number, TSource = FormQuestionSource, TFiles = FormFileSettings, TSelection = FormSelectionSettings> = {
  readonly label: LocalizedText;
  readonly help: THelp;
  readonly required: boolean;
} & (
  | { readonly type: "shortText" | "longText"; readonly maxLength: TMaxLength; readonly source?: null }
  | { readonly type: "photo" | "document"; readonly files: TFiles; readonly source?: null }
  | { readonly type: "decimal" | "date" | "boolean"; readonly source?: null }
  | { readonly type: "choice"; readonly options: readonly TOption[]; readonly source?: null }
  | { readonly type: "choice"; readonly source: TSource; readonly options?: null }
  | ({ readonly type: "multiChoice"; readonly selection: TSelection } & (
    | { readonly options: readonly TOption[]; readonly source?: null }
    | { readonly source: TSource; readonly options?: null }
  ))
);
export type DraftChoice = { readonly localId: string; readonly choiceId: string | null; readonly label: LocalizedText };
export type CanonicalChoice = { readonly choiceId: string; readonly label: LocalizedText };
export type DraftQuestion = QuestionContent<DraftChoice, Readonly<Record<string, string | null>> | null, number | null, DraftQuestionSource, DraftFileSettings, DraftSelectionSettings> & {
  readonly localId: string;
  readonly fieldId: string | null;
  readonly replacesFieldId: string | null;
};
export type CanonicalQuestion = QuestionContent<CanonicalChoice, LocalizedText | null> & {
  readonly fieldId: string;
  readonly key: string;
};
export interface FormDraft<TQuestion> {
  readonly format: 1;
  readonly culture: FormCulture;
  readonly submitLabel: LocalizedText;
  readonly fields: readonly TQuestion[];
}
export interface DraftEditorValue {
  readonly offerWhen: string | null;
  readonly name: LocalizedText;
  readonly prefix: string;
  readonly draft: FormDraft<DraftQuestion>;
}
export interface FormDefinitionSnapshot {
  readonly offerWhen: string | null;
  readonly id: string;
  readonly name: LocalizedText;
  readonly prefix: string;
  readonly prefixLocked: boolean;
  readonly revision: number;
  readonly draft: FormDraft<CanonicalQuestion>;
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
