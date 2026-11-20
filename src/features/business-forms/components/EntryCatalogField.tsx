import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { IconButton } from "@/shared/ui/IconButton";
import { CloseIcon } from "@/shared/ui/icons";
import { Picker, type PickerOption } from "@/shared/ui/Picker";
import type { FormEntry, FormEntryGroup, FormEntryOption, FormEntryQuestion } from "../api/entries";
import { useEntryOptions, type useEntryGroups } from "../hooks/useFormEntry";

interface Props {
  entry: FormEntry;
  question: FormEntryQuestion;
  chosen: readonly FormEntryOption[];
  onChange: (chosen: FormEntryOption[]) => void;
  id: string;
  /** The name of the field when no label is in sight, as in a cell of the table of items («Ítem 2 · Artículo»). */
  label?: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  /** A list that depends on other answers (CW7): the option chosen in each, which the server filters by. */
  answers?: Readonly<Record<string, string>>;
  /** The label of the question it still waits for: the list stays off and says it in its field. */
  waitingFor?: string;
  /** The titles of the answers it depends on, which the count of the list names («4 opciones de El Ombú»). */
  answerTitle?: string;
  /** LD1-A: the value chosen first in the field the question chooses first by; the list brings only its options. */
  group?: FormEntryGroup;
}

/** The phone, where the controls of the load are 44 px (the list itself takes the screen there). */
const phoneQuery = "(width < 640px)";

function useOptionsSearch(entry: FormEntry, question: FormEntryQuestion, enabled: boolean, answers?: Readonly<Record<string, string>>, group?: FormEntryGroup) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(search.trim()), 300); return () => window.clearTimeout(timer); }, [search]);
  const options = useEntryOptions(entry, question.fieldId, debounced, enabled, answers, group);
  const items = options.data?.pages.flatMap(page => page.items) ?? [];
  return { search, setSearch, debounced, options, items, total: options.data?.pages[0]?.totalCount };
}

const groupKey = (group: FormEntryGroup) => group.id === null ? "none" : "value:" + group.id;

/**
 * LD1-A: the first list of a question that chooses first by a field, named by that field («Rubro»), with the only piece to choose (DS1-A).
 * It holds the values its options have after the filters, in their order and with the options without one last («Sin rubro»); with more
 * than ten, the list brings its search.
 */
export function EntryGroupField({ groups, value, onChange, id, label, invalid, describedBy, disabled, waitingFor }: {
  groups: ReturnType<typeof useEntryGroups>; value?: FormEntryGroup; onChange: (group: FormEntryGroup) => void; id: string; label: string;
  invalid?: boolean; describedBy?: string; disabled?: boolean; waitingFor?: string;
}) {
  const { t } = useTranslation("formEntries");
  const phone = useMediaQuery(phoneQuery);
  const items = groups.data ?? [];
  return <Picker id={id} label={label} aria-invalid={invalid || undefined} aria-describedby={describedBy} disabled={disabled} size={phone ? "touch" : "default"}
    placeholder={waitingFor ? t("catalog.dependsOn", { label: waitingFor }) : t("page.choose")}
    options={items.map(group => ({ id: groupKey(group), label: group.text }))} value={value ? groupKey(value) : null}
    loading={groups.isPending} failed={groups.isError} onRetry={() => void groups.refetch()}
    onChange={key => { const group = items.find(item => groupKey(item) === key); if (group) onChange(group); }}/>;
}

/**
 * A catalog question (CW3) with the only piece to choose (DS1-A), on the computer and on the phone, where its list takes the screen.
 * The list is searched in the server, fifty options at a time, with the fixed and person filters of whoever loads, and only while it
 * is open. Choosing several, the field says their names and «y N más» (DS2-A) and the list says up to how many; a single choice keeps
 * its × to take it away. A chosen option keeps the title it showed. A list that waits for another answer stays off and says which.
 */
export function EntryCatalogField({ entry, question, chosen, onChange, id, label, invalid, describedBy, disabled, answers, waitingFor, answerTitle, group }: Props) {
  const { t } = useTranslation("formEntries");
  const phone = useMediaQuery(phoneQuery);
  const multiple = question.type === "multiChoice";
  const [open, setOpen] = useState(false);
  const list = useOptionsSearch(entry, question, open && !disabled, answers, group);
  // The options seen in the list: one marked on the phone keeps its title after another search, until «Listo» applies it.
  const [seen, setSeen] = useState<{ data?: unknown; options: ReadonlyMap<string, FormEntryOption> }>({ options: new Map() });
  if (list.options.data !== seen.data) setSeen({ data: list.options.data, options: new Map([...seen.options, ...list.items.map(option => [option.id, option] as const)]) });
  const find = (optionId: string) => chosen.find(option => option.id === optionId) ?? seen.options.get(optionId);
  const toOption = (option: FormEntryOption): PickerOption => ({ id: option.id, label: option.title, description: option.description });
  // While what is typed waits its 300 ms, the list says it searches instead of showing the options of the search before.
  const typing = list.search.trim() !== list.debounced;
  const field = {
    id, label: label ?? question.label, "aria-invalid": invalid || undefined, "aria-describedby": describedBy, disabled, size: phone ? "touch" as const : "default" as const,
    placeholder: waitingFor ? t("catalog.dependsOn", { label: waitingFor }) : t("page.choose"),
    options: typing ? [] : list.items.map(toOption), selectedOptions: chosen.map(toOption), onOpenChange: setOpen,
    search: list.search, onSearchChange: list.setSearch, total: list.total,
    // The count names the answer the list depends on (CW7): «4 opciones de El Ombú».
    countText: answerTitle && list.total !== undefined ? t("catalog.countOf", { count: list.total, answer: answerTitle }) : undefined,
    loading: typing || list.options.isPending, failed: list.options.isError, onRetry: () => void list.options.refetch(),
    onLoadMore: list.options.hasNextPage ? () => void list.options.fetchNextPage() : undefined, loadingMore: list.options.isFetchingNextPage,
  };
  if (multiple) return <Picker {...field} multiple max={question.selection?.maxSelected ?? 1} value={chosen.map(option => option.id)}
    onChange={ids => onChange(ids.map(find).filter(option => option !== undefined))}/>;
  const single = chosen[0];
  return <div className="flex min-w-0 items-center gap-2">
    <Picker {...field} className="min-w-0 flex-1" value={single?.id ?? null} onChange={optionId => { const option = find(optionId); if (option) onChange([option]); }}/>
    {single && !disabled ? <IconButton label={t("catalog.clear", { label: single.title })} size={phone ? "touch" : "icon"} onClick={() => onChange([])}>
      <CloseIcon className="size-4"/>
    </IconButton> : null}
  </div>;
}
