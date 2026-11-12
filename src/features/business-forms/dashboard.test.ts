import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/shared/i18n";
import { dashboardFixture, dashboardIds as ids } from "@/test/dashboardFixtures";
import type { FormDashboard } from "./api/dashboard";
import {
  addableDashboardCards, automaticDashboardCards, dashboardAddDescription, dashboardAddLabel, dashboardCardAsShown, dashboardCardList, dashboardCardShown,
  dashboardCardsParam, dashboardCardTitle, dashboardCardView, dashboardMeasureFromKey, dashboardMeasureKey, dashboardMeasureOptions,
  dashboardNumberLabel, dashboardStats, formatDashboardAmount, formatDashboardAverage, formatDashboardChange,
  formatDashboardCompact, formatDashboardCount, formatDashboardShare, parseDashboardCards, serializeDashboardCards, withDashboardCard,
  withDashboardMeasure, withDashboardView, withoutDashboardCard, type DashboardCard,
} from "./dashboard";
import { dashboardPeriod, type DashboardPeriod } from "./dashboardPeriod";

const es = { t: i18n.getFixedT("es", "forms"), language: "es" };
const en = { t: i18n.getFixedT("en", "forms"), language: "en" };
const everyone = { actors: true, states: true };
const count = { kind: "count" } as const;
const pesos = { kind: "total", fieldId: ids.amount, currencyId: ids.pesos } as const;
const dollars = { kind: "total", fieldId: ids.amount, currencyId: ids.dollars } as const;
const card = (source: DashboardCard["source"], measure: DashboardCard["measure"] = count, table = false): DashboardCard => ({ source, measure, table });
const received = card({ kind: "received" });
const bank = card({ kind: "choice", fieldId: ids.bank });
// The reply names its period: everything written from it says that one, not the one the address asks next.
const by = (period: DashboardPeriod, dashboard: FormDashboard = dashboardFixture()): FormDashboard => ({ ...dashboard, period });
// Intl writes a percent or a compact number its own way (a space, a «k»): the tests ask it the same as the code.
const percent = (value: number, language = "es-AR", sign = false) => new Intl.NumberFormat(language, { style: "percent", maximumFractionDigits: 0, ...sign ? { signDisplay: "exceptZero" as const } : {} }).format(value);
// The test set-up loads the namespaces in Spanish only.
beforeAll(async () => { await i18n.loadLanguages("en"); });

describe("the period and the adjustments in the address", () => {
  it("groups by day unless the address says week or month", () => {
    expect([null, "", "year", "day", "week", "month"].map(dashboardPeriod)).toEqual(["day", "day", "day", "day", "week", "month"]);
  });

  it("writes each card in a short token and reads it back, the order, the count, the total by currency and the table included", () => {
    const cards = [received, card({ kind: "received" }, pesos), card({ kind: "date", fieldId: ids.paidOn }, dollars, true), bank,
      card({ kind: "choice", fieldId: ids.paid }, { kind: "total", fieldId: ids.amount, currencyId: null }), card({ kind: "actors" }, count, true), card({ kind: "states" })];
    const param = serializeDashboardCards(cards);

    expect(param).toBe(["received", `received.total.${ids.amount}.${ids.pesos}`, `date.${ids.paidOn}.total.${ids.amount}.${ids.dollars}.table`,
      `choice.${ids.bank}`, `choice.${ids.paid}.total.${ids.amount}`, "actors.table", "states"].join(","));
    expect(parseDashboardCards(param)).toEqual(cards);
  });

  it("reads no address as the automatic dashboard and «none» as a dashboard without cards", () => {
    expect(parseDashboardCards(null)).toBeNull();
    expect(serializeDashboardCards([])).toBe("none");
    expect(parseDashboardCards("none")).toEqual([]);
  });

  it("leaves out what it does not understand instead of guessing", () => {
    expect(parseDashboardCards(["received", "choice.not-a-guid", "date", "actors.chart", "received.total", `choice.${ids.bank}.sum.${ids.amount}`, "states.table"].join(",")))
      .toEqual([received, card({ kind: "states" }, count, true)]);
  });

  it("takes the address away when a change leaves the automatic dashboard again", () => {
    const automatic = automaticDashboardCards(dashboardFixture(), everyone);
    const shown = withDashboardView(automatic, 3, true);

    expect(dashboardCardsParam(shown, automatic)).toBe(serializeDashboardCards(shown));
    expect(dashboardCardsParam(withDashboardView(shown, 3, false), automatic)).toBeUndefined();
  });
});

