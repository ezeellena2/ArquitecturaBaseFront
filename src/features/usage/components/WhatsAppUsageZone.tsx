import type { UseQueryResult } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { formatNumber } from "@/shared/lib/numberFormat";
import { Button } from "@/shared/ui/button";
import { DataList } from "@/shared/ui/DataList";
import { EmptyState } from "@/shared/ui/EmptyState";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { Surface } from "@/shared/ui/Surface";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow, TableRowHeader } from "@/shared/ui/table";
import { whatsAppUnavailableCode, type WhatsAppUsage } from "../api/usage";
import { amountText } from "../usageFormat";
import { categoryKey } from "../usageModel";
import { isForbidden, zoneLoading } from "../zoneState";
import { UsageTableSkeleton } from "./UsageTableSkeleton";

const unavailable = (error: unknown) => error instanceof ApiError && error.code === whatsAppUnavailableCode;

/**
 * The zone «WhatsApp» of Consumo (CO1-B): what Meta reports for the number of the installation (PR14), read when the screen opens,
 * with the delivered messages and their cost per kind and the row «Total». Meta not answering says so in the zone with
 * «Reintentar», and the notice below tells the cause; an installation without a number and a month without messages, too.
 */
export function WhatsAppUsageZone({ query, monthLabel }: { query: UseQueryResult<WhatsAppUsage>; monthLabel: string }) {
  const { t, i18n } = useTranslation("usage");
  const language = i18n.language;
  const usage = query.data;
  const noticeId = "usage:whatsapp";
  // The cause of a failure goes in one notice: what Meta answered, in the words of the server, or the common text.
  const error = query.error;
  useEffect(() => {
    if (!error) { dismissNotification(noticeId); return; }
    const kind = errorFeedback(error).kind;
    if (isForbidden(error) || kind === "session" || kind === "cancelled") return;
    notify({ id: noticeId, kind: "error", message: unavailable(error) && error instanceof ApiError && error.detail ? error.detail : readErrorMessage(error, t) });
  }, [error, t]);
  useEffect(() => () => dismissNotification(noticeId), []);
  const money = (value: number) => t("money", { currency: usage?.currency ?? "", amount: amountText(value, language) });
  const columns = [
    { key: "category", header: t("whatsapp.category") },
    { key: "delivered", header: t("whatsapp.delivered"), numeric: true },
    { key: "cost", header: t("whatsapp.cost"), numeric: true },
  ];

  let body: ReactNode;
  if (zoneLoading(query)) body = <UsageTableSkeleton columns={columns} />;
  else if (!usage) body = <EmptyState embedded title={t(unavailable(error) ? "whatsapp.unavailable" : "whatsapp.loadFailed")}
    action={<Button type="button" variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button>} />;
  else if (!usage.configured) body = <EmptyState embedded title={t("whatsapp.unconfigured")} />;
  else if (usage.categories.length === 0) body = <EmptyState embedded title={t("whatsapp.empty", { month: monthLabel })} />;
  else body = <>
    <DataList items={[{ key: "number", label: t("whatsapp.number"), value: usage.displayPhoneNumber ?? "—" }]} />
    <Surface>
      <Table aria-label={t("whatsapp.table", { month: monthLabel })} scrollLabel={t("whatsapp.table", { month: monthLabel })}>
        <TableHeader>
          <TableRow>{columns.map(column => <TableHead key={column.key} scope="col" numeric={column.numeric}>{column.header}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {usage.categories.map(item => {
            const key = categoryKey(item.category);
            return (
              <TableRow key={item.category}>
                <TableCell>{key ? t(`whatsapp.categories.${key}`) : item.category}</TableCell>
                <TableCell numeric>{formatNumber(item.delivered, language)}</TableCell>
                <TableCell numeric>{money(item.cost)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableRowHeader className="px-4 font-medium">{t("whatsapp.total")}</TableRowHeader>
            <TableCell numeric>{formatNumber(usage.totalDelivered, language)}</TableCell>
            <TableCell numeric>{money(usage.totalCost)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </Surface>
    <p className="text-xs text-[var(--color-content-muted)]">{t("whatsapp.note")}</p>
  </>;

  return <Surface title={t("whatsapp.title")} help={t("whatsapp.help")} padded>{body}</Surface>;
}
