import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./button";
import { EmptyState } from "./EmptyState";
import { Spinner } from "./Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

export interface Column<TRow> {
  /// Coincide con el nombre del campo ordenable del backend.
  id: string;
  header: string;
  cell: (row: TRow) => ReactNode;
  sortable?: boolean;
  align?: "left" | "right";
}

interface DataTableProps<TRow> {
  columns: Column<TRow>[];
  rows: readonly TRow[];
  rowKey: (row: TRow) => string;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  /// Orden actual, en el formato del backend: "campo" o "-campo".
  sort?: string;
  onSortChange?: (field: string) => void;
}

function ariaSort(columnId: string, sort: string | undefined): "ascending" | "descending" | "none" {
  if (sort === columnId) {
    return "ascending";
  }

  return sort === `-${columnId}` ? "descending" : "none";
}

/// Listado con encabezados ordenables y estados de carga, error y vacío (sección 7.4).
export function DataTable<TRow>({
  columns,
  rows,
  rowKey,
  isLoading,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  sort,
  onSortChange,
}: DataTableProps<TRow>) {
  const { t } = useTranslation();

  if (error) {
    return (
      <EmptyState
        title={error}
        action={
          onRetry ? (
            <Button type="button" variant="outline" onClick={onRetry}>
              {t("actions.retry")}
            </Button>
          ) : undefined
        }
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-10">
        <Spinner />
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle ?? t("states.empty")} description={emptyDescription} />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.id} scope="col" aria-sort={ariaSort(column.id, sort)} className={column.align === "right" ? "text-right" : undefined}>
              {column.sortable && onSortChange ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => onSortChange(column.id)}>
                  {column.header}
                </Button>
              ) : (
                column.header
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={rowKey(row)}>
            {columns.map((column) => (
              <TableCell key={column.id} className={column.align === "right" ? "text-right" : undefined}>
                {column.cell(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