describe("the cards", () => {
  it("arms the automatic dashboard from the types of the questions: how many arrived, each number by currency, each choice, each date, who loaded and the states", () => {
    expect(automaticDashboardCards(dashboardFixture(), everyone)).toEqual([
      received, card({ kind: "received" }, pesos), card({ kind: "received" }, dollars), bank, card({ kind: "choice", fieldId: ids.paid }),
      card({ kind: "date", fieldId: ids.paidOn }), card({ kind: "actors" }), card({ kind: "states" })]);
  });

  it("leaves out who loaded for whoever only loads and the states of a form without approval", () => {
    const cards = automaticDashboardCards(dashboardFixture(), { actors: false, states: false });
    expect(cards.map(item => item.source.kind)).not.toContain("actors");
    expect(cards.map(item => item.source.kind)).not.toContain("states");
  });

  it("shows the cards of the address whose question came, and keeps the others in the address", () => {
    const dashboard = dashboardFixture();
    const gone = card({ kind: "choice", fieldId: "0199a0c0-0000-7000-8000-000000000099" });
    const elsewhere = card({ kind: "received" }, { kind: "total", fieldId: ids.amount, currencyId: "0199a0c0-0000-7000-8000-000000000098" });
    const list = dashboardCardList(dashboard, serializeDashboardCards([gone, bank, elsewhere]), everyone);

    expect(list).toEqual([gone, bank, elsewhere]);
    expect(list.map(item => dashboardCardShown(dashboard, item, everyone))).toEqual([false, true, true]);
    expect(dashboardCardShown(dashboard, card({ kind: "states" }), { actors: true, states: false })).toBe(false);
  });

  it("counts the responses on a card whose number or currency the filters leave out, and keeps what it adds up in the address", () => {
    const dashboard = dashboardFixture();
    const euros = { kind: "total", fieldId: ids.amount, currencyId: "0199a0c0-0000-7000-8000-000000000098" } as const;
    const banksInEuros = card({ kind: "choice", fieldId: ids.bank }, euros, true);

    expect(dashboardCardAsShown(dashboard, banksInEuros)).toEqual(card({ kind: "choice", fieldId: ids.bank }, count, true));
    expect(dashboardCardAsShown(dashboard, card({ kind: "received" }, dollars))).toEqual(card({ kind: "received" }, dollars));
    expect(dashboardCardAsShown({ ...dashboard, numbers: [...dashboard.numbers, { ...dashboard.numbers[1]!, currencyId: euros.currencyId, currencyLabel: "Euros" }] }, banksInEuros))
      .toEqual(banksInEuros);
    // It stands for what it shows: how many arrived is not offered twice.
    expect(addableDashboardCards(dashboard, [card({ kind: "received" }, euros)], { actors: false, states: false })).not.toContainEqual(received);
  });

  it("adds at the end, takes away, changes the count and the view of a card, from the automatic dashboard", () => {
    const automatic = automaticDashboardCards(dashboardFixture(), everyone);
    const without = withoutDashboardCard(automatic, 0);

    expect(without).toEqual(automatic.slice(1));
    expect(withDashboardCard(without, received).at(-1)).toEqual(received);
    expect(withDashboardMeasure(automatic, 3, pesos)[3]).toEqual(card({ kind: "choice", fieldId: ids.bank }, pesos));
    expect(withDashboardView(automatic, 3, true)[3]).toEqual(card({ kind: "choice", fieldId: ids.bank }, count, true));
    expect(automatic[3]).toEqual(bank);
  });

  it("offers to add what has no card: a question, a number by currency, how many arrived, who loaded or the states", () => {
    const dashboard = dashboardFixture();
    const automatic = automaticDashboardCards(dashboard, everyone);
    expect(addableDashboardCards(dashboard, automatic, everyone)).toEqual([]);

    const list = withoutDashboardCard(withoutDashboardCard(withoutDashboardCard(automatic, 7), 3), 0);
    expect(addableDashboardCards(dashboard, list, everyone)).toEqual([received, bank, card({ kind: "states" })]);
    // A card that changed what it counts no longer stands for how many arrived.
    expect(addableDashboardCards(dashboard, withDashboardMeasure(automatic, 0, dollars), everyone)).toEqual([received]);
  });

  it("names what each card adds and what it can count, with the period of the dashboard", () => {
    const dashboard = by("week");
    expect([received, card({ kind: "received" }, pesos), bank, card({ kind: "date", fieldId: ids.paidOn }), card({ kind: "actors" }), card({ kind: "states" })]
      .map(item => [dashboardAddLabel(dashboard, item, es.t), dashboardAddDescription(dashboard, item, es.t)])).toEqual([
      ["Cuántas llegaron", "Cantidad por semana"], ["Monto (Pesos)", "Total por semana"], ["Banco (catálogo Bancos y billeteras)", "Cantidad o total, por opción"],
      ["Fecha de pago", "Cantidad o total, por semana"], ["Quién cargó", "Cantidad por persona"], ["Por estado", "Cantidad por estado"]]);
    const plain = { ...dashboard, numbers: [] };
    expect(dashboardAddDescription(plain, bank, es.t)).toBe("Cantidad por opción");
    expect(dashboardAddDescription(by("month", plain), card({ kind: "date", fieldId: ids.paidOn }), en.t)).toBe("Count by month");
  });
});

