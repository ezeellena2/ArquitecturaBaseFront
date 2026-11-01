import { useLayoutEffect, useRef, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDownIcon, ArrowUpIcon, CloseIcon } from "@/shared/ui/icons";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { ActionTooltip } from "@/shared/ui/ActionTooltip";
import { Spinner } from "@/shared/ui/Spinner";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
export interface ResponsePanelNavigation {
  previous: boolean; next: boolean; busy?: boolean; position?: number; count?: number; selectionId?: string; focusRequest?: number;
  onMove: (direction: number) => void; onClose: () => void;
  error?: unknown; onRetry?: () => unknown; retrying?: boolean; kind?: "sheet" | "pending";
}
export function ResponsePanelFrame({ title, status, subtitle, navigation, children, actions, loading }: {
  title: string; loading?: boolean; status?: ReactNode; subtitle?: ReactNode; navigation: ResponsePanelNavigation; children: ReactNode; actions?: ReactNode;
}) {
  const { t } = useTranslation("forms");
  const mobile = useMediaQuery("(width < 640px)");
  const panel = useRef<HTMLElement | null>(null);
  const previous = useRef<HTMLButtonElement | null>(null);
  const next = useRef<HTMLButtonElement | null>(null);
  const navigationFocus = useRef<"previous" | "next" | null>(null);
  // While it reads another response (an arrow, another row), the previous one stays in sight, dimmed and out of reach, with
  // the spinner next to the title (decision of 2026-10-31).
  const switching = !!navigation.busy;
  useLayoutEffect(() => { if (!panel.current?.contains(document.activeElement)) panel.current?.focus(); }, [navigation.selectionId, navigation.focusRequest, mobile]);
  // The dimmed body lets go of the focus it held: when the other response arrives, the focus comes back to the panel.
  useLayoutEffect(() => { if (!switching && document.activeElement === document.body) panel.current?.focus(); }, [switching]);
  useLayoutEffect(() => {
    if (loading) return;
    const active = document.activeElement;
    if ((!navigation.previous && navigationFocus.current === "previous" && (active === previous.current || active === document.body)) || (!navigation.next && navigationFocus.current === "next" && (active === next.current || active === document.body))) panel.current?.focus();
  }, [loading, navigation.previous, navigation.next]);
  const interaction = {
    ref: (node: HTMLElement | null) => { panel.current = node; },
    "aria-busy": loading,
    "aria-label": t("responses.detail"),
    tabIndex: -1,
    onFocusCapture: (event: FocusEvent<HTMLElement>) => { navigationFocus.current = event.target === previous.current ? "previous" : event.target === next.current ? "next" : null; },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.defaultPrevented || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input,textarea,select,[contenteditable="true"],[role="combobox"],[role="listbox"],[role="menu"]')) return;
      const dialog = target?.closest('[role="dialog"]');
      if (dialog && dialog !== panel.current) return;
      if (event.key === "Escape") { event.preventDefault(); navigation.onClose(); }
      if ((event.key === "ArrowUp" || event.key === "ArrowDown") && target?.closest('[role="tablist"]')) return;
      if (event.key === "ArrowUp" && navigation.previous && !navigation.busy) { event.preventDefault(); navigation.onMove(-1); }
      if (event.key === "ArrowDown" && navigation.next && !navigation.busy) { event.preventDefault(); navigation.onMove(1); }
    },
  };
  const heading = <h2 className="min-w-0 max-w-full truncate text-lg font-semibold max-sm:basis-full max-sm:whitespace-normal max-sm:break-words">{title}</h2>;
  // The panel actions go at the right edge of the header, in the title row before ↑ ↓ ×: if they do not fit next to the
  // title they go down a row and stay at the right edge, as in a Surface. ↑ ↓ × keep their place at the top right.
  const content = <>
    <header className="shrink-0 border-b border-[var(--color-border)] px-4 py-3">
      <div className="flex items-start gap-2">
        <div className="flex min-h-7.5 min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          {mobile ? <DialogTitle asChild>{heading}</DialogTitle> : heading}{switching ? <Spinner/> : null}{status}
          {mobile && navigation.position !== undefined && navigation.count !== undefined ? <span className="text-xs text-[var(--color-content-muted)]">{t(navigation.kind === "pending" ? "overview.pendingNavigation" : "responses.position", { position: navigation.position, count: navigation.count })}</span> : null}
          {actions ? <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">{actions}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* The keyboard shortcuts go in the tooltips, not at the foot (decision of 2026-10-31); the phone has no keyboard. */}
          <ActionTooltip label={t(mobile ? "responses.previous" : "detail.previousShortcut")}><span className="inline-flex"><Button ref={previous} type="button" variant="ghost" size="icon" aria-label={t("responses.previous")} aria-keyshortcuts={mobile ? undefined : "ArrowUp"} disabled={!navigation.previous || navigation.busy} onClick={() => navigation.onMove(-1)}><ArrowUpIcon className="size-4"/></Button></span></ActionTooltip>
          <ActionTooltip label={t(mobile ? "responses.next" : "detail.nextShortcut")}><span className="inline-flex"><Button ref={next} type="button" variant="ghost" size="icon" aria-label={t("responses.next")} aria-keyshortcuts={mobile ? undefined : "ArrowDown"} disabled={!navigation.next || navigation.busy} onClick={() => navigation.onMove(1)}><ArrowDownIcon className="size-4"/></Button></span></ActionTooltip>
          <ActionTooltip label={t(mobile ? "common:actions.close" : "detail.closeShortcut")}><Button type="button" variant="ghost" size="icon" aria-label={t("common:actions.close")} aria-keyshortcuts={mobile ? undefined : "Escape"} onClick={navigation.onClose}><CloseIcon className="size-4"/></Button></ActionTooltip>
        </div>
      </div>
      {subtitle ? <p className="mt-1 text-sm text-[var(--color-content-muted)]">{subtitle}</p> : null}
    </header>
    <div className={cn("min-h-0 flex-1 overflow-y-auto p-4", switching && "opacity-45")} inert={switching || undefined}>{navigation.error && navigation.onRetry ? <div className="mb-3 space-y-2"><p className="text-sm">{t("responses.loadFailed")}</p><Button variant="outline" pending={navigation.retrying} onClick={() => { navigation.onRetry?.(); }}>{t(navigation.retrying ? "responses.retrying" : "common:actions.retry")}</Button></div> : null}{children}</div>
    {!mobile && navigation.position !== undefined && navigation.count !== undefined ? <p className="shrink-0 border-t border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-content-muted)]">{t(navigation.kind === "pending" ? "overview.pendingNavigation" : "responses.position", { position: navigation.position, count: navigation.count })}</p> : null}
  </>;
  return mobile ? <Dialog open onOpenChange={open => { if (!open) navigation.onClose(); }}><DialogContent {...interaction} placement="right" showCloseButton={false} aria-modal="true" aria-labelledby={undefined} aria-describedby={undefined} className="top-12 bottom-0 h-[calc(100svh-3rem)] max-w-none gap-0 overflow-hidden p-0" onOpenAutoFocus={event => { event.preventDefault(); panel.current?.focus(); }} onCloseAutoFocus={event => event.preventDefault()} onEscapeKeyDown={event => { event.preventDefault(); navigation.onClose(); }}>{content}</DialogContent></Dialog> : <section {...interaction} className="absolute top-12 right-0 bottom-0 z-20 flex w-[min(32.5rem,100%)] flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl outline-none">{content}</section>;
}
