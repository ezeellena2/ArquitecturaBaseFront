import type { UseQueryResult } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/shared/lib/numberFormat";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { PencilIcon } from "@/shared/ui/icons";
import { RowActions } from "@/shared/ui/RowActions";
import { Surface } from "@/shared/ui/Surface";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow, TableRowHeader } from "@/shared/ui/table";
import type { AiModelUsage, AiUsage } from "../api/usage";
import { amountText, minutesText } from "../usageFormat";
import { aiEstimatedCost, aiTotals } from "../usageModel";
import { zoneLoading } from "../zoneState";
import { AiPriceDialog } from "./AiPriceDialog";
import { UsageTableSkeleton } from "./UsageTableSkeleton";

/** A datum the provider did not report, or a model without a price: in grey. */
function Muted({ children }: { children: ReactNode }) {
  return <span className="text-[var(--color-content-muted)]">{children}</span>;
}

/**
 * The zone «Inteligencia artificial» of Consumo (CO1-B): a row per model of the month with its requests, tokens, audio and
 * estimated cost, the row «Total» and the note in grey; the pencil of a model opens its prices, with `ai.manage`. While the month
 * arrives, the table with its loading rows; a month without requests and a failure say so in the zone.
 */
export function AiUsageZone({ query, month, monthLabel, canManagePrices }: {
  query: UseQueryResult<AiUsage>;
  month: string;
  monthLabel: string;
  canManagePrices: boolean;
}) {
  const { t, i18n } = useTranslation("usage");
  const language = i18n.language;
  const [editing, setEditing] = useState<AiModelUsage>();
  const number = (value: number | null) => value === null ? <Muted>—</Muted> : formatNumber(value, language);
  const minutes = (seconds: number | null) => seconds === null ? <Muted>—</Muted> : t("ai.minutes", { value: minutesText(seconds, language) });
  const usd = (value: number) => t("usd", { amount: amountText(value, language) });
  const columns = [
    { key: "model", header: t("ai.model") },
    { key: "requests", header: t("ai.requests"), numeric: true },
    { key: "inputTokens", header: t("ai.inputTokens"), numeric: true },
    { key: "outputTokens", header: t("ai.outputTokens"), numeric: true },
    { key: "audio", header: t("ai.audio"), numeric: true },
    { key: "cost", header: t("ai.cost"), numeric: true },
  ];
  const usage = query.data;

  let body: ReactNode;
  if (zoneLoading(query)) body = <UsageTableSkeleton columns={columns} />;
  else if (!usage) body = <EmptyState embedded title={t("ai.loadFailed")}
    action={<Button type="button" variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button>} />;
  else if (usage.models.length === 0) body = <EmptyState embedded title={t("ai.empty", { month: monthLabel })} />;
  else {
    const totals = aiTotals(usage.models);
    const estimate = aiEstimatedCost(usage);
    const note = [
      ...usage.unpricedModels > 0 ? [t("ai.unpriced", { count: usage.unpricedModels })] : [],
      ...usage.unknownUsageRequests > 0 ? [t("ai.unknownUsage", { count: usage.unknownUsageRequests })] : [],
      t("ai.providerPanel"),
    ].join(" ");
    body = <>
      <Surface>
        <Table aria-label={t("ai.table", { month: monthLabel })}>
          <TableHeader>
            <TableRow>
              {columns.map(column => <TableHead key={column.key} scope="col" numeric={column.numeric}>{column.header}</TableHead>)}
              {canManagePrices ? <TableHead scope="col" className="w-px"><span className="sr-only">{t("ai.actions")}</span></TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {usage.models.map(model => (
              <TableRow key={`${model.provider}:${model.model}`}>
                <TableCell>{model.model}</TableCell>
                <TableCell numeric>{formatNumber(model.requests, language)}</TableCell>
                <TableCell numeric>{number(model.inputTokens)}</TableCell>
                <TableCell numeric>{number(model.outputTokens)}</TableCell>
                <TableCell numeric>{minutes(model.audioSeconds)}</TableCell>
                <TableCell numeric>{model.estimatedCostUsd === null ? <Muted>{t("ai.noPrice")}</Muted> : usd(model.estimatedCostUsd)}</TableCell>
                {canManagePrices ? (
                  <TableCell className="px-2 text-right">
                    <RowActions actions={[{ label: t("ai.prices"), accessibleName: t("ai.pricesOf", { model: model.model }), icon: PencilIcon, onSelect: () => setEditing(model) }]} />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableRowHeader className="px-4 font-medium">{t("ai.total")}</TableRowHeader>
              <TableCell numeric>{formatNumber(totals.requests, language)}</TableCell>
              <TableCell numeric>{number(totals.inputTokens)}</TableCell>
              <TableCell numeric>{number(totals.outputTokens)}</TableCell>
              <TableCell numeric>{minutes(totals.audioSeconds)}</TableCell>
              <TableCell numeric>{estimate === null ? <Muted>{t("ai.noPrice")}</Muted> : usd(estimate)}</TableCell>
              {canManagePrices ? <TableCell /> : null}
            </TableRow>
          </TableFooter>
        </Table>
      </Surface>
      <p className="text-xs text-[var(--color-content-muted)]">{note}</p>
    </>;
  }

  return (
    <Surface title={t("ai.title")} help={t("ai.help")} padded>
      {body}
      {editing ? <AiPriceDialog month={month} model={editing} onClose={() => setEditing(undefined)} /> : null}
    </Surface>
  );
}
