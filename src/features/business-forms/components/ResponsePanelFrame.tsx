import { useLayoutEffect, useRef, type ReactNode } from "react";
import { ArrowDownIcon, ArrowUpIcon, CloseIcon } from "@/shared/ui/icons";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { ActionTooltip } from "@/shared/ui/ActionTooltip";
import { IconButton } from "@/shared/ui/IconButton";
export interface ResponsePanelNavigation {
  previous: boolean; next: boolean; busy?: boolean; position?: number; count?: number;
  onMove: (direction: number) => void; onClose: () => void;
  error?: unknown; onRetry?: () => unknown;
}
export function ResponsePanelFrame({ title, status, subtitle, navigation, children, actions, loading }: {
  title: string; loading?: boolean; status?: ReactNode; subtitle?: ReactNode; navigation: ResponsePanelNavigation; children: ReactNode; actions?: ReactNode;
}) {
  const { t } = useTranslation("forms");
  const panel = useRef<HTMLElement | null>(null);
  const previous = useRef<HTMLButtonElement | null>(null);
  const next = useRef<HTMLButtonElement | null>(null);
  const navigationFocus = useRef<"previous" | "next" | null>(null);
  useLayoutEffect(() => { panel.current?.focus(); }, []);
  useLayoutEffect(() => {
    if (loading) return;
    const active = document.activeElement;
    if ((!navigation.previous && navigationFocus.current === "previous" && (active === previous.current || active === document.body)) || (!navigation.next && navigationFocus.current === "next" && (active === next.current || active === document.body))) panel.current?.focus();
  }, [loading, navigation.previous, navigation.next]);
  return <section ref={panel} aria-busy={loading} aria-label={t("responses.detail")} tabIndex={-1} className="absolute inset-y-0 right-0 z-20 flex w-[min(520px,100%)] flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl outline-none max-sm:fixed max-sm:inset-0 max-sm:z-40 max-sm:w-full" onFocusCapture={event => { navigationFocus.current = event.target === previous.current ? "previous" : event.target === next.current ? "next" : null; }} onKeyDown={event => {
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('input,textarea,select,[contenteditable="true"],[role="combobox"],[role="listbox"],[role="menu"],[role="dialog"]')) return;
    if (event.key === "Escape") { event.preventDefault(); navigation.onClose(); }
    if ((event.key === "ArrowUp" || event.key === "ArrowDown") && target?.closest('[role="tablist"]')) return;
    if (event.key === "ArrowUp" && navigation.previous && !navigation.busy) { event.preventDefault(); navigation.onMove(-1); }
    if (event.key === "ArrowDown" && navigation.next && !navigation.busy) { event.preventDefault(); navigation.onMove(1); }
  }}>
    <header className="shrink-0 border-b border-[var(--color-border)] px-4 py-3">
      <div className="flex items-center gap-2"><h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h2>{status}<ActionTooltip label={t("responses.previous")}><span className="inline-flex"><Button ref={previous} variant="ghost" size="icon" aria-label={t("responses.previous")} disabled={!navigation.previous || navigation.busy} onClick={() => navigation.onMove(-1)}><ArrowUpIcon className="size-4"/></Button></span></ActionTooltip><ActionTooltip label={t("responses.next")}><span className="inline-flex"><Button ref={next} variant="ghost" size="icon" aria-label={t("responses.next")} disabled={!navigation.next || navigation.busy} onClick={() => navigation.onMove(1)}><ArrowDownIcon className="size-4"/></Button></span></ActionTooltip><IconButton variant="ghost" label={t("common:actions.close")} onClick={navigation.onClose}><CloseIcon className="size-4"/></IconButton></div>
      {subtitle ? <p className="mt-1 text-sm text-[var(--color-content-muted)]">{subtitle}</p> : null}
      {actions ? <div className="mt-2 flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">{navigation.error && navigation.onRetry ? <div className="mb-3"><Button variant="outline" onClick={() => { navigation.onRetry?.(); }}>{t("common:actions.retry")}</Button></div> : null}{children}</div>
    <p className="shrink-0 border-t border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-content-muted)] max-sm:hidden">{navigation.position !== undefined && navigation.count !== undefined ? <><span>{t("responses.position", { position: navigation.position, count: navigation.count })}</span><span aria-hidden="true"> · </span></> : null}<span>{t("detail.keyboardHint")}</span></p>
  </section>;
}
