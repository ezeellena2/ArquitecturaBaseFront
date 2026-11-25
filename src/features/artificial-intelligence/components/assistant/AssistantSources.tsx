import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { AssistantProposalCard } from "@/shared/ui/assistant/AssistantProposalCard";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { DataList } from "@/shared/ui/DataList";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { sourceDestination } from "../../assistant/model";
import type { AssistantEvidence } from "../../api/assistant";

/**
 * The verified sources of an answer, each in the card of a proposal (TC4-A, 2026-11-25): «Abrir fuente» in its band when this
 * person can open it, the source by its name, its data in two columns (LR1) or, several rows with the same data, in a table,
 * and when it was read in its foot. A partial result says so in the band.
 */
export function AssistantSources({
  evidences,
  permissions,
  timeZone,
}: {
  evidences: readonly AssistantEvidence[];
  permissions: readonly string[];
  timeZone: string;
}) {
  const { t, i18n } = useTranslation("assistant");
  if (!evidences.length) return null;
  return (
    <div className="flex min-w-0 flex-col">
      {evidences.map((evidence) => {
        const name = t(`sourceNames.${evidence.sourceId}`, { defaultValue: evidence.sourceId });
        const destination = sourceDestination(evidence.destination, permissions);
        const partial = !evidence.isComplete;
        return (
          <AssistantProposalCard
            key={evidence.id}
            kind={t("verifiedSource")}
            title={name}
            footer={t("observedAt", { date: formatDateTimeInZone(evidence.observedAtUtc, i18n.language, timeZone) })}
            actions={partial || destination ? <>
              {partial ? <Badge variant="warning">{t("partial")}</Badge> : null}
              {destination ? <Button asChild size="sm" variant="outline"><Link to={destination}>{t("openSource")}</Link></Button> : null}
            </> : undefined}
          >
            <SourceRows rows={evidence.rows} label={name} />
          </AssistantProposalCard>
        );
      })}
    </div>
  );
}

type SourceRow = AssistantEvidence["rows"][number];
// A number as the server formats it for the person's region («3», «1.250», «1,250.5»): its column goes to the right.
const numericValue = (value: string) => /^[-+]?\d[\d.,   ]*$/.test(value.trim());

// Several rows that bring the same data, in the same order, read in a table with one row each; one row, or rows that bring
// different data, read in two columns.
function SourceRows({ rows, label }: { rows: readonly SourceRow[]; label: string }) {
  const labels = rows[0]?.values.map((value) => value.label) ?? [];
  const sameData = rows.length > 1 && rows.every((row) => row.values.length === labels.length
    && row.values.every((value, index) => value.label === labels[index]));
  if (!sameData)
    return rows.map((row, index) => (
      <DataList key={row.id ?? index} items={row.values.map((value) => ({ label: value.label, value: value.value }))} />
    ));
  const numeric = labels.map((_, column) => rows.every((row) => numericValue(row.values[column].value)));
  return (
    <div className="assistant-proposal-table">
      <Table scrollLabel={label}>
        <TableHeader>
          <TableRow>{labels.map((name, column) => <TableHead key={column} numeric={numeric[column]}>{name}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.id ?? index}>
              {row.values.map((value, column) => <TableCell key={column} numeric={numeric[column]}>{value.value}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
