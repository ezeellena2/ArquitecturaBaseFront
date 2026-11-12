import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { Button } from "@/shared/ui/button";
import { ChartRefreshing } from "@/shared/ui/charts/ChartRefreshing";
import { StatCard } from "@/shared/ui/charts/StatCard";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Surface } from "@/shared/ui/Surface";
import type { ResponseSheet } from "../../api/responses";
import {
  addableDashboardCards, automaticDashboardCards, dashboardAddDescription, dashboardAddLabel, dashboardCardAsShown, dashboardCardList,
  dashboardCardShown, dashboardCardsParam, dashboardCardTitle, dashboardCardToken, dashboardCardView, dashboardMeasureFromKey,
  dashboardMeasureKey, dashboardMeasureOptions, dashboardStats, withDashboardCard, withDashboardMeasure, withDashboardView, withoutDashboardCard,
  type DashboardCard as DashboardCardModel,
} from "../../dashboard";
import { dashboardPeriod } from "../../dashboardPeriod";
import { useFormDashboard } from "../../hooks/useFormDashboard";
import { useResponseScope } from "../../hooks/useResponseQueries";
import type { useResponseRouteQuery } from "../../hooks/useResponseRouteQuery";
import { responseHasFilters } from "../../responses";
import { DashboardAddMenu, type DashboardAddEntry } from "./DashboardAddMenu";
import { DashboardCard } from "./DashboardCard";
import { DashboardFilterBar } from "./DashboardFilterBar";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { dashboardCardGrid, dashboardFrame, dashboardStatGrid } from "./dashboardLayout";

// A card is known by its token and, if the same one repeats, by how many came before it: its key survives the other cards.
function cardKeys(list: readonly DashboardCardModel[]): string[] {
  const seen = new Map<string, number>();
  return list.map(card => {
    const token = dashboardCardToken(card);
    const occurrence = seen.get(token) ?? 0;
    seen.set(token, occurrence + 1);
    return token + "#" + occurrence;
  });
}

/**
 * The tab «Tablero» of a form (DOC7-A): the sheet's filters, shared in memory with «Respuestas», with one period for the
 * whole dashboard; the numbers against the previous period and a card per chart, armed from the types of the questions.
 * The period and the adjustments of the cards are each person's, in the address like the columns of the sheet, and «Volver al
 * automático» takes them away. What it writes from a reply takes that reply's period: while another one arrives, the dashboard
 * in sight keeps its words. On the phone the cards go one under the other and the filters behind «Filtros».
 */
