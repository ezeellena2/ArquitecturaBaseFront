import { useEffect, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { Autocomplete } from "@/shared/ui/Autocomplete";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { FilterChip } from "@/shared/ui/FilterChip";
import { IconButton } from "@/shared/ui/IconButton";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { CloseIcon } from "@/shared/ui/icons";
import type { FormEntry, FormEntryOption, FormEntryQuestion } from "../api/entries";
import { useEntryOptions } from "../hooks/useFormEntry";

interface Props {
  entry: FormEntry;
  question: FormEntryQuestion;
  chosen: readonly FormEntryOption[];
  onChange: (chosen: FormEntryOption[]) => void;
  id: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}

/**
 * A catalog question (CW3): the list is searched in the server, fifty options at a time, with the fixed and person
 * filters of whoever loads. The page is only asked for when the list opens; a chosen option keeps the title it showed.
 */
export function EntryCatalogField(props: Props) {
  const mobile = useMediaQuery("(width < 640px)");
  return mobile ? <MobileCatalogField {...props}/> : <DesktopCatalogField {...props}/>;
}

function useOptionsSearch(entry: FormEntry, question: FormEntryQuestion, enabled: boolean) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(search.trim()), 300); return () => window.clearTimeout(timer); }, [search]);
  const options = useEntryOptions(entry, question.fieldId, debounced, enabled);
  const items = options.data?.pages.flatMap(page => page.items) ?? [];
  return { search, setSearch, debounced, options, items, total: options.data?.pages[0]?.totalCount };
}

// Inside the desktop list a button keeps the focus in the field: otherwise the field's blur closes the list before the click.
const keepFocus = { onPointerDown: (event: PointerEvent) => event.preventDefault(), onMouseDown: (event: MouseEvent) => event.preventDefault() };

function ListState({ loading, failed, empty, search, onRetry }: { loading: boolean; failed: boolean; empty: boolean; search: string; onRetry: () => void }): ReactNode {
  const { t } = useTranslation("formEntries");
  if (loading) return <span role="status" aria-label={t("catalog.loading")} className="flex flex-col gap-2 py-1"><Skeleton className="h-4 w-3/4"/><Skeleton className="h-4 w-1/2"/><Skeleton className="h-4 w-2/3"/></span>;
  if (failed) return <span className="flex flex-wrap items-center gap-2">{t("catalog.failed")}<Button type="button" variant="outline" size="sm" {...keepFocus} onClick={onRetry}>{t("common:actions.retry")}</Button></span>;
  if (empty) return search ? t("catalog.noMatches", { search }) : t("catalog.empty");
  return null;
}

function DesktopCatalogField({ entry, question, chosen, onChange, id, invalid, describedBy, disabled }: Props) {
  const { t } = useTranslation("formEntries");
  const multiple = question.type === "multiChoice";
  const max = question.selection?.maxSelected ?? 1;
  const [opened, setOpened] = useState(false);
  const [typing, setTyping] = useState(false);
  const list = useOptionsSearch(entry, question, opened && !disabled);
  const single = multiple ? undefined : chosen[0];
  const full = multiple && chosen.length >= max;
  const state = <ListState loading={list.options.isPending && opened} failed={list.options.isError} empty={list.options.isSuccess && list.items.length === 0}
    search={list.debounced} onRetry={() => void list.options.refetch()}/>;
  const field = <div className="flex min-w-0 items-center gap-2">
    <div className="min-w-0 flex-1">
      <Autocomplete id={id} aria-label={question.label} aria-invalid={invalid || undefined} aria-describedby={describedBy} disabled={disabled}
        placeholder={multiple || !single ? t("catalog.search", { label: question.label }) : undefined}
        value={typing || multiple ? list.search : single?.title ?? ""} multiple={multiple}
        onFocus={() => setOpened(true)} onClick={() => setOpened(true)}
        onBlur={() => { setTyping(false); list.setSearch(""); }}
        onValueChange={value => { setOpened(true); setTyping(true); list.setSearch(value); }}
        header={list.total !== undefined && list.items.length > 0 ? t("catalog.count", { count: list.total }) : undefined}
        status={list.items.length === 0 && opened ? state ?? undefined : undefined}
        footer={list.options.hasNextPage ? <Button type="button" variant="link" size="inline" disabled={list.options.isFetchingNextPage} {...keepFocus} onClick={() => void list.options.fetchNextPage()}>{t("catalog.more")}</Button> : undefined}
        options={list.items.map(option => ({ id: option.id, label: option.title, description: option.description,
          selected: multiple ? chosen.some(item => item.id === option.id) : undefined,
          disabled: full && !chosen.some(item => item.id === option.id) }))}
        onSelect={optionId => {
          const option = list.items.find(item => item.id === optionId);
          if (!option) return;
          if (!multiple) { setTyping(false); list.setSearch(""); onChange([option]); return; }
          onChange(chosen.some(item => item.id === optionId) ? chosen.filter(item => item.id !== optionId) : [...chosen, option]);
        }}/>
    </div>
    {single && !disabled ? <IconButton variant="ghost" label={t("catalog.clear", { label: single.title })} onClick={() => onChange([])}><CloseIcon className="size-4"/></IconButton> : null}
  </div>;
  if (!multiple) return field;
  return <div className="flex flex-col gap-2">
    {chosen.length ? <div className="flex flex-wrap gap-2">{chosen.map(option => <FilterChip key={option.id} removeLabel={t("catalog.clear", { label: option.title })}
      onRemove={() => onChange(chosen.filter(item => item.id !== option.id))}>{option.title}</FilterChip>)}</div> : null}
    {field}
    <p className="text-xs text-[var(--color-content-muted)]">{full ? t("catalog.chosenOf", { count: chosen.length, max }) : t("catalog.chooseUpTo", { count: max })}</p>
  </div>;
}

