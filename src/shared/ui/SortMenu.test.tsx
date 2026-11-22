import type { ReactNode } from "react";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Column } from "./DataTable";
import { SortMenu } from "./SortMenu";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

vi.mock("@/auth/AuthProvider", () => ({ AppAuthProvider: ({ children }: { children: ReactNode }) => children }));

interface Row { id: string }

const columns: Column<Row>[] = [
  { id: "name", header: "Formulario", sortable: true, sortKind: "text", cell: () => null },
  { id: "responseCount", header: "Respuestas", sortable: true, sortKind: "number", numeric: true, cell: () => null },
  { id: "lastSubmittedAtUtc", header: "Recibida", sortable: true, sortKind: "date", cell: () => null },
  { id: "lastResponseState", header: "Estado", sortable: true, sortKind: "state", cell: () => null },
  { id: "verified", header: "Verificado", sortable: true, sortKind: "yesNo", cell: () => null },
  { id: "actions", header: "Acciones", sortable: false, cell: () => null },
];

/// Radix abre el menú con Enter desde su botón, como los demás tests de menús del repositorio.
async function open(name: string | RegExp) {
  const trigger = screen.getByRole("button", { name });
  act(() => trigger.focus());
  await userEvent.keyboard("{Enter}");
  return { trigger, menu: await screen.findByRole("menu") };
}

afterEach(() => vi.restoreAllMocks());

describe("SortMenu, «Ordenar por» (OT1-C)", () => {
  it("says «Ordenar por» without an order and offers only the columns that order, without directions yet", async () => {
    renderWithProviders(<SortMenu columns={columns} onSortChange={vi.fn()} />);

    const { trigger, menu } = await open("Ordenar por");
    expect(trigger).toHaveTextContent(/^Ordenar por$/);
    expect(within(menu).getAllByRole("menuitemradio").map(item => item.textContent)).toEqual(["Formulario", "Respuestas", "Recibida", "Estado", "Verificado"]);
    expect(within(menu).getAllByRole("menuitemradio").every(item => item.getAttribute("aria-checked") === "false")).toBe(true);
    expect(within(menu).queryByText("Orden")).not.toBeInTheDocument();
  });

  it.each([
    ["-lastSubmittedAtUtc", "Recibida, más reciente primero", ["De la más reciente a la más antigua", "De la más antigua a la más reciente"]],
    ["responseCount", "Respuestas, de menor a mayor", ["De mayor a menor", "De menor a mayor"]],
    ["name", "Formulario, de la A a la Z", ["De la A a la Z", "De la Z a la A"]],
    ["-lastResponseState", "Estado, circuito al revés", ["En el orden del circuito", "Al revés del circuito"]],
    ["-verified", "Verificado, «Sí» primero", ["Primero «Sí»", "Primero «No»"]],
  ])("says %s in words and names both directions by the datum, the useful one first", async (sort, text, directions) => {
    renderWithProviders(<SortMenu columns={columns} sort={sort} onSortChange={vi.fn()} />);

    const { trigger, menu } = await open("Ordenar por: " + text);
    expect(trigger).toHaveTextContent(new RegExp("^" + text + "$"));
    const order = within(menu).getByRole("group", { name: "Orden" });
    expect(within(order).getAllByRole("menuitemradio").map(item => item.textContent)).toEqual(directions);
    const column = within(menu).getByRole("group", { name: "Columna" });
    expect(within(column).getByRole("menuitemradio", { checked: true })).toHaveTextContent(text.split(",")[0]!);
  });

  it("applies each choice at once, another column in its useful direction, and stays open until Escape", async () => {
    const onSortChange = vi.fn();
    const view = renderWithProviders(<SortMenu columns={columns} sort="name" onSortChange={onSortChange} />);

    const { menu } = await open(/Formulario/);
    await userEvent.click(within(menu).getByRole("menuitemradio", { name: "Recibida" }));
    expect(onSortChange).toHaveBeenLastCalledWith("-lastSubmittedAtUtc");
    expect(screen.getByRole("menu")).toBeInTheDocument();

    view.rerender(<SortMenu columns={columns} sort="-lastSubmittedAtUtc" onSortChange={onSortChange} />);
    await userEvent.click(within(screen.getByRole("menu")).getByRole("menuitemradio", { name: "De la más antigua a la más reciente" }));
    expect(onSortChange).toHaveBeenLastCalledWith("lastSubmittedAtUtc");
    // Choosing what is already chosen changes nothing.
    await userEvent.click(within(screen.getByRole("menu")).getByRole("menuitemradio", { name: "Recibida" }));
    expect(onSortChange).toHaveBeenCalledTimes(2);

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("opens the list on the whole screen of a phone, with rows to touch and the × to close it", async () => {
    vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(width < 640px)", media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }) as MediaQueryList);
    const onSortChange = vi.fn();
    renderWithProviders(<SortMenu columns={columns} sort="-responseCount" onSortChange={onSortChange} />);

    const trigger = screen.getByRole("button", { name: "Ordenar por: Respuestas, de mayor a menor" });
    expect(trigger).toHaveClass("max-sm:w-full");
    await userEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Ordenar por" });
    const order = within(dialog).getByRole("radiogroup", { name: "Orden" });
    expect(within(order).getByRole("radio", { name: "De mayor a menor" })).toHaveAttribute("aria-checked", "true");
    expect(within(order).getByRole("radio", { name: "De menor a mayor" })).toHaveClass("min-h-11");
    await userEvent.click(within(dialog).getByRole("radio", { name: "Formulario" }));
    expect(onSortChange).toHaveBeenLastCalledWith("name");
    expect(screen.getByRole("dialog", { name: "Ordenar por" })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
