import type { TFunction } from "i18next";
import { calendarDateInZone, formatDateOnly } from "@/shared/lib/dateTime";
import { numberFormat } from "@/shared/lib/numberFormat";
import { formatTypedValue } from "@/shared/lib/typedValue";
import type { BarChartBucket } from "@/shared/ui/charts/BarChart";
import type { BarListItem, ChartTone } from "@/shared/ui/charts/BarList";
import type { FormDashboard, FormDashboardNumber, FormDashboardState, FormDashboardTotal } from "./api/dashboard";
import type { DashboardPeriod } from "./dashboardPeriod";

// DOC7-A: what the dashboard of a form shows, from the types of its questions, and what each person adjusts in the address,
// like the columns of the sheet: one period for the whole dashboard and the list of cards, each with what it counts and its view.
// What is written from a reply (titles, the days of each bucket, the headers of a table) takes the period of that reply, not the
// one the address asks next: while another period arrives, the dashboard in sight keeps its own words.
type Translate = TFunction<"forms">;
export interface DashboardFormat { readonly t: Translate; readonly language: string }

export type DashboardMeasure = { readonly kind: "count" } | { readonly kind: "total"; readonly fieldId: string; readonly currencyId: string | null };
export type DashboardSource =
  | { readonly kind: "received" }
  | { readonly kind: "date"; readonly fieldId: string }
  | { readonly kind: "choice"; readonly fieldId: string }
  | { readonly kind: "actors" }
  | { readonly kind: "states" };
export interface DashboardCard { readonly source: DashboardSource; readonly measure: DashboardMeasure; readonly table: boolean }
/** Whether a person sees who loaded (not whoever only loads: it would always be them) and the states (a form with approval). */
export interface DashboardScope { readonly actors: boolean; readonly states: boolean }

const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const count = { kind: "count" } as const;

// ── The address ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A card in the address: `received`, `date.<id>`, `choice.<id>`, `actors` or `states`, then `total.<number>[.<currency>]` and `table`. */
export function dashboardCardToken(card: DashboardCard): string {
  const source = card.source.kind === "date" || card.source.kind === "choice" ? [card.source.kind, card.source.fieldId] : [card.source.kind];
  const measure = card.measure.kind === "total" ? ["total", card.measure.fieldId, ...card.measure.currencyId ? [card.measure.currencyId] : []] : [];
  return [...source, ...measure, ...card.table ? ["table"] : []].join(".");
}

function parseCard(token: string): DashboardCard | null {
  const parts = token.split(".");
  const kind = parts.shift();
  let source: DashboardSource;
  if (kind === "received" || kind === "actors" || kind === "states") source = { kind };
  else if (kind === "date" || kind === "choice") {
    const fieldId = parts.shift();
    if (!fieldId || !guid.test(fieldId)) return null;
    source = { kind, fieldId };
  } else return null;
  const table = parts.at(-1) === "table";
  if (table) parts.pop();
  if (parts.length === 0) return { source, measure: count, table };
  const [word, fieldId, currencyId, ...rest] = parts;
  if (word !== "total" || !fieldId || !guid.test(fieldId) || currencyId !== undefined && !guid.test(currencyId) || rest.length > 0
    || source.kind === "actors" || source.kind === "states") return null;
  return { source, measure: { kind: "total", fieldId, currencyId: currencyId ?? null }, table };
}

/** The cards of the address, in order; null without the parameter: the automatic dashboard. What it does not understand is left out. */
export function parseDashboardCards(value: string | null): readonly DashboardCard[] | null {
  if (value === null) return null;
  if (value === "none") return [];
  return value.split(",").flatMap(token => { const card = parseCard(token); return card ? [card] : []; });
}

export function serializeDashboardCards(cards: readonly DashboardCard[]): string {
  return cards.length ? cards.map(dashboardCardToken).join(",") : "none";
}

/** The parameter for a list of cards: none when it is the automatic dashboard again. */
export function dashboardCardsParam(cards: readonly DashboardCard[], automatic: readonly DashboardCard[]): string | undefined {
  const value = serializeDashboardCards(cards);
  return value === serializeDashboardCards(automatic) ? undefined : value;
}

