import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { BarChart, type BarChartBucket } from "./BarChart";
import { BarList, type BarListItem } from "./BarList";
import { ChartRefreshing } from "./ChartRefreshing";
import { StatCard } from "./StatCard";

// DOC7-A: the pieces of a chart; their owner formats every value and date and names them.
const buckets: BarChartBucket[] = [
  { key: "2026-10-01", value: 7, cap: "7", exact: "7", axis: "01/10/2026", period: "01/10/2026" },
  { key: "2026-10-02", value: 0, cap: "0", exact: "0", axis: "02/10/2026", period: "02/10/2026" },
  { key: "2026-10-03", value: null, cap: "—", exact: "—", axis: "03/10/2026", period: "03/10/2026" },
  { key: "2026-10-04", value: 10, cap: "10", exact: "10", axis: "04/10/2026", period: "04/10/2026" },
];
const items: BarListItem[] = [
  { key: "galicia", label: "Banco Galicia", value: 38, valueLabel: "38", share: "31%" },
  { key: "others", label: "Otras 7 opciones", value: 9, valueLabel: "9", share: "7%", tone: "muted" },
];

describe("StatCard", () => {
  it("says what the number is, the number and its change, in that order", () => {
    renderWithProviders(<StatCard label="Respuestas" value="123" detail="+18% que 01/09/2026 – 30/09/2026" />);
    expect(screen.getByText("Respuestas").nextElementSibling).toHaveTextContent("123");
    expect(screen.getByText("+18% que 01/09/2026 – 30/09/2026")).toBeVisible();
  });

  it("keeps its place without any text while the number arrives", () => {
    const { container } = renderWithProviders(<StatCard label="Respuestas" loading />);
    expect(container).not.toHaveTextContent("Respuestas");
    expect(container.querySelectorAll("[data-slot=skeleton]")).toHaveLength(3);
  });
});

describe("BarChart", () => {
  it("lists every bucket with its period and its value for a screen reader, a quiet one in the soft tone and an unknown one without a bar", () => {
    renderWithProviders(<BarChart label="Cuántas llegaron, por día" buckets={buckets} periodHeader="Día" valueHeader="Cantidad" empty="Sin respuestas" />);
    const list = screen.getByRole("list", { name: "Cuántas llegaron, por día" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map(row => row.querySelector(".sr-only")?.textContent)).toEqual(["01/10/2026: 7", "02/10/2026: 0", "03/10/2026: —", "04/10/2026: 10"]);
    expect(rows[1]!.querySelector("[data-quiet]")).not.toBeNull();
    expect(rows[0]!.querySelector("[data-quiet]")).toBeNull();
    // The unknown value has no bar: only its description, its cap «—» and its readout.
    expect(rows[2]!.querySelectorAll("span")).toHaveLength(3);
    // The highest bar takes the whole plot and the others go against it.
    expect(rows[3]!.querySelector<HTMLElement>("[aria-hidden][style]")?.style.height).toBe("100%");
    expect(rows[0]!.querySelector<HTMLElement>("[aria-hidden][style]")?.style.height).toBe("70%");
  });

  it("narrows the space between bars as the buckets grow, so four hundred still fit the plot", () => {
    const many = Array.from({ length: 400 }, (_, index) => ({ ...buckets[0]!, key: "b" + index }));
    const { rerender } = renderWithProviders(<BarChart label="Cuántas llegaron, por día" buckets={buckets} periodHeader="Día" valueHeader="Cantidad" empty="Sin respuestas" />);
    expect(screen.getByRole("list").style.columnGap).toBe("min(0.125rem, 6.25%)");
    rerender(<BarChart label="Cuántas llegaron, por día" buckets={many} periodHeader="Día" valueHeader="Cantidad" empty="Sin respuestas" />);
    expect(screen.getByRole("list").style.columnGap).toBe("min(0.125rem, 0.0625%)");
  });

  it("writes a negative value at the baseline, without the soft tone of a bucket without responses", () => {
    renderWithProviders(<BarChart label="Total de Monto (pesos), por día" periodHeader="Día" valueHeader="Total" empty="Sin respuestas"
      buckets={[{ ...buckets[0]!, value: -1200, cap: "-1,2 k", exact: "-1.200" }, buckets[3]!]} />);
    const negative = within(screen.getByRole("list")).getAllByRole("listitem")[0]!;
    expect(negative.querySelector("[data-quiet]")).toBeNull();
    expect(within(negative).getByText("-1,2 k")).toBeInTheDocument();
  });

  it("shows the same numbers as a table, with the whole period of each bucket", () => {
    renderWithProviders(<BarChart asTable label="Cuántas llegaron, por semana" valueHeader="Cantidad" periodHeader="Semana" empty="Sin respuestas"
      buckets={[{ ...buckets[0]!, period: "28/09/2026 – 04/10/2026" }]} note="Se ven las últimas 400 semanas." />);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Semana", "Cantidad"]);
    expect(within(table).getByRole("cell", { name: "28/09/2026 – 04/10/2026" }).nextElementSibling).toHaveTextContent("7");
    expect(screen.getByText("Se ven las últimas 400 semanas.")).toBeVisible();
  });

  it("says when there is nothing to show", () => {
    renderWithProviders(<BarChart label="Por día de Fecha de pago" buckets={[]} periodHeader="Día" valueHeader="Cantidad" empty="Sin respuestas" />);
    expect(screen.getByText("Sin respuestas")).toBeVisible();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});

describe("BarList", () => {
  it("lists each option with its value and its share, the bar against the longest one", () => {
    renderWithProviders(<BarList label="Por banco" items={items} labelHeader="Opción" valueHeader="Cantidad" shareHeader="%" empty="Sin respuestas" />);
    const rows = within(screen.getByRole("list", { name: "Por banco" })).getAllByRole("listitem");
    expect(rows.map(row => row.textContent)).toEqual(["Banco Galicia38 · 31%", "Otras 7 opciones9 · 7%"]);
    expect(rows[1]!.querySelector<HTMLElement>("[style]")?.style.width).toBe(`${9 / 38 * 100}%`);
  });

  it("shows the same numbers as a table, one datum per column, without a share column when none has one", () => {
    const { rerender } = renderWithProviders(<BarList asTable label="Por banco" items={items} labelHeader="Opción" valueHeader="Cantidad" shareHeader="%" empty="Sin respuestas" />);
    expect(within(screen.getByRole("table")).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Opción", "Cantidad", "%"]);
    expect(screen.getByRole("cell", { name: "Banco Galicia" }).nextElementSibling).toHaveTextContent("38");
    rerender(<BarList asTable label="Quién cargó" items={items.map(({ share: _share, ...item }) => item)} labelHeader="Persona" valueHeader="Cantidad" shareHeader="%" empty="Sin respuestas" />);
    expect(within(screen.getByRole("table")).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Persona", "Cantidad"]);
  });
});

describe("ChartRefreshing", () => {
  it("keeps the charts in sight, dimmed and out of reach, while they read again", () => {
    const { rerender } = renderWithProviders(<ChartRefreshing active><button type="button">Agregar gráfico</button></ChartRefreshing>);
    expect(screen.getByText("Agregar gráfico").closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Agregar gráfico").parentElement).toHaveAttribute("inert");
    rerender(<ChartRefreshing active={false}><button type="button">Agregar gráfico</button></ChartRefreshing>);
    expect(screen.getByRole("button", { name: "Agregar gráfico" }).parentElement).not.toHaveAttribute("inert");
  });
});
