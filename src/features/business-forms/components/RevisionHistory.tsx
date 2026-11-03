import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Pagination } from "@/shared/ui/Pagination";
import { Spinner } from "@/shared/ui/Spinner";
import { ChevronLeftIcon, ClockIcon } from "@/shared/ui/icons";

/** A saved revision of rules or suggestions, as their histories list it. */
export interface RevisionEntry {
  id: string;
  revision: number;
  createdAtUtc: string;
  author: { displayName?: string | null } | null;
}
interface RevisionPage<T> { items: readonly T[]; page: number; pageSize: number; totalCount: number; totalPages: number; hasPrevious: boolean; hasNext: boolean }

/**
 * «Historial», first among the actions of its section (board HI1-A): it opens the revisions in a side panel instead of a
 * column that was there even when empty. Without revisions it stays off, with that as its reason.
 */
export function RevisionHistoryButton({ count, blocked, waitReason, onOpen }: {
  /** How many revisions there are; unknown while the history is read. */
  count: number | undefined;
  blocked: boolean;
  waitReason: string | null;
  onOpen: (trigger: HTMLButtonElement) => void;
}) {
  const { t } = useTranslation("forms");
  const empty = count === 0;
  return <DisabledReason reason={empty ? t("rules.historyEmpty") : waitReason}>
    <Button type="button" variant="outline" disabled={blocked || empty} onClick={event => onOpen(event.currentTarget)}><ClockIcon aria-hidden="true" className="size-4"/>{t("rules.historyOpen")}</Button>
  </DisabledReason>;
}

/**
 * The revisions of a section, newest first, in a side panel: the one in force marked, when, who and what changed. Opening
 * one shows it in the same panel, read only, with a way back to the list; closing returns the focus to «Historial».
 */
export function RevisionHistoryPanel<T extends RevisionEntry>({ title, open, onClose, history, onPageChange, current, describe, opening, blocked, onOpenRevision, view, onBack, culture, timeZoneId, trigger }: {
  title: string;
  open: boolean;
  onClose: () => void;
  history: { data?: RevisionPage<T>; isPending: boolean; refetch: () => unknown };
  onPageChange: (page: number) => void;
  /** The revision in force. */
  current: number;
  /** What changed in a revision, in words. */
  describe: (entry: T) => string;
  /** The revision being opened: its link shows the ring. */
  opening?: number;
  blocked: boolean;
  onOpenRevision: (revision: number) => void;
  /** The opened revision, with its content as the section reads it. */
  view: { revision: number; content: ReactNode } | null;
  onBack: () => void;
  culture: string;
  timeZoneId?: string;
  trigger: RefObject<HTMLButtonElement | null>;
}) {
  const { t } = useTranslation("forms");
  const body = useRef<HTMLDivElement | null>(null);
  const shown = useRef<number | null>(null);
  // Into a revision the focus goes to «Volver a las revisiones»; back in the list, to the link of the revision it left.
  useLayoutEffect(() => {
    if (view) { shown.current = view.revision; body.current?.querySelector<HTMLElement>("[data-revision-back]")?.focus(); return; }
    if (shown.current !== null) body.current?.querySelector<HTMLElement>('[data-revision="' + shown.current + '"]')?.focus();
    shown.current = null;
  }, [view]);
  const entry = view ? history.data?.items.find(item => item.revision === view.revision) : undefined;
  const meta = (item: T) => formatDateTimeInZone(item.createdAtUtc, culture, timeZoneId) + " · " + (item.author?.displayName ?? t("responses.unknownPerson"));
  return <Dialog open={open} onOpenChange={next => { if (!next) onClose(); }}>
    <DialogContent placement="right" aria-describedby={undefined} className="overflow-hidden" onCloseAutoFocus={event => { const target = trigger.current; if (target?.isConnected && !target.disabled) { event.preventDefault(); target.focus(); } }}>
      <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      <div ref={body} className="min-h-0 flex-1 overflow-y-auto">
        {view ? <div className="space-y-3">
          <Button type="button" variant="link" data-revision-back onClick={onBack}><ChevronLeftIcon aria-hidden="true" className="size-4"/>{t("rules.historyBack")}</Button>
          <div className="space-y-0.5"><h3 className="text-sm font-semibold">{t("rules.revision", { revision: view.revision })}</h3>{entry ? <p className="text-xs text-[var(--color-content-muted)]">{meta(entry)} · {describe(entry)}</p> : null}</div>
          {view.content}
        </div> : history.isPending ? <Spinner/> : !history.data ? <EmptyState embedded title={t("common:states.loadFailed")} action={<Button type="button" variant="outline" onClick={() => void history.refetch()}>{t("common:actions.retry")}</Button>}/> : <>
          <ol className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">{history.data.items.map(item => <li key={item.id} className="space-y-0.5 py-3">
            <p className="flex flex-wrap items-center gap-2"><Button type="button" variant="link" data-revision={item.revision} disabled={blocked} pending={opening === item.revision} onClick={() => onOpenRevision(item.revision)}>{t("rules.revision", { revision: item.revision })}</Button>{item.revision === current ? <Badge variant="outline">{t("rules.current")}</Badge> : null}</p>
            <p className="text-xs">{meta(item)}</p>
            <p className="text-xs text-[var(--color-content-muted)]">{describe(item)}</p>
          </li>)}</ol>
          {history.data.totalPages > 1 ? <Pagination {...history.data} onPageChange={onPageChange}/> : null}
        </>}
      </div>
    </DialogContent>
  </Dialog>;
}