// ── The cards ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

const numberKey = (number: { fieldId: string; currencyId: string | null }) => number.fieldId + (number.currencyId ? "." + number.currencyId : "");
const findNumber = (dashboard: FormDashboard, measure: { fieldId: string; currencyId: string | null }) =>
  dashboard.numbers.find(number => number.fieldId === measure.fieldId && number.currencyId === measure.currencyId);

/** How many arrived by period, each number by currency by period, each choice, each date, who loaded and the states. */
export function automaticDashboardCards(dashboard: FormDashboard, scope: DashboardScope): readonly DashboardCard[] {
  return [
    { source: { kind: "received" }, measure: count, table: false },
    ...dashboard.numbers.map(number => ({ source: { kind: "received" }, measure: { kind: "total", fieldId: number.fieldId, currencyId: number.currencyId }, table: false }) as const),
    ...dashboard.distributions.map(item => ({ source: { kind: "choice", fieldId: item.fieldId }, measure: count, table: false }) as const),
    ...dashboard.dateSeries.map(item => ({ source: { kind: "date", fieldId: item.fieldId }, measure: count, table: false }) as const),
    ...scope.actors ? [{ source: { kind: "actors" }, measure: count, table: false } as const] : [],
    ...scope.states ? [{ source: { kind: "states" }, measure: count, table: false } as const] : [],
  ];
}

/** The list of the address, or the automatic one without it. */
export function dashboardCardList(dashboard: FormDashboard, param: string | null, scope: DashboardScope): readonly DashboardCard[] {
  return parseDashboardCards(param) ?? automaticDashboardCards(dashboard, scope);
}

/** Whether the question of a card came: one that the filters leave out shows again when they let it in. */
export function dashboardCardShown(dashboard: FormDashboard, card: DashboardCard, scope: DashboardScope): boolean {
  switch (card.source.kind) {
    case "received": return true;
    case "date": { const { fieldId } = card.source; return dashboard.dateSeries.some(item => item.fieldId === fieldId); }
    case "choice": { const { fieldId } = card.source; return dashboard.distributions.some(item => item.fieldId === fieldId); }
    case "actors": return scope.actors;
    case "states": return scope.states;
  }
}

/**
 * A card as the reply lets it show: a total whose number or currency the filters leave out counts the responses instead, and
 * the address keeps the total, so it adds it up again when the filters let that number or currency in.
 */
export function dashboardCardAsShown(dashboard: FormDashboard, card: DashboardCard): DashboardCard {
  return card.measure.kind === "total" && !findNumber(dashboard, card.measure) ? { ...card, measure: count } : card;
}

// What a card stands for: a question, a number by currency, how many arrived, who loaded or the states.
function subject(card: DashboardCard): string {
  if (card.source.kind === "received") return card.measure.kind === "total" ? "number:" + numberKey(card.measure) : "received";
  return card.source.kind === "date" || card.source.kind === "choice" ? card.source.kind + ":" + card.source.fieldId : card.source.kind;
}

/** What «Agregar gráfico» offers: the automatic cards that nothing on the dashboard stands for, as it shows. */
export function addableDashboardCards(dashboard: FormDashboard, list: readonly DashboardCard[], scope: DashboardScope): readonly DashboardCard[] {
  const present = new Set(list.map(card => subject(dashboardCardAsShown(dashboard, card))));
  return automaticDashboardCards(dashboard, scope).filter(card => !present.has(subject(card)));
}

export const withDashboardCard = (list: readonly DashboardCard[], card: DashboardCard): readonly DashboardCard[] => [...list, card];
export const withoutDashboardCard = (list: readonly DashboardCard[], index: number): readonly DashboardCard[] => list.filter((_, at) => at !== index);
export const withDashboardMeasure = (list: readonly DashboardCard[], index: number, measure: DashboardMeasure): readonly DashboardCard[] =>
  list.map((card, at) => at === index ? { ...card, measure } : card);