describe("what each card counts and how it is called", () => {
  it("names a number with its currency, an empty currency as such and a number without currency as it is", () => {
    const dashboard = dashboardFixture();
    expect(dashboardNumberLabel(dashboard, pesos, es.t)).toBe("Monto (Pesos)");
    const withEmpty = { ...dashboard, numbers: [...dashboard.numbers, { ...dashboard.numbers[1]!, currencyId: null, currencyLabel: null }] };
    expect(dashboardNumberLabel(withEmpty, { fieldId: ids.amount, currencyId: null }, es.t)).toBe("Monto (sin moneda)");
    const plain = { ...dashboard, numbers: [{ ...dashboard.numbers[0]!, currencyId: null, currencyLabel: null }] };
    expect(dashboardNumberLabel(plain, { fieldId: ids.amount, currencyId: null }, en.t)).toBe("Monto");
  });

  it("titles each card by what it counts and the period of the reply, and a catalog question with its catalog", () => {
    const dashboard = dashboardFixture();
    expect(dashboardCardTitle(dashboard, received, es.t)).toBe("Cuántas llegaron, por día");
    expect(dashboardCardTitle(by("week"), received, es.t)).toBe("Cuántas llegaron, por semana");
    expect(dashboardCardTitle(by("week"), card({ kind: "received" }, pesos), es.t)).toBe("Total de Monto (Pesos), por semana");
    expect(dashboardCardTitle(by("month"), card({ kind: "date", fieldId: ids.paidOn }), es.t)).toBe("Por mes de Fecha de pago");
    expect(dashboardCardTitle(dashboard, card({ kind: "date", fieldId: ids.paidOn }, dollars), es.t)).toBe("Total de Monto (Dólares), por día de Fecha de pago");
    expect(dashboardCardTitle(dashboard, bank, es.t)).toBe("Por Banco (catálogo Bancos y billeteras)");
    expect(dashboardCardTitle(dashboard, card({ kind: "choice", fieldId: ids.paid }, pesos), en.t)).toBe("Total of Monto (Pesos), by Pagado");
    expect(dashboardCardTitle(dashboard, card({ kind: "actors" }), es.t)).toBe("Quién cargó");
    expect(dashboardCardTitle(dashboard, card({ kind: "states" }), en.t)).toBe("By state");
  });

  it("offers to count the responses or the total of each number by currency, never a total of all currencies", () => {
    const dashboard = dashboardFixture();
    expect(dashboardMeasureOptions(dashboard, bank, es.t)).toEqual([
      { value: "count", label: "Cantidad" },
      { value: `${ids.amount}.${ids.pesos}`, label: "Total de Monto (Pesos)" },
      { value: `${ids.amount}.${ids.dollars}`, label: "Total de Monto (Dólares)" }]);
    expect(dashboardMeasureOptions(dashboard, card({ kind: "actors" }), es.t)).toEqual([]);
    expect(dashboardMeasureOptions({ ...dashboard, numbers: [] }, bank, es.t)).toEqual([]);
    expect(dashboardMeasureFromKey(dashboardMeasureKey(dollars))).toEqual(dollars);
    expect(dashboardMeasureFromKey(dashboardMeasureKey({ kind: "total", fieldId: ids.amount, currencyId: null }))).toEqual({ kind: "total", fieldId: ids.amount, currencyId: null });
    expect(dashboardMeasureFromKey("count")).toEqual(count);
    expect(dashboardMeasureFromKey("anything")).toBeNull();
  });
});