/** In the phone the list opens full screen, with the search on top, rows of 56 and, choosing several, «Listo» at the foot. */
function MobileCatalogField({ entry, question, chosen, onChange, id, invalid, describedBy, disabled }: Props) {
  const { t } = useTranslation("formEntries");
  const multiple = question.type === "multiChoice";
  const max = question.selection?.maxSelected ?? 1;
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<FormEntryOption[]>([]);
  const list = useOptionsSearch(entry, question, open);
  const full = multiple && picked.length >= max;
  const close = () => { setOpen(false); list.setSearch(""); };
  const state = <ListState loading={list.options.isPending} failed={list.options.isError} empty={list.options.isSuccess && list.items.length === 0}
    search={list.debounced} onRetry={() => void list.options.refetch()}/>;
  return <>
    <div className="flex min-w-0 flex-col gap-2">
      {multiple && chosen.length ? <div className="flex flex-wrap gap-2">{chosen.map(option => <FilterChip key={option.id} removeLabel={t("catalog.clear", { label: option.title })}
        onRemove={() => onChange(chosen.filter(item => item.id !== option.id))}>{option.title}</FilterChip>)}</div> : null}
      <div className="flex min-w-0 items-center gap-2">
        <Button type="button" variant="outline" size="touch" id={id} aria-haspopup="dialog" aria-invalid={invalid || undefined} aria-describedby={describedBy} disabled={disabled}
          className="min-w-0 flex-1 justify-start" onClick={() => { setPicked([...chosen]); setOpen(true); }}>
          <span className={"truncate font-normal " + (!multiple && chosen[0] ? "" : "text-[var(--color-content-muted)]")}>{!multiple && chosen[0] ? chosen[0].title : t("catalog.search", { label: question.label })}</span>
        </Button>
        {!multiple && chosen[0] && !disabled ? <Button type="button" variant="ghost" size="touch" aria-label={t("catalog.clear", { label: chosen[0].title })} onClick={() => onChange([])}><CloseIcon className="size-4"/></Button> : null}
      </div>
      {multiple ? <p className="text-xs text-[var(--color-content-muted)]">{t("catalog.chooseUpTo", { count: max })}</p> : null}
    </div>
    <Dialog open={open} onOpenChange={next => { if (!next) close(); }}>
      <DialogContent placement="right" showCloseButton={false} aria-describedby={undefined} className="inset-0 flex h-svh w-screen max-w-none flex-col gap-0 overflow-hidden p-0">
        <header className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2">
          <DialogTitle className="min-w-0 flex-1 truncate">{question.label}</DialogTitle>
          <IconButton variant="ghost" label={t("catalog.close")} onClick={close}><CloseIcon className="size-5"/></IconButton>
        </header>
        <div className="border-b border-[var(--color-border)] p-3">
          <Input autoFocus aria-label={t("catalog.search", { label: question.label })} placeholder={t("catalog.search", { label: question.label })}
            value={list.search} onChange={event => list.setSearch(event.target.value)}/>
          {list.total !== undefined && list.items.length > 0 ? <p className="mt-2 text-xs text-[var(--color-content-muted)]">{t("catalog.count", { count: list.total })}</p> : null}
          {multiple ? <p className="mt-1 text-xs text-[var(--color-content-muted)]">{full ? t("catalog.chosenOf", { count: picked.length, max }) : t("catalog.chooseUpTo", { count: max })}</p> : null}
        </div>
        <ul role="listbox" aria-label={question.label} aria-multiselectable={multiple || undefined} className="min-h-0 flex-1 overflow-y-auto">
          {list.items.map(option => {
            const selected = (multiple ? picked : chosen).some(item => item.id === option.id);
            const blocked = full && !selected;
            return <li key={option.id} role="presentation" className="border-b border-[var(--color-border)]">
              <Button type="button" variant="ghost" size="touch" role="option" aria-selected={selected} aria-disabled={blocked || undefined}
                className="w-full justify-start gap-3 whitespace-normal aria-disabled:opacity-50"
                onClick={() => {
                  if (!multiple) { onChange([option]); close(); return; }
                  if (blocked) return;
                  setPicked(current => selected ? current.filter(item => item.id !== option.id) : [...current, option]);
                }}>
                {multiple ? <span aria-hidden="true" className={"inline-flex size-6 shrink-0 items-center justify-center rounded border border-input " + (selected ? "border-[var(--color-brand-700)] bg-[var(--color-brand-700)] text-white" : "")}>{selected ? "✓" : null}</span> : null}
                <span className="flex min-h-10 min-w-0 flex-col justify-center text-left"><span className="block font-normal">{option.title}</span>{option.description ? <span className="block text-sm font-normal text-[var(--color-content-muted)]">{option.description}</span> : null}</span>
              </Button>
            </li>;
          })}
          {list.items.length === 0 ? <li role="presentation" className="p-4 text-sm text-[var(--color-content-muted)]">{state}</li> : null}
          {list.options.hasNextPage ? <li role="presentation" className="p-3 text-center"><Button type="button" variant="outline" size="touch" disabled={list.options.isFetchingNextPage} onClick={() => void list.options.fetchNextPage()}>{t("catalog.more")}</Button></li> : null}
        </ul>
        {multiple ? <footer className="border-t border-[var(--color-border)] p-3"><Button type="button" size="touch" className="w-full" onClick={() => { onChange(picked); close(); }}>{t("catalog.done", { count: picked.length })}</Button></footer> : null}
      </DialogContent>
    </Dialog>
  </>;
}
