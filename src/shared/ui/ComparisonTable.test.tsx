import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComparisonTable } from "./ComparisonTable";

const columns = { identity: [{ key: "change", header: "Qué cambió" }], label: "Dato", before: "Guardado actualmente", after: "Mis cambios" };

describe("ComparisonTable", () => {
  it("names each datum once and puts both versions in their own column, under what changed", () => {
    render(<ComparisonTable columns={columns} groups={[{ key: "item", identity: ["Artículo"], lines: [
      { key: "category", label: "Rubro", before: "Agroquímicos", after: "Herbicidas" },
      { key: "presentation", label: "En WhatsApp", before: "Como en el catálogo", after: "Propio de esta pregunta" },
    ] }]} />);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Qué cambió", "Dato", "Guardado actualmente", "Mis cambios"]);
    const question = within(table).getByRole("rowheader", { name: "Artículo" });
    expect(question).toHaveAttribute("rowspan", "2");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map(row => within(row).getAllByRole("cell").map(cell => cell.textContent))).toEqual([["Agroquímicos", "Herbicidas"], ["Como en el catálogo", "Propio de esta pregunta"]]);
    expect(within(rows[1]!).getByRole("rowheader", { name: "En WhatsApp" })).toBeInTheDocument();
  });

  it("leaves out the data column when nothing changed in parts, and spans it when one change is a single value", () => {
    const { rerender } = render(<ComparisonTable columns={columns} groups={[{ key: "language", identity: ["Idioma predeterminado"], lines: [{ key: "value", before: "Español", after: "Inglés" }] }]} />);
    expect(screen.getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Qué cambió", "Guardado actualmente", "Mis cambios"]);
    rerender(<ComparisonTable columns={columns} groups={[
      { key: "amount", identity: ["Cantidad"], lines: [{ key: "required", label: "Obligatoria", before: "No", after: "Sí" }] },
      { key: "order", identity: ["Orden de preguntas"], lines: [{ key: "value", before: "Artículo, Cantidad", after: "Cantidad, Artículo" }] },
    ]} />);
    expect(screen.getAllByRole("columnheader")).toHaveLength(4);
    expect(screen.getByRole("rowheader", { name: "Orden de preguntas" })).toHaveAttribute("colspan", "2");
    expect(screen.getByRole("rowheader", { name: "Cantidad" })).not.toHaveAttribute("colspan");
  });

  it("keeps every identity column, a row number to the right, and the note under the last value of the second version", () => {
    render(<ComparisonTable columns={{ identity: [{ key: "row", header: "Fila", numeric: true }, { key: "code", header: "Código" }], label: "Columna", before: "Antes", after: "Después" }}
      groups={[{ key: "4", identity: ["4", "ART-0012"], mobileTitle: "ART-0012 · fila 4", note: "No se puede conservar.", lines: [
        { key: "category", label: "Rubro", before: "Herbicidas", after: "Agroquímicos" },
        { key: "unit", label: "Unidad", before: "Litros", after: "Kilos" },
      ] }]} />);
    const [row, code] = screen.getAllByRole("columnheader");
    expect(row).toHaveClass("text-right");
    expect(code).toHaveTextContent("Código");
    const number = screen.getByRole("rowheader", { name: /^4/ });
    expect(number).toHaveAttribute("rowspan", "2");
    expect(number).toHaveClass("text-right");
    expect(screen.getByRole("cell", { name: "ART-0012" })).toHaveAttribute("rowspan", "2");
    const rows = screen.getAllByRole("row");
    expect(within(rows.at(-1)!).getAllByRole("cell").at(-1)).toHaveTextContent("KilosNo se puede conservar.");
    expect(within(rows[1]!).getAllByRole("cell").at(-1)).toHaveTextContent(/^Agroquímicos$/);
  });

  it("groups the lines of each change in a row group, so a reader hears what changed before every value", () => {
    render(<ComparisonTable columns={columns} groups={[
      { key: "a", identity: ["Cantidad"], lines: [{ key: "required", label: "Obligatoria", before: "No", after: "Sí" }] },
      { key: "b", identity: ["Foto del remito"], lines: [{ key: "max", label: "Máximo", before: "3", after: "5" }] },
    ]} />);
    const groups = screen.getAllByRole("rowgroup").slice(1);
    expect(groups).toHaveLength(2);
    expect(within(groups[1]!).getByRole("rowheader", { name: "Foto del remito" })).toHaveAttribute("scope", "rowgroup");
    expect(within(groups[1]!).getByRole("rowheader", { name: "Máximo" })).toHaveAttribute("scope", "row");
  });
});
