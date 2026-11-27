import { useTranslation } from "react-i18next";
import { Skeleton } from "@/shared/ui/skeleton";
import { Surface } from "@/shared/ui/Surface";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

/** A column of the table that is coming: its header and whether it holds numbers. */
export interface SkeletonColumn {
  key: string;
  header: string;
  numeric?: boolean;
}

/**
 * The table of a zone while its month arrives (board «Estados» · 1): the header of always and two rows with their loading
 * bars, so that the zone keeps its shape. Each zone loads on its own.
 */
export function UsageTableSkeleton({ columns }: { columns: readonly SkeletonColumn[] }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t("states.loading")}>
      <Surface>
        <Table role="presentation">
          <TableHeader>
            <TableRow>{columns.map(column => <TableHead key={column.key} numeric={column.numeric}>{column.header}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody striped={false}>
            {[0, 1].map(row => (
              <TableRow key={row} className="hover:bg-transparent">
                {columns.map((column, index) => (
                  <TableCell key={column.key} numeric={column.numeric}>
                    <Skeleton aria-hidden="true" className={index === 0 ? "h-3 w-32" : "h-3 w-16"} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Surface>
    </div>
  );
}