describe("the numbers", () => {
  it("compares the count and each number by currency with the previous period, named by its dates", () => {
    expect(dashboardStats(dashboardFixture(), es)).toEqual([
      { key: "count", label: "Respuestas", value: "6", detail: `${percent(2, "es-AR", true)} que 01/09/2026 – 30/09/2026` },
      { key: `total:${ids.amount}.${ids.pesos}`, label: "Total de Monto (Pesos)", value: "2.050", detail: `${percent(4.125, "es-AR", true)} que 01/09/2026 – 30/09/2026` },
      { key: `average:${ids.amount}.${ids.pesos}`, label: "Promedio de Monto (Pesos)", value: "512,5", detail: `${percent(1.5625, "es-AR", true)} que 01/09/2026 – 30/09/2026` },
      { key: `range:${ids.amount}.${ids.pesos}`, label: "Mínimo y máximo de Monto (Pesos)", value: "50 · 1.000" },
      { key: `total:${ids.amount}.${ids.dollars}`, label: "Total de Monto (Dólares)", value: "500", detail: "0 en 01/09/2026 – 30/09/2026" },
      { key: `average:${ids.amount}.${ids.dollars}`, label: "Promedio de Monto (Dólares)", value: "500" },
      { key: `range:${ids.amount}.${ids.dollars}`, label: "Mínimo y máximo de Monto (Dólares)", value: "500 · 500" },
    ]);
  });

  it("shows «—» with its reason for what does not fit, and «—» alone for a number nobody answered", () => {
    const dashboard = dashboardFixture();
    dashboard.numbers = [{ ...dashboard.numbers[0]!, total: null, average: null, overflow: true }, { ...dashboard.numbers[1]!, count: 0, total: 0, average: null, minimum: null, maximum: null }];
    const stats = dashboardStats(dashboard, en);
    expect(stats[1]).toEqual({ key: `total:${ids.amount}.${ids.pesos}`, label: "Total of Monto (Pesos)", value: "—", detail: "Too big to calculate." });
    expect(stats[2]).toMatchObject({ value: "—", detail: "Too big to calculate." });
    expect(stats[3]).toMatchObject({ value: "50 · 1,000" });
    expect(stats.slice(4).map(item => [item.value, item.detail])).toEqual([["0", "0 in 09/01/2026 – 09/30/2026"], ["—", undefined], ["—", undefined]]);
  });

  it("does not compare without a range of dates", () => {
    expect(dashboardStats({ ...dashboardFixture(), previous: null }, es).every(item => item.detail === undefined)).toBe(true);
  });

  it("names a previous day by itself and a range in the zone of the dashboard", () => {
    const dashboard = { ...dashboardFixture(), previous: { fromUtc: "2026-09-30T03:00:00Z", toUtc: "2026-10-01T03:00:00Z", count: 4 } };
    expect(dashboardStats(dashboard, es)[0]?.detail).toBe(`${percent(0.5, "es-AR", true)} que 30/09/2026`);
    expect(dashboardStats({ ...dashboard, timeZoneId: "UTC" }, en)[0]?.detail).toBe(`${percent(0.5, "en-US", true)} vs 09/30/2026 – 10/01/2026`);
  });
});

