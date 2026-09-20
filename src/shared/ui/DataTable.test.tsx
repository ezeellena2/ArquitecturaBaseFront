import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataTable, type Column } from "./DataTable";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

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
  it("renders the rows", () => {
    renderWithProviders(<DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />);

    expect(screen.getAllByRole("row")).toHaveLength(3); // encabezado + 2 filas
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
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