export const withDashboardView = (list: readonly DashboardCard[], index: number, table: boolean): readonly DashboardCard[] =>
  list.map((card, at) => at === index ? { ...card, table } : card);

// ── Names ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A number with the name of its currency, without a symbol: an option of one's own has no code («Monto (pesos)»). */
export function dashboardNumberLabel(dashboard: FormDashboard, measure: { fieldId: string; currencyId: string | null }, t: Translate): string {
  const number = findNumber(dashboard, measure);
  const label = number?.label ?? "";
  if (measure.currencyId) return t("dashboard.numberCurrency", { number: label, currency: number?.currencyLabel?.trim() || t("responses.unavailableValue") });
  // Without a currency next to the same number with one, the answers that left it empty: never confused with all of them.
  return dashboard.numbers.some(item => item.fieldId === measure.fieldId && item.currencyId) ? t("dashboard.numberWithoutCurrency", { number: label }) : label;
}

function questionLabel(dashboard: FormDashboard, source: DashboardSource, t: Translate): string {
  if (source.kind === "date") return dashboard.dateSeries.find(item => item.fieldId === source.fieldId)?.label ?? "";
  if (source.kind !== "choice") return "";
  const distribution = dashboard.distributions.find(item => item.fieldId === source.fieldId);
  return distribution?.catalog?.name ? t("dashboard.catalogQuestion", { question: distribution.label, catalog: distribution.catalog.name }) : distribution?.label ?? "";
}

/** What a card shows, as the reply lets it show, with the period of that reply. */
export function dashboardCardTitle(dashboard: FormDashboard, shown: DashboardCard, t: Translate): string {
  const { period } = dashboard;
  const card = dashboardCardAsShown(dashboard, shown);
  const total = card.measure.kind === "total" ? dashboardNumberLabel(dashboard, card.measure, t) : null;
  const question = questionLabel(dashboard, card.source, t);
  switch (card.source.kind) {
    case "received": return total === null ? t(`dashboard.titles.received.${period}`) : t(`dashboard.titles.receivedTotal.${period}`, { number: total });
    case "date": return total === null ? t(`dashboard.titles.date.${period}`, { question }) : t(`dashboard.titles.dateTotal.${period}`, { number: total, question });
    case "choice": return total === null ? t("dashboard.titles.choice", { question }) : t("dashboard.titles.choiceTotal", { number: total, question });
    case "actors": return t("dashboard.titles.actors");
    case "states": return t("dashboard.titles.states");
  }
}

/** How a card is offered in «Agregar gráfico»: by its question or its number, or by what it shows. */
export function dashboardAddLabel(dashboard: FormDashboard, card: DashboardCard, t: Translate): string {
  if (card.source.kind === "received") return card.measure.kind === "total" ? dashboardNumberLabel(dashboard, card.measure, t) : t("dashboard.addReceived");
  if (card.source.kind === "actors" || card.source.kind === "states") return t(`dashboard.titles.${card.source.kind}`);
  return questionLabel(dashboard, card.source, t);
}

/** What can be counted with it, with the period of the dashboard in sight. */
export function dashboardAddDescription(dashboard: FormDashboard, card: DashboardCard, t: Translate): string {
  const { period } = dashboard;
  const totals = dashboard.numbers.length > 0;
  switch (card.source.kind) {
    case "received": return t(card.measure.kind === "total" ? `dashboard.describe.number.${period}` : `dashboard.describe.received.${period}`);
    case "date": return t(totals ? `dashboard.describe.dateTotal.${period}` : `dashboard.describe.date.${period}`);
    case "choice": return t(totals ? "dashboard.describe.choiceTotal" : "dashboard.describe.choice");
    case "actors": return t("dashboard.describe.actors");
    case "states": return t("dashboard.describe.states");
  }
}

export const dashboardMeasureKey = (measure: DashboardMeasure): string => measure.kind === "count" ? "count" : numberKey(measure);

