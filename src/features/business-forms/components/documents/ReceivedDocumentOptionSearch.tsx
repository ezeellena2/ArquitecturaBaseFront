import { useEffect, useState, type MouseEvent, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Autocomplete } from "@/shared/ui/Autocomplete";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { IconButton } from "@/shared/ui/IconButton";
import { CloseIcon } from "@/shared/ui/icons";
import { useReceivedDocumentOptions, useReceivedDocumentReadWait } from "../../hooks/useReceivedDocuments";

// The buttons inside the list leave the focus in the field, so the list stays open.
const keepFocus = { onPointerDown: (event: PointerEvent) => event.preventDefault(), onMouseDown: (event: MouseEvent) => event.preventDefault() };

/**
 * A catalog choice the server does not list for the document (more options than it sends for its sender): its options are searched in
 * the server, fifty at a time, while the list is open, as a catalog question of the app's load page; each one says its group under it
 * (LD1-A). The chosen one keeps the text it showed, and «Quitar» leaves it empty. Its field, name and problems come from its `FormField`.
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
  const [typing, setTyping] = useState(false);
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
  const status = !opened ? undefined : options.isError && !options.data
    ? <span className="flex flex-wrap items-center gap-2">{t("options.failed")}<DisabledReason reason={wait}>
      <Button type="button" variant="outline" size="sm" disabled={!!wait} {...keepFocus} onClick={() => void options.refetch()}>{t("common:actions.retry")}</Button>
    </DisabledReason></span>
    : options.isPending || searching ? t("options.loading") : items.length ? undefined : settled ? t("options.noMatches", { search: settled }) : t("options.empty");
  return <div className="flex min-w-0 items-center gap-2">
    <div className="min-w-0 flex-1">
      <Autocomplete {...field} dropdown disabled={disabled} maxLength={100} placeholder={value ? undefined : t("options.search", { label })}
        value={typing ? search : shown} options={searching || options.isPending ? [] : items.map(option => ({ id: option.id, label: option.text, description: option.group }))}
        status={status} header={options.data?.truncated && !searching && items.length ? t("options.truncated") : undefined}
        onFocus={() => setOpened(true)} onClick={() => setOpened(true)} onBlur={() => { setTyping(false); setSearch(""); }}
        onValueChange={next => { setOpened(true); setTyping(true); setSearch(next); }}
        onSelect={optionId => {
          const option = items.find(item => item.id === optionId);
          if (!option) return;
          setTyping(false); setSearch(""); setChosen({ id: option.id, text: option.text }); onChange(option.id);
        }} />
    </div>
    {value && !disabled ? <IconButton variant="ghost" label={t("options.clear", { label })} onClick={() => onChange("")}><CloseIcon className="size-4" /></IconButton> : null}
  </div>;
}