export function FormDashboard({ formId, route, sheet }: { formId: string; route: ReturnType<typeof useResponseRouteQuery>; sheet: ResponseSheet | undefined }) {
  const { t, i18n } = useTranslation("forms");
  const { t: common } = useTranslation();
  const scope = useResponseScope();
  const update = useQueryUpdate();
  const period = dashboardPeriod(route.params.get("period"));
  const { query, cooldown } = useFormDashboard(formId, route.query, period, route.ready);
  const data = query.data;
  const cardScope = { actors: !scope.ownOnly, states: !!sheet?.hasApproval };
  const format = { t, language: i18n.language };
  const cardsParam = route.params.get("cards");
  const list = data ? dashboardCardList(data, cardsParam, cardScope) : [];
  const automatic = data ? automaticDashboardCards(data, cardScope) : [];
  const keys = cardKeys(list);
  const shown = list.flatMap((card, index) => data && dashboardCardShown(data, card, cardScope) ? [{ card, index, key: keys[index]! }] : []);

  // After a change from a menu the focus goes where the change left the person (the card that changed, the neighbor of the one
  // taken away, the card just added, «Agregar gráfico»), not to a ⋮ that is gone. It moves once the menu let it go, which does
  // not take it back, and once the address holds the change, so the card it looks for is the one on the screen.
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const add = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<{ key: string; cards: string | null } | null>(null);
  const holding = useRef(false);
  const [, setFocusTick] = useState(0);
  useEffect(() => {
    const next = focusNext.current;
    if (!next || holding.current || cardsParam !== next.cards) return;
    const target = next.key === "add" ? add.current : triggers.current.get(next.key);
    if (!target) return;
    focusNext.current = null;
    target.focus();
  });
  const holdFocus = (event: Event) => {
    if (!holding.current) return;
    holding.current = false;
    event.preventDefault();
    setFocusTick(tick => tick + 1);
  };
  const change = (next: readonly DashboardCardModel[] | null, focus: string) => {
    const cards = next === null ? undefined : dashboardCardsParam(next, automatic);
    focusNext.current = { key: focus, cards: cards ?? null };
    holding.current = true;
    update({ cards });
  };
  const remove = (position: number) => {
    const next = withoutDashboardCard(list, shown[position]!.index);
    const neighbor = shown[position + 1] ?? shown[position - 1];
    change(next, neighbor ? cardKeys(next)[neighbor.index > shown[position]!.index ? neighbor.index - 1 : neighbor.index]! : "add");
  };
  const replace = (index: number, next: readonly DashboardCardModel[]) => change(next, cardKeys(next)[index]!);
  // Something to chart: before the dashboard arrives, after a failure or without responses «Agregar gráfico» stays off.
  const entries: DashboardAddEntry[] | undefined = data && data.count > 0 ? addableDashboardCards(data, list, cardScope).map(card => ({
    key: dashboardCardToken(card), group: card.source.kind === "received" && card.measure.kind === "count" || card.source.kind === "actors" || card.source.kind === "states" ? "responses" : "questions",
    label: dashboardAddLabel(data, card, t), description: dashboardAddDescription(data, card, t),
    onSelect: () => { const next = withDashboardCard(list, card); change(next, cardKeys(next).at(-1)!); },
  })) : undefined;
  const bar = <DashboardFilterBar formId={formId} route={route} sheet={sheet} add={
    <DashboardAddMenu entries={entries} adjusted={cardsParam !== null} triggerRef={add} onCloseAutoFocus={holdFocus} onAutomatic={() => change(null, "add")} />} />;

  let body;
  // A form that is gone says so, as the sheet, without «Reintentar»; any other failure offers it.
  if (!data && query.isError && query.error instanceof ApiError && query.error.status === 404) body = <Surface><EmptyState embedded title={t("responses.unavailableForm")} /></Surface>;
  else if (!data && query.isError) body = <Surface><EmptyState embedded title={t("dashboard.loadFailed")} action={
    <DisabledReason reason={cooldown.isRunning ? t("wait", { count: cooldown.seconds }) : null}>
      <Button type="button" variant="outline" pending={query.isFetching} disabled={cooldown.isRunning} onClick={() => { void query.refetch(); }}>
        {query.isFetching ? t("retrying") : common("actions.retry")}
      </Button>
    </DisabledReason>} /></Surface>;
  else if (!data) body = <DashboardSkeleton />;
  // Nothing to show: an empty form says so, and a filter that matches nothing offers to take the filters away, as the sheet.
  else if (data.count === 0) body = <Surface><EmptyState embedded title={t(responseHasFilters(route.query) ? "responses.noMatches" : "responses.empty")} action={responseHasFilters(route.query)
    ? <Button type="button" variant="outline" onClick={() => route.setFilter({}, [])}>{t("responses.clear")}</Button> : undefined} /></Surface>;
  else body = <ChartRefreshing active={query.isPlaceholderData || query.isError && query.isFetching} className="@container flex flex-col gap-4">
    <section aria-label={t("dashboard.numbers")} className={dashboardStatGrid}>
      {dashboardStats(data, format).map(stat => <StatCard key={stat.key} label={stat.label} value={stat.value} detail={stat.detail} />)}
    </section>
    <section aria-label={t("dashboard.cards")} className={dashboardCardGrid}>
      {shown.map(({ card, index, key }, position) => {
        // A total whose number or currency these responses leave out counts them, and the address keeps the total.
        const title = dashboardCardTitle(data, card, t);
        return <div key={key} className={card.source.kind === "received" || card.source.kind === "date" ? "col-span-full" : undefined}>
          <DashboardCard title={title} view={dashboardCardView(data, card, format)} table={card.table}
            measures={dashboardMeasureOptions(data, card, t)} measure={dashboardMeasureKey(dashboardCardAsShown(data, card).measure)}
            onMeasure={value => { const measure = dashboardMeasureFromKey(value); if (measure) replace(index, withDashboardMeasure(list, index, measure)); }}
            onView={table => replace(index, withDashboardView(list, index, table))} onRemove={() => remove(position)}
            menuRef={element => { if (element) triggers.current.set(key, element); else triggers.current.delete(key); }} onMenuCloseAutoFocus={holdFocus} />
        </div>;
      })}
    </section>
  </ChartRefreshing>;

  return <div className={dashboardFrame}>{bar}{body}</div>;
}
