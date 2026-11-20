import { useTranslation } from "react-i18next";
import { Picker } from "@/shared/ui/Picker";

const all = "::all";
export interface ReceivedDocumentFacetOption { id: string; name: string }

/**
 * The filter of «Formulario» or «Mandó» in «Filtros» (DOC5-A, as PL2-A) with the only piece to choose (DS1-A): closed it says «Todos» or
 * the chosen one; open, «Todos» first and apart and the options the page brings (the server counts each under the other filters),
 * without counts nor anything under them, and with more than ten the search inside the list. Choosing one closes the list and applies
 * it, with its name for the chip; «Todos» takes the filter away. The chosen one keeps its name when another filter leaves it out of the
 * options. When the server cut the list to the ones with the most documents, the list says so where it would count them.
 */
export function ReceivedDocumentFacetControl({ label, options, truncated, loading, selected, onChange }: {
  label: string;
  options: readonly ReceivedDocumentFacetOption[];
  truncated: boolean;
  loading: boolean;
  selected?: ReceivedDocumentFacetOption;
  onChange: (option: ReceivedDocumentFacetOption | undefined) => void;
}) {
  const { t } = useTranslation("formDocuments");
  return <Picker label={label} first={{ id: all, label: t("filterAll") }} value={selected?.id ?? all}
    options={loading ? [] : options.map(option => ({ id: option.id, label: option.name }))}
    selectedOptions={selected ? [{ id: selected.id, label: selected.name }] : undefined}
    loading={loading} countText={truncated && !loading ? t("facetsTruncated") : undefined}
    onChange={id => { if (id !== (selected?.id ?? all)) onChange(id === all ? undefined : options.find(option => option.id === id)); }}/>;
}