export function dashboardMeasureFromKey(key: string): DashboardMeasure | null {
  if (key === "count") return count;
  const [fieldId, currencyId, ...rest] = key.split(".");
  return fieldId && guid.test(fieldId) && (currencyId === undefined || guid.test(currencyId)) && rest.length === 0
    ? { kind: "total", fieldId, currencyId: currencyId ?? null } : null;
}

/** «Contar»: the responses or the total of one number by currency, never all the currencies added; none for who loaded or the states. */
export function dashboardMeasureOptions(dashboard: FormDashboard, card: DashboardCard, t: Translate): readonly { value: string; label: string }[] {
  if (card.source.kind === "actors" || card.source.kind === "states" || dashboard.numbers.length === 0) return [];
  return [{ value: "count", label: t("dashboard.menu.quantity") },
    ...dashboard.numbers.map(number => ({ value: numberKey(number), label: t("dashboard.menu.total", { number: dashboardNumberLabel(dashboard, number, t) }) }))];
}

// ── Numbers in the language of the menu ─────────────────────────────────────────────────────────────────────────────────────

// The one number format of the app (shared/lib/numberFormat): es-AR and en-US, each region and set of options with its formatter.
// The decimal text of a number as JSON brought it, without an exponent, for the one format of typed values.
const decimalText = (value: number) => numberFormat("en", { useGrouping: false, maximumFractionDigits: 20 }).format(value);

export const formatDashboardCount = (value: number, language: string): string => formatTypedValue("integer", decimalText(value), language) ?? String(value);
export const formatDashboardAmount = (value: number, language: string): string => formatTypedValue("decimal", decimalText(value), language) ?? String(value);
/** An average is a division: two decimals at most, without the zeros left over. */
export const formatDashboardAverage = (value: number, language: string): string =>
  formatTypedValue("decimal", value.toFixed(2).replace(/\.?0+$/, ""), language) ?? String(value);
/** A short number for the cap of a bar, two significant digits («4,4 M», «820 k»); the table keeps it exact. */
export const formatDashboardCompact = (value: number, language: string): string => numberFormat(language, { notation: "compact", maximumSignificantDigits: 2 }).format(value);

/** The share of a whole in whole percents, «<1%» for a sliver; nothing when the whole is nothing. */
export function formatDashboardShare(part: number, whole: number, language: string): string | undefined {
  if (!(whole > 0)) return undefined;
  const share = part / whole;
  const percent = numberFormat(language, { style: "percent", maximumFractionDigits: 0 });
  return share > 0 && share < 0.005 ? "<" + percent.format(0.01) : percent.format(share);
}

