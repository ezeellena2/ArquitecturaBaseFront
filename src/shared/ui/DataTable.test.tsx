import type { ReactNode } from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataTable, type Column } from "./DataTable";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

vi.mock("@/auth/AuthProvider", () => ({ AppAuthProvider: ({ children }: { children: ReactNode }) => children }));

interface Row {
  id: string;
  email: string;
}

const columns: Column<Row>[] = [
  { id: "email", header: "Email", cell: (row) => row.email, sortable: true },
];

const rows: Row[] = [
  { id: "1", email: "ana@example.com" },
  { id: "2", email: "beto@example.com" },
];

describe("DataTable", () => {
  it("keeps the last rows visible after a refresh fails", () => {
    renderWithProviders(<DataTable columns={columns} rows={rows} rowKey={(row) => row.id} error="Refresh failed" />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Refresh failed" })).not.toBeInTheDocument();
  });

  it("preserves a successfully loaded empty list when refreshing fails", () => {
    renderWithProviders(<DataTable columns={columns} rows={[]} hasData rowKey={(row) => row.id} error="Refresh failed" emptyTitle="No users" />);

    expect(screen.getByRole("heading", { name: "No users" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Refresh failed" })).not.toBeInTheDocument();
  });

  it("renders the rows", () => {
    renderWithProviders(<DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />);

    expect(screen.getAllByRole("row")).toHaveLength(3); // encabezado + 2 filas
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
  });

  it("marks the selected identity after rows are reordered without changing row semantics", () => {
    const view = renderWithProviders(<DataTable columns={columns} rows={rows} rowKey={row => row.id} selectedRowKey="2" />);

    const selected = screen.getByRole("row", { name: "beto@example.com" });
    expect(selected).toHaveAttribute("data-state", "selected");
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(selected).not.toHaveAttribute("tabindex");
    expect(screen.getByRole("row", { name: "ana@example.com" })).toHaveAttribute("aria-selected", "false");
    view.rerender(<DataTable columns={columns} rows={[...rows].reverse()} rowKey={row => row.id} selectedRowKey="2" />);
    expect(screen.getByRole("row", { name: "beto@example.com" })).toHaveAttribute("data-state", "selected");
    expect(screen.getAllByRole("row", { selected: true })).toHaveLength(1);
  });

  it("keeps existing rows unselected and outside the tab order when no row options are supplied", () => {
    renderWithProviders(<DataTable columns={columns} rows={rows} rowKey={row => row.id} />);

    for (const row of screen.getAllByRole("row")) {
      expect(row).not.toHaveAttribute("aria-selected");
      expect(row).not.toHaveAttribute("data-state");
      expect(row).not.toHaveAttribute("tabindex");
    }
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens a row from nested plain cell content while its owner retains selection", async () => {
    const opened = vi.fn();
    const nestedColumns: Column<Row>[] = [{ ...columns[0], cell: row => <span><strong>{row.email}</strong></span> }];
    renderWithProviders(<DataTable columns={nestedColumns} rows={rows} rowKey={row => row.id} selectedRowKey="1" onRowClick={opened} />);

    await userEvent.click(screen.getByText("beto@example.com"));
    expect(opened).toHaveBeenCalledExactlyOnceWith(rows[1]);
    expect(screen.getByRole("row", { name: "ana@example.com" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("row", { name: "beto@example.com" })).toHaveAttribute("aria-selected", "false");
  });

  it.each([
    ["link", <a key="link" href="#record"><span>Open record</span></a>],
    ["button", <button key="button" type="button"><span>Open record</span></button>],
    ["input", <input key="input" aria-label="Select record" type="checkbox" />],
    ["select", <select key="select" aria-label="Record state"><option>Open</option></select>],
    ["textarea", <textarea key="textarea" aria-label="Record note" defaultValue="Keep this note" />],
    ["button role", <div key="button role" role="button" tabIndex={0}><span>Open record</span></div>],
    ["checkbox role", <div key="checkbox role" role="checkbox" aria-checked="false" tabIndex={0}><span>Select record</span></div>],
    ["combobox role", <div key="combobox role" role="combobox" aria-expanded="false" tabIndex={0}><span>Record state</span></div>],
    ["menuitem role", <div key="menuitem role" role="menuitem" tabIndex={0}><span>Record action</span></div>],
    ["editable content", <div key="editable content" contentEditable suppressContentEditableWarning><span>Record note</span></div>],
  ])("does not open the row when its %s cell control is clicked", async (_name, control) => {
    const opened = vi.fn();
    const interactiveColumns: Column<Row>[] = [columns[0], { id: "control", header: "Control", cell: () => control }];
    renderWithProviders(<DataTable columns={interactiveColumns} rows={rows.slice(0, 1)} rowKey={row => row.id} onRowClick={opened} />);
    const cell = within(screen.getByRole("row", { name: /ana@example.com/ })).getAllByRole("cell")[1];
    const element = cell.firstElementChild!;

    await userEvent.click(element.querySelector("span") ?? element);
    expect(opened).not.toHaveBeenCalled();
  });

  it.each([["link", "{Enter}"], ["button", "{Enter}"], ["button", " "]] as const)("preserves %s keyboard activation with %s without opening its row", async (control, key) => {
    const user = userEvent.setup();
    const activated = vi.fn();
    const opened = vi.fn();
    const interactiveColumns: Column<Row>[] = [{ id: "number", header: "Number", cell: () => control === "link" ? <a href="#record" onClick={activated}>Open record</a> : <button type="button" onClick={activated}>Open record</button> }];
    renderWithProviders(<DataTable columns={interactiveColumns} rows={rows.slice(0, 1)} rowKey={row => row.id} onRowClick={opened} />);

    await user.tab();
    expect(screen.getByRole(control, { name: "Open record" })).toHaveFocus();
    await user.keyboard(key);
    expect(activated).toHaveBeenCalledOnce();
    expect(opened).not.toHaveBeenCalled();
    expect(screen.getByRole("row", { name: "Open record" })).not.toHaveAttribute("tabindex");
  });

  it("leaves an already prevented plain cell click with its original owner", async () => {
    const opened = vi.fn();
    const preventedColumns: Column<Row>[] = [{ ...columns[0], cell: row => <span onClick={event => event.preventDefault()}>{row.email}</span> }];
    renderWithProviders(<DataTable columns={preventedColumns} rows={rows} rowKey={row => row.id} onRowClick={opened} />);

    await userEvent.click(screen.getByText("ana@example.com"));
    expect(opened).not.toHaveBeenCalled();
  });

  it.each([
    { name: "Control", ctrlKey: true },
    { name: "Meta", metaKey: true },
    { name: "Shift", shiftKey: true },
    { name: "Alt", altKey: true },
    { name: "middle button", button: 1 },
    { name: "secondary button", button: 2 },
  ])("does not open a row for a click using $name", modifier => {
    const opened = vi.fn();
    renderWithProviders(<DataTable columns={columns} rows={rows} rowKey={row => row.id} onRowClick={opened} />);

    fireEvent.click(screen.getByRole("cell", { name: "ana@example.com" }), modifier);
    expect(opened).not.toHaveBeenCalled();
  });

  it("asks to sort by a sortable column", async () => {
    const onSortChange = vi.fn();
    renderWithProviders(
      <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} sort="email" onSortChange={onSortChange} />,
    );

    const header = screen.getByRole("columnheader", { name: /email/i });
    expect(header).toHaveAttribute("aria-sort", "ascending");

    await userEvent.click(screen.getByRole("button", { name: /email/i }));
    expect(onSortChange).toHaveBeenCalledWith("email");
  });

  it("shows the loading state", () => {
    renderWithProviders(<DataTable columns={columns} rows={[]} rowKey={(row) => row.id} isLoading />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows the empty state", () => {
    renderWithProviders(<DataTable columns={columns} rows={[]} rowKey={(row) => row.id} emptyTitle="No hay usuarios" />);

    expect(screen.getByRole("heading", { name: "No hay usuarios" })).toBeInTheDocument();
  });

  it("shows the error state with a retry action", async () => {
    const onRetry = vi.fn();
    renderWithProviders(<DataTable columns={columns} rows={[]} rowKey={(row) => row.id} error="Algo salió mal" onRetry={onRetry} />);

    await userEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