describe("the charts", () => {
  it("shows how many arrived by period, with the days without responses at zero and the dates with numbers", () => {
    const view = dashboardCardView(dashboardFixture(), received, es);
    expect(view.kind).toBe("bars");
    if (view.kind !== "bars") return;
    expect(view.buckets.map(bucket => [bucket.value, bucket.cap, bucket.exact, bucket.axis, bucket.period])).toEqual([
      [2, "2", "2", "01/10/2026", "01/10/2026"], [0, "0", "0", "02/10/2026", "02/10/2026"], [3, "3", "3", "03/10/2026", "03/10/2026"], [1, "1", "1", "04/10/2026", "04/10/2026"]]);
    expect([view.periodHeader, view.valueHeader, view.note]).toEqual(["Día", "Cantidad", undefined]);
  });

  it("adds up a number of one currency by week and month, short on the bar and exact in the table", () => {
    const dashboard = dashboardFixture();
    dashboard.series.buckets[0]!.totals[0]!.total = 1500000;
    const weekly = dashboardCardView(by("week", dashboard), card({ kind: "received" }, pesos), en);
    if (weekly.kind !== "bars") throw new Error("bars");
    expect(weekly.buckets[0]).toMatchObject({ value: 1500000, cap: new Intl.NumberFormat("en-US", { notation: "compact", maximumSignificantDigits: 2 }).format(1500000), exact: "1,500,000", period: "10/01/2026 – 10/07/2026" });
    expect(weekly.valueHeader).toBe("Total of Monto (Pesos)");
    dashboard.dateSeries[0]!.buckets = [{ start: "2026-09-01", count: 3, totals: [{ fieldId: ids.amount, currencyId: ids.pesos, total: 2050, overflow: false },
      { fieldId: ids.amount, currencyId: ids.dollars, total: 500, overflow: false }] }];
    const monthly = dashboardCardView(by("month", dashboard), card({ kind: "date", fieldId: ids.paidOn }, dollars), es);
    if (monthly.kind !== "bars") throw new Error("bars");
    expect(monthly.buckets).toEqual([{ key: "2026-09-01", value: 500, cap: "500", exact: "500", axis: "01/09/2026", period: "01/09/2026 – 30/09/2026" }]);
  });

  it("names a month by its days and says when it shows the latest buckets or a total did not fit", () => {
    const dashboard = dashboardFixture();
    const totals = (pesos: number | null) => [{ fieldId: ids.amount, currencyId: ids.pesos, total: pesos, overflow: pesos === null }, { fieldId: ids.amount, currencyId: ids.dollars, total: 0, overflow: false }];
    dashboard.series = { truncated: true, buckets: [{ start: "2026-09-01", count: 1, totals: totals(null) }, { start: "2026-10-01", count: 1, totals: totals(10) },
      { start: "2026-11-01", count: 0, totals: totals(0) }] };
    const view = dashboardCardView(by("month", dashboard), card({ kind: "received" }, pesos), es);
    if (view.kind !== "bars") throw new Error("bars");
    expect(view.buckets[0]).toMatchObject({ value: null, cap: "—", exact: "—", axis: "01/09/2026", period: "01/09/2026 – 30/09/2026" });
    expect(view.note).toBe("Se ven los últimos 3 meses. Algunos totales son demasiado grandes para calcularlos y van con «—».");
  });

  it("distributes a catalog question by option with its share, the rest as «Otras» and a total by its own currency", () => {
    const counted = dashboardCardView(dashboardFixture(), bank, es);
    if (counted.kind !== "list") throw new Error("list");
    expect(counted.items).toEqual([
      { key: ids.galicia, label: "Banco Galicia", value: 3, valueLabel: "3", share: percent(0.5), tone: "default" },
      { key: ids.nacion, label: "Banco Nación", value: 2, valueLabel: "2", share: percent(2 / 6), tone: "default" },
      { key: "others", label: "Otras 3 opciones", value: 1, valueLabel: "1", share: percent(1 / 6), tone: "muted" }]);
    expect([counted.labelHeader, counted.valueHeader, counted.shareHeader]).toEqual(["Opción", "Cantidad", "%"]);
    // The total of the dollars is shared out against the dollars only: a currency is never added to another one.
    const inDollars = dashboardCardView(dashboardFixture(), card({ kind: "choice", fieldId: ids.bank }, dollars), es);
    if (inDollars.kind !== "list") throw new Error("list");
    expect(inDollars.items.map(item => [item.label, item.valueLabel, item.share])).toEqual([["Banco Galicia", "500", percent(1)], ["Banco Nación", "0", percent(0)], ["Otras 3 opciones", "0", percent(0)]]);
    expect(inDollars.valueHeader).toBe("Total de Monto (Dólares)");
  });

  it("reads a yes or no in the language of the menu, an option without a name and a person without one", () => {
    const dashboard = dashboardFixture();
    dashboard.distributions[0]!.options[1]!.label = "";
    const paid = dashboardCardView(dashboard, card({ kind: "choice", fieldId: ids.paid }), en);
    const banks = dashboardCardView(dashboard, bank, es);
    const actors = dashboardCardView(dashboard, card({ kind: "actors" }), es);
    if (paid.kind !== "list" || banks.kind !== "list" || actors.kind !== "list") throw new Error("list");
    expect(paid.items.map(item => item.label)).toEqual(["Yes", "No"]);
    expect(banks.items[1]?.label).toBe("Valor no disponible");
    expect(actors.items.map(item => [item.label, item.valueLabel, item.tone])).toEqual([["Ana Tablero", "4", "default"], ["Persona sin información", "1", "default"], ["Otra persona", "1", "muted"]]);
    expect(actors.labelHeader).toBe("Persona");
  });

  it("names each state as the sheet does, with the colors of their roles", () => {
    const view = dashboardCardView(dashboardFixture(), card({ kind: "states" }), es);
    if (view.kind !== "list") throw new Error("list");
    expect(view.items.map(item => [item.label, item.valueLabel, item.tone])).toEqual([["Recibida", "3", "muted"], ["Por aprobar", "2", "warning"], ["Aprobada", "1", "success"]]);
  });

  it("marks with «—» an option whose total did not fit and says why under the list", () => {
    const dashboard: FormDashboard = dashboardFixture();
    dashboard.distributions[0]!.options[0]!.totals[0] = { fieldId: ids.amount, currencyId: ids.pesos, total: null, overflow: true };
    const view = dashboardCardView(dashboard, card({ kind: "choice", fieldId: ids.bank }, pesos), es);
    if (view.kind !== "list") throw new Error("list");
    expect(view.items[0]).toMatchObject({ value: null, valueLabel: "—" });
    expect(view.items[0]?.share).toBeUndefined();
    expect(view.note).toBe("Algunos totales son demasiado grandes para calcularlos y van con «—».");
  });
});