/** The change against the previous period, with its sign: «+18%», «-5%», «0%». */
export const formatDashboardChange = (current: number, previous: number, language: string): string =>
  numberFormat(language, { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" }).format((current - previous) / Math.abs(previous));

// ── Dates with numbers only ─────────────────────────────────────────────────────────────────────────────────────────────────

const day = (value: string, language: string) => formatDateOnly(value, language) ?? value;
const range = (from: string, to: string, t: Translate, language: string) => from === to ? day(from, language) : t("dashboard.range", { from: day(from, language), to: day(to, language) });

function lastDay(start: string, period: DashboardPeriod): string {
  const date = new Date(start + "T00:00:00.000Z");
  if (period === "week") date.setUTCDate(date.getUTCDate() + 6);
  if (period === "month") { date.setUTCMonth(date.getUTCMonth() + 1, 1); date.setUTCDate(0); }
  return date.toISOString().slice(0, 10);
}

/** The days of a bucket: the day, its week from Monday or its month («05/10/2026 – 11/10/2026»). */
export const dashboardBucketPeriod = (start: string, period: DashboardPeriod, t: Translate, language: string): string =>
  range(start, lastDay(start, period), t, language);

/** The previous range in the zone of the dashboard, the one its buckets and the sheet's filter use. */
export const dashboardPreviousPeriod = (previous: NonNullable<FormDashboard["previous"]>, zone: string, t: Translate, language: string): string =>
  range(calendarDateInZone(previous.fromUtc, zone), calendarDateInZone(new Date(Date.parse(previous.toUtc) - 1).toISOString(), zone), t, language);

// ── What each piece shows ───────────────────────────────────────────────────────────────────────────────────────────────────

export interface DashboardStat { readonly key: string; readonly label: string; readonly value: string; readonly detail?: string }

/**
 * The numbers row: how many arrived and, for each number by currency, its total, its average and its minimum and maximum, the
 * first two against the previous period when the filter has a range of dates. What does not fit shows «—» with its reason.
 */
export function dashboardStats(dashboard: FormDashboard, { t, language }: DashboardFormat): readonly DashboardStat[] {
  const period = dashboard.previous ? dashboardPreviousPeriod(dashboard.previous, dashboard.timeZoneId, t, language) : null;
  const compare = (current: number, previous: number | null | undefined) => period === null || previous === null || previous === undefined ? undefined
    : previous === 0 ? t("dashboard.stats.zero", { period }) : t("dashboard.stats.change", { change: formatDashboardChange(current, previous, language), period });
  const stats: DashboardStat[] = [{ key: "count", label: t("dashboard.stats.count"), value: formatDashboardCount(dashboard.count, language), detail: compare(dashboard.count, dashboard.previous?.count) }];
  for (const number of dashboard.numbers) {
    const name = dashboardNumberLabel(dashboard, number, t);
    const key = numberKey(number);
    // A null with answers is a value that did not fit; without answers, there is nothing to calculate.
    const missing = number.overflow && number.count > 0 ? t("dashboard.stats.overflow") : undefined;
    stats.push(
      { key: "total:" + key, label: t("dashboard.stats.total", { number: name }), ...number.total === null
        ? { value: "—", detail: missing } : { value: formatDashboardAmount(number.total, language), detail: compare(number.total, number.previousTotal) } },
      { key: "average:" + key, label: t("dashboard.stats.average", { number: name }), ...number.average === null
        ? { value: "—", detail: missing } : { value: formatDashboardAverage(number.average, language), detail: compare(number.average, number.previousAverage) } },
      { key: "range:" + key, label: t("dashboard.stats.range", { number: name }), ...number.minimum === null || number.maximum === null
        ? { value: "—", detail: missing } : { value: t("dashboard.stats.rangeValue", { minimum: formatDashboardAmount(number.minimum, language), maximum: formatDashboardAmount(number.maximum, language) }) } },
    );
  }
  return stats.map(stat => stat.detail === undefined ? { key: stat.key, label: stat.label, value: stat.value } : stat);
}

export type DashboardView =
  | { readonly kind: "bars"; readonly buckets: readonly BarChartBucket[]; readonly periodHeader: string; readonly valueHeader: string; readonly note?: string }
  | { readonly kind: "list"; readonly items: readonly BarListItem[]; readonly labelHeader: string; readonly valueHeader: string; readonly shareHeader: string; readonly note?: string };

// What a bucket or an option counts: its responses, or the total of one number with one currency (zero where it was not answered).
function measured(entry: { count: number; totals: readonly FormDashboardTotal[] }, measure: DashboardMeasure): { value: number | null; overflow: boolean } {
  if (measure.kind === "count") return { value: entry.count, overflow: false };
  const total = entry.totals.find(item => item.fieldId === measure.fieldId && item.currencyId === measure.currencyId);
  return total ? { value: total.total, overflow: total.overflow } : { value: 0, overflow: false };
}

const stateTones: Record<FormDashboardState, ChartTone> = { Received: "muted", PendingApproval: "warning", Approved: "success", Rejected: "danger", Voided: "muted" };
const notes = (...lines: (string | false | undefined)[]) => lines.filter(Boolean).join(" ") || undefined;

/**
 * What a card shows, as the reply lets it show: its bars by the period of that reply or its distribution, with every value and
 * date written for the menu's language.
 */
export function dashboardCardView(dashboard: FormDashboard, shown: DashboardCard, { t, language }: DashboardFormat): DashboardView {
  const { period } = dashboard;
  const card = dashboardCardAsShown(dashboard, shown);
  const { measure } = card;
  const totalLabel = measure.kind === "total" ? t("dashboard.menu.total", { number: dashboardNumberLabel(dashboard, measure, t) }) : t("dashboard.table.count");
  const written = (value: number | null) => value === null ? "—" : measure.kind === "total" ? formatDashboardAmount(value, language) : formatDashboardCount(value, language);
  let overflow = false;
  if (card.source.kind === "received" || card.source.kind === "date") {
    const { source } = card;
    const series = source.kind === "received" ? dashboard.series : dashboard.dateSeries.find(item => item.fieldId === source.fieldId) ?? { buckets: [], truncated: false };
    const buckets = series.buckets.map(bucket => {
      const { value, overflow: over } = measured(bucket, measure);
      overflow ||= over;
      return { key: bucket.start, value, cap: value === null ? "—" : measure.kind === "total" ? formatDashboardCompact(value, language) : formatDashboardCount(value, language),
        exact: written(value), axis: day(bucket.start, language), period: dashboardBucketPeriod(bucket.start, period, t, language) };
    });
    return { kind: "bars", buckets, periodHeader: t(`dashboard.periods.${period}`), valueHeader: totalLabel,
      note: notes(series.truncated && t(`dashboard.truncated.${period}`, { count: buckets.length }), overflow && t("dashboard.overflowNote")) };
  }
  const shareOf = (value: number | null, whole: number | null | undefined) => value === null || whole === null || whole === undefined ? undefined : formatDashboardShare(value, whole, language);
  const headers = { valueHeader: totalLabel, shareHeader: t("dashboard.table.share") };
  if (card.source.kind === "actors") {
    const items: BarListItem[] = dashboard.actors.options.map(person => ({ key: person.id, label: person.label || t("responses.unknownPerson"), value: person.count,
      valueLabel: formatDashboardCount(person.count, language), share: shareOf(person.count, dashboard.count), tone: "default" }));
    const others = dashboard.actors.others;
    if (others) items.push({ key: "others", label: t("dashboard.otherPeople", { count: others.peopleCount }), value: others.count,
      valueLabel: formatDashboardCount(others.count, language), share: shareOf(others.count, dashboard.count), tone: "muted" });
    return { kind: "list", items: clean(items), labelHeader: t("dashboard.table.person"), ...headers };
  }
  if (card.source.kind === "states") return { kind: "list", labelHeader: t("dashboard.table.state"), ...headers, items: clean(dashboard.states.map(state => ({
    key: state.state, label: t(`approvals.states.${state.state}`), value: state.count, valueLabel: formatDashboardCount(state.count, language),
    share: shareOf(state.count, dashboard.count), tone: stateTones[state.state] }))) };
  const { fieldId } = card.source;
  const distribution = dashboard.distributions.find(item => item.fieldId === fieldId);
  // A share is of the responses, or of the total of the same number with the same currency: never of another currency.
  const whole = measure.kind === "total" ? findNumber(dashboard, measure)?.total : dashboard.count;
  const optionLabel = (id: string, label: string) => distribution?.type === "boolean" ? t(id === "true" ? "responses.yes" : "responses.no") : label || t("responses.unavailableValue");
  const items: BarListItem[] = (distribution?.options ?? []).map(option => {
    const { value, overflow: over } = measured(option, measure);
    overflow ||= over;
    return { key: option.id, label: optionLabel(option.id, option.label), value, valueLabel: written(value), share: shareOf(value, whole), tone: "default" };
  });
  if (distribution?.others) {
    const { value, overflow: over } = measured(distribution.others, measure);
    overflow ||= over;
    items.push({ key: "others", label: t("dashboard.others", { count: distribution.others.optionCount }), value, valueLabel: written(value), share: shareOf(value, whole), tone: "muted" });
  }
  return { kind: "list", items: clean(items), labelHeader: t("dashboard.table.option"), ...headers, note: overflow ? t("dashboard.overflowNote") : undefined };
}

// An item without a share does not carry the key, as the piece reads it.
const clean = (items: readonly BarListItem[]): BarListItem[] => items.map(item => item.share === undefined ? (({ share: _share, ...rest }) => rest)(item) : item);

export type { FormDashboardNumber };
