import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconButton } from "@/shared/ui/IconButton";
import { CloseIcon } from "@/shared/ui/icons";
import { Picker } from "@/shared/ui/Picker";
import { useReceivedDocumentOptions, useReceivedDocumentReadWait } from "../../hooks/useReceivedDocuments";

/**
 * A catalog choice the server does not list for the document (more options than it sends for its sender), with the only piece to choose
 * (DS1-A): its options are searched in the server, inside the list and while it is open, as a catalog question of the app's load page;
 * each one says its group under it (LD1-A), and when the server sends only the first fifty the list says so. The wait, the failure and
 * «Reintentar» (off while a 429 waits) go inside the list. The chosen one keeps the text it showed, and «Quitar» leaves it empty. Its
 * field and problems come from its `FormField`, whose label names its button with the mark of the datum («Revisá»).
 */
export function ReceivedDocumentOptionSearch({ documentId, fieldId, label, value, text, disabled, onChange, onConflict, ...field }: {
  documentId: string;
  fieldId: string;
  label: string;
  /** The id of the option chosen, or empty. */
  value: string;
  /** What the option chosen reads, as it was read. */
  text: string | null;
  disabled: boolean;
  onChange: (value: string) => void;
  /** A 409 (the document can no longer be changed): its owner says why and reads the document again. */
  onConflict: (error: unknown) => void;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const { t } = useTranslation("formDocuments");
  const [opened, setOpened] = useState(false);
  const [search, setSearch] = useState("");
  const [settled, setSettled] = useState("");
  useEffect(() => { const timer = setTimeout(() => setSettled(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  // The text of the option chosen here; the one read keeps its own.
  const [chosen, setChosen] = useState<{ id: string; text: string } | null>(null);
  const shown = !value ? "" : chosen?.id === value ? chosen.text : text ?? "";
  const options = useReceivedDocumentOptions(documentId, fieldId, settled, opened && !disabled);
  const wait = useReceivedDocumentReadWait(options.error);
  useEffect(() => { if (options.error) onConflict(options.error); }, [options.error, onConflict]);
  const items = options.data?.items ?? [];
  const searching = search.trim() !== settled || options.isPlaceholderData && options.isFetching;
  const failed = options.isError && !options.data;
  return <div className="flex min-w-0 items-center gap-2">
    <Picker {...field} labelledBy={field.id ? field.id + "-label" : undefined} className="min-w-0 flex-1" label={label} disabled={disabled} placeholder={t("data.choose")} value={value || null}
      options={searching || options.isPending || failed ? [] : items.map(option => ({ id: option.id, label: option.text, description: option.group }))}
      selectedOptions={value ? [{ id: value, label: shown }] : undefined} onOpenChange={setOpened} search={search} onSearchChange={setSearch}
      countText={options.data?.truncated && !searching && items.length ? t("options.truncated") : undefined}
      loading={!failed && (options.isPending || searching)} failed={failed} onRetry={() => void options.refetch()} retryReason={wait}
      onChange={optionId => {
        const option = items.find(item => item.id === optionId);
        if (!option) return;
        setChosen({ id: option.id, text: option.text });
        onChange(option.id);
      }}/>
    {value && !disabled ? <IconButton variant="ghost" label={t("options.clear", { label })} onClick={() => onChange("")}><CloseIcon className="size-4" /></IconButton> : null}
  </div>;
}
