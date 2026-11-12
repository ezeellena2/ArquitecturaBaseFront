import { useTranslation } from "react-i18next";
import { formatNumber } from "@/shared/lib/numberFormat";
import { BarChart, type BarChartBucket } from "@/shared/ui/charts/BarChart";
import { BarList, type BarListItem } from "@/shared/ui/charts/BarList";
import { ChartRefreshing } from "@/shared/ui/charts/ChartRefreshing";
import { StatCard } from "@/shared/ui/charts/StatCard";
import { Surface } from "@/shared/ui/Surface";

// October by day, with the Sundays quiet: the counts the dashboard scene uses too.
const october = [7, 8, 2, 0, 6, 7, 6, 8, 9, 1, 0, 9, 7, 8, 10, 2, 0, 0, 8, 9, 8, 8, 2, 0, 1, 0, 0, 0, 0, 0, 0];
// Four hundred days up to 31/10/2026, the most buckets the server sends: the space between bars narrows so they fit any card.
const longStart = Date.UTC(2025, 8, 27);
const longCounts = Array.from({ length: 400 }, (_, index) => index % 7 === 1 ? 0 : 3 + index * 37 % 9);

/// The pieces of a chart (DOC7-A) with fictitious data, as the visual standard asks of a new piece: the number with its change,
/// with «—» and its reason and while it loads; the bars by period, with the quiet days, short caps and its table, and four
/// hundred days in one card; the bars of a distribution, with «Otras», the colors of the states and its table; empty, and
/// reading again.
export function CatalogCharts() {
  const { i18n } = useTranslation();
  const es = !i18n.language.startsWith("en");
  const day = (index: number) => es ? `${String(index + 1).padStart(2, "0")}/10/2026` : `10/${String(index + 1).padStart(2, "0")}/2026`;
  const days: BarChartBucket[] = october.map((count, index) => ({ key: "d" + index, value: count, cap: String(count), exact: String(count), axis: day(index), period: day(index) }));
  const longDay = (index: number) => {
    const date = new Date(longStart + index * 86_400_000);
    const [dd, mm] = [date.getUTCDate(), date.getUTCMonth() + 1].map(part => String(part).padStart(2, "0"));
    return es ? `${dd}/${mm}/${date.getUTCFullYear()}` : `${mm}/${dd}/${date.getUTCFullYear()}`;
  };
  const longDays: BarChartBucket[] = longCounts.map((count, index) => ({ key: "l" + index, value: count, cap: String(count), exact: String(count), axis: longDay(index), period: longDay(index) }));
  const weeks: BarChartBucket[] = [[0, 2000000, "2 M"], [4, 4400000, "4,4 M"], [11, 4200000, "4,2 M"], [18, 3800000, "3,8 M"]].map(([start, value, cap], index) => ({
    key: "w" + index, value: value as number, cap: es ? cap as string : (cap as string).replace(",", "."),
    exact: formatNumber(value as number, es ? "es" : "en"), axis: day(start as number), period: `${day(start as number)} – ${day(Math.min(30, (start as number) + 6))}`,
  }));
  const text = es
    ? { stats: "Números · StatCard", count: "Respuestas", total: "Total de Monto (pesos)", average: "Promedio de Monto (pesos)", range: "Mínimo y máximo de Monto (pesos)",
      change: "+18 % que 01/09/2026 – 30/09/2026", totalChange: "+21 % que 01/09/2026 – 30/09/2026", overflow: "Demasiado grande para calcularlo.",
      bars: "Cuántas llegaron, por día", long: "Cuántas llegaron, por día · 400 días", weekly: "Total de Monto (pesos), por semana · como tabla", banks: "Por banco o billetera de origen", states: "Por estado",
      banksTable: "Por banco o billetera de origen · como tabla", empty: "Por día de Fecha de pago · sin respuestas", refreshing: "Mientras vuelve a leer",
      day: "Día", week: "Semana", quantity: "Cantidad", totalHeader: "Total de Monto (pesos)", option: "Opción", noAnswers: "Sin respuestas",
      others: "Otras 7 opciones", approved: "Aprobada", pending: "Por aprobar", rejected: "Rechazada", note: "Se ven los últimos 400 días." }
    : { stats: "Numbers · StatCard", count: "Responses", total: "Total of Amount (pesos)", average: "Average of Amount (pesos)", range: "Minimum and maximum of Amount (pesos)",
      change: "+18% vs 09/01/2026 – 09/30/2026", totalChange: "+21% vs 09/01/2026 – 09/30/2026", overflow: "Too big to calculate.",
      bars: "How many arrived, by day", long: "How many arrived, by day · 400 days", weekly: "Total of Amount (pesos), by week · as a table", banks: "By bank or wallet of origin", states: "By state",
      banksTable: "By bank or wallet of origin · as a table", empty: "By day of Payment date · no responses", refreshing: "While it reads again",
      day: "Day", week: "Week", quantity: "Count", totalHeader: "Total of Amount (pesos)", option: "Option", noAnswers: "No responses",
      others: "7 other options", approved: "Approved", pending: "To approve", rejected: "Rejected", note: "Showing the last 400 days." };
  const percent = (value: number) => formatNumber(value, es ? "es" : "en", { style: "percent", maximumFractionDigits: 0 });
  const banks: BarListItem[] = [["Banco Galicia", 38], ["Banco Santander", 27], ["Banco Nación", 21], ["Mercado Pago", 17], ["Brubank", 11], ["Banco Macro", 9]]
    .map(([label, count]) => ({ key: label as string, label: label as string, value: count as number, valueLabel: String(count), share: percent(count as number / 123) }));
  const states: BarListItem[] = [{ key: "a", label: text.approved, value: 101, valueLabel: "101", share: percent(101 / 123), tone: "success" },
    { key: "p", label: text.pending, value: 14, valueLabel: "14", share: percent(14 / 123), tone: "warning" },
    { key: "r", label: text.rejected, value: 8, valueLabel: "8", share: percent(8 / 123), tone: "danger" }];
  const clients: BarListItem[] = [...banks.slice(0, 3), { key: "others", label: text.others, value: 42, valueLabel: "42", share: percent(42 / 123), tone: "muted" }];
  return <div className="@container flex flex-col gap-5">
    <section aria-label={text.stats} className="grid grid-cols-1 gap-3 @min-[30rem]:grid-cols-2 @min-[60rem]:grid-cols-4">
      <StatCard label={text.count} value="123" detail={text.change} />
      <StatCard label={text.total} value={es ? "14.381.300" : "14,381,300"} detail={text.totalChange} />
      <StatCard label={text.average} value="—" detail={text.overflow} />
      <StatCard label={text.range} loading />
    </section>
    <Surface title={text.bars}><BarChart label={text.bars} buckets={days} periodHeader={text.day} valueHeader={text.quantity} empty={text.noAnswers} note={text.note} /></Surface>
    <Surface title={text.long}><BarChart label={text.long} buckets={longDays} periodHeader={text.day} valueHeader={text.quantity} empty={text.noAnswers} note={text.note} /></Surface>
    <div className="grid grid-cols-1 gap-4 @min-[44rem]:grid-cols-2">
      <Surface title={text.banks}><BarList label={text.banks} items={banks} labelHeader={text.option} valueHeader={text.quantity} shareHeader="%" empty={text.noAnswers} /></Surface>
      <Surface title={text.states}><BarList label={text.states} items={states} labelHeader={text.option} valueHeader={text.quantity} shareHeader="%" empty={text.noAnswers} /></Surface>
      <Surface title={text.weekly}><BarChart asTable label={text.weekly} buckets={weeks} periodHeader={text.week} valueHeader={text.totalHeader} empty={text.noAnswers} /></Surface>
      <Surface title={text.banksTable}><BarList asTable label={text.banksTable} items={clients} labelHeader={text.option} valueHeader={text.quantity} shareHeader="%" empty={text.noAnswers} /></Surface>
      <Surface title={text.empty}><BarChart label={text.empty} buckets={[]} periodHeader={text.day} valueHeader={text.quantity} empty={text.noAnswers} /></Surface>
      <section aria-label={text.refreshing}><ChartRefreshing active>
        <Surface title={text.refreshing}><BarChart label={text.refreshing} buckets={weeks} periodHeader={text.week} valueHeader={text.totalHeader} empty={text.noAnswers} /></Surface>
      </ChartRefreshing></section>
    </div>
  </div>;
}