describe("the numbers in the language of the menu", () => {
  it("writes counts and exact amounts as the sheet does, an average with two decimals and a short number on a bar", () => {
    expect([formatDashboardCount(14381300, "es"), formatDashboardCount(14381300, "en")]).toEqual(["14.381.300", "14,381,300"]);
    expect([formatDashboardAmount(14381300.5, "es"), formatDashboardAmount(0.1, "en"), formatDashboardAmount(-1200, "es")]).toEqual(["14.381.300,5", "0.1", "-1.200"]);
    expect([formatDashboardAverage(118854.12345678901, "es"), formatDashboardAverage(2 / 3, "en"), formatDashboardAverage(512.5, "es")]).toEqual(["118.854,12", "0.67", "512,5"]);
    expect([formatDashboardCompact(4400000, "es"), formatDashboardCompact(818300, "en"), formatDashboardCompact(9, "es")]).toEqual([new Intl.NumberFormat("es-AR", { notation: "compact", maximumSignificantDigits: 2 }).format(4400000), "820K", "9"]);
  });

  it("writes a share and a change with their sign, and never a share of nothing", () => {
    expect(formatDashboardShare(38, 123, "es")).toBe(percent(38 / 123));
    expect(formatDashboardShare(1, 1000, "en")).toBe("<" + percent(0.01, "en-US"));
    expect(formatDashboardShare(1, 0, "es")).toBeUndefined();
    expect([formatDashboardChange(123, 104, "es"), formatDashboardChange(90, 100, "en"), formatDashboardChange(5, 5, "es")])
      .toEqual([percent(19 / 104, "es-AR", true), percent(-0.1, "en-US", true), percent(0, "es-AR", true)]);
  });
});
