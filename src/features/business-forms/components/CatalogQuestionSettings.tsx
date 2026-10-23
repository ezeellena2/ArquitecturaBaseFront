import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { CatalogQuestionSelector } from "./CatalogQuestionSelector";

// The question owns identity changes; this section owns catalog configuration and its controls.
export function CatalogQuestionSettings({ scope, source, readOnly, error, onCatalogChange }: {
  scope: CatalogReadScope;
  source: { readonly catalog: string | null };
  readOnly: boolean;
  error?: string;
  onCatalogChange: (catalogId: string) => void;
}) {
  return <CatalogQuestionSelector scope={scope} value={source.catalog ?? ""} readOnly={readOnly} error={error} onChange={onCatalogChange} />;
}
