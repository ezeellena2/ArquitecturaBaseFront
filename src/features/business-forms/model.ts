// Closed manual draft model. The HTTP adapter removes only known, inapplicable null configuration.
export type FormCulture = "es" | "en";
export type LocalizedText = Readonly<Record<string, string>>;
type QuestionContent<TOption, THelp, TMaxLength = number> = {
  readonly label: LocalizedText;
  readonly help: THelp;
  readonly required: boolean;
} & (
  | { readonly type: "shortText" | "longText"; readonly maxLength: TMaxLength }
  | { readonly type: "decimal" | "date" | "boolean" }
  | { readonly type: "choice"; readonly options: readonly TOption[] }
);
export type DraftChoice = { readonly localId: string; readonly choiceId: string | null; readonly label: LocalizedText };
export type CanonicalChoice = { readonly choiceId: string; readonly label: LocalizedText };
export type DraftQuestion = QuestionContent<DraftChoice, Readonly<Record<string, string | null>> | null, number | null> & {
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
  readonly name: LocalizedText;
  readonly prefix: string;
  readonly draft: FormDraft<DraftQuestion>;
}
export interface FormDefinitionSnapshot {
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

export interface FormPublicationWriteBody extends DraftEditorValue {
  readonly requestId: string;
  readonly expectedRevision: number;
  readonly checkToken: string;
}
