import { useState, type SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import { Autocomplete, type AutocompleteOption } from "@/shared/ui/Autocomplete";

const all = "::all";
export interface ReceivedDocumentFacetOption { id: string; name: string }

/**
 * The combo of «Formulario» or «Mandó» in «Filtros» (DOC5-A, as PL2-A): closed it says «Todos» or the chosen one; open, the options the
 * page brings (the server counts each under the other filters), without counts nor anything under them, and typing searches among
 * them. Choosing one closes the list and applies it, with its name for the chip; «Todos» takes the filter away. The chosen one keeps its
 * name when another filter leaves it out of the options. When the server cut the list to the ones with the most documents, its top
 * says so.
 */
export function ReceivedDocumentFacetControl({ label, options, truncated, loading, selected, onChange }: {
  label: string;
  options: readonly ReceivedDocumentFacetOption[];
  truncated: boolean;
  loading: boolean;
  selected?: ReceivedDocumentFacetOption;
  onChange: (option: ReceivedDocumentFacetOption | undefined) => void;
}) {
  const { t, i18n } = useTranslation("formDocuments");
  const [search, setSearch] = useState<string | null>(null);
  const typed = (search ?? "").trim().toLocaleLowerCase(i18n.language);
  const matching = options.filter(option => option.name.toLocaleLowerCase(i18n.language).includes(typed));
  const items: AutocompleteOption[] = loading ? [] : [
    ...typed ? [] : [{ id: all, label: t("filterAll"), selected: !selected }],
    ...matching.map((option, index) => ({ id: option.id, label: option.name, selected: option.id === selected?.id, separated: !typed && index === 0 })),
  ];
  const status = loading ? t("common:states.loading") : items.length ? undefined : t("noOptions");
  // Touching the field selects what it says, so typing searches instead of adding to the chosen name.
  const selectAll = (event: SyntheticEvent<HTMLInputElement>) => event.currentTarget.select();
  return <Autocomplete aria-label={label} dropdown maxLength={100} value={search ?? selected?.name ?? ""} placeholder={t("filterAll")}
    options={items} status={status} header={truncated && !loading ? t("facetsTruncated") : undefined} onFocus={selectAll} onClick={selectAll}
    onValueChange={setSearch} onBlur={() => setSearch(null)}
    onSelect={id => {
      setSearch(null);
      const option = id === all ? undefined : options.find(item => item.id === id);
      if (option?.id !== selected?.id) onChange(option);
    }} />;
}
