import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/shared/api/httpClient";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { savePrivateBlob } from "@/shared/hooks/usePrivateFormFile";
import type { useCountdown } from "@/shared/hooks/useCountdown";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import { formatExactDecimal } from "@/shared/lib/decimal";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { DataList } from "@/shared/ui/DataList";
import { FilterChip } from "@/shared/ui/FilterChip";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { InfoTip } from "@/shared/ui/InfoTip";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import type { ResponseCatalogFieldSelection, ResponseColumn, ResponseQuery } from "../responses";

/// The columns of the Excel (XL1-A): one per question with its catalog fields, and a block as «Ítem» and its questions.
const exportedColumns = (columns: readonly ResponseColumn[]) => columns.reduce((count, column) => count + (column.type === "group"
  ? 1 + (column.questions ?? []).reduce((inner, question) => inner + 1 + (question.fields?.length ?? 0), 0)
  : 1 + (column.fields?.length ?? 0)), 0);
export function ResponseExportDialog({
  formId,
  prefix,
  filter,
  total,
  ready,
  cooldown,
  columns,
  visible,
  visibleCatalogFields = [],
  onClose,
  onForbidden,
  filterLabels,
}: {
  formId: string;
  prefix: string;
  filter: ResponseQuery;
  total: number;
  ready: boolean;
  cooldown: ReturnType<typeof useCountdown>;
  columns: readonly ResponseColumn[];
  visible: readonly ResponseColumn[];
  visibleCatalogFields?: readonly ResponseCatalogFieldSelection[];
  onClose: () => void;
  onForbidden: () => void;
  filterLabels: readonly string[];
}) {
  const { t, i18n } = useTranslation("forms");
  const [selection, setSelection] = useState("all");
  const [includeVoided, setIncludeVoided] = useState(false);
  const [pending, setPending] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const columnsGroup = useRef<HTMLDivElement | null>(null);
  const feedbackId = `responses:export:${formId}`;
  const restore = useRestoreFocusOnClose();
  const count = formatExactDecimal(String(total), i18n.language) ?? String(total);
  const voided = includeVoided && !filter.state;
  const allColumns = exportedColumns(columns);
  const visibleColumns = visible.reduce((sum, column) => sum + (column.type === "group" ? 1 + (column.questions?.length ?? 0) : 1), 0) + visibleCatalogFields.length;
  const nothingHidden = visibleColumns === allColumns;
  // The block that goes in the file: with «Solo las visibles», only if its column is visible.
  const block = (selection === "visible" ? visible : columns).find(column => column.type === "group");
  useEffect(
    () => () => {
      controller.current?.abort();
      dismissNotification(feedbackId);
    },
    [feedbackId],
  );
  const download = async () => {
    if (!ready || pending || cooldown.isRunning) return;
    const current = new AbortController();
    controller.current = current;
    setPending(true);
    try {
      const result = await api.download(
        `/api/forms/definitions/${encodeURIComponent(formId)}/records/export`,
        {
          filter,
          columns:
            selection === "visible"
              ? visible.map((column) => column.fieldId)
              : null,
          catalogFields: selection === "visible" ? visibleCatalogFields : null,
          // The voided go only when asked (CW11-A); unchecked, the body stays as it always was.
          ...(includeVoided && !filter.state ? { includeVoided: true } : {}),
        },
        { signal: current.signal },
      );
      if (current.signal.aborted) return;
      savePrivateBlob(result.blob, result.fileName ?? `${prefix}.xlsx`);
      notify({
        id: `${feedbackId}:done`,
        kind: "success",
        message: t("responses.exported"),
      });
      onClose();
    } catch (error) {
      if (current.signal.aborted) return;
      if (error instanceof ApiError && error.status === 403) {
        onForbidden();
        return;
      }
      if (error instanceof ApiError && error.status === 429)
        cooldown.restart(error.retryAfterSeconds ?? 60);
      if (
        !["cancelled", "session", "forbidden"].includes(
          errorFeedback(error).kind,
        )
      )
        notify({
          id: feedbackId,
          kind: "error",
          message: readErrorMessage(error, t),
        });
    } finally {
      if (!current.signal.aborted) setPending(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {/* The dialog opens on the chosen option, as before the (i): focused first, its tooltip would cover the options. */}
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={restore} onOpenAutoFocus={event => {
        const chosen = columnsGroup.current?.querySelector<HTMLElement>('[role="radio"][data-state="checked"]');
        if (chosen) { event.preventDefault(); chosen.focus(); }
      }}>
        <DialogHeader>
          <DialogTitle>{t("responses.exportTitle")}</DialogTitle>
        </DialogHeader>
        {/* EX1-A: what goes out on top, in two columns; the choices; the file at the foot, next to the action. */}
        <DataList items={[
          { key: "responses", label: t("responses.exportResponses"), value: voided ? t("responses.exportVoidedToo", { responses: count }) : count },
          {
            key: "filters",
            label: t("responses.exportFilters"),
            // The same chips of the sheet, without their cross: the filters are not removed here.
            value: filterLabels.length
              ? <span className="flex flex-wrap gap-1.5">{filterLabels.map(label => <FilterChip key={label}>{label}</FilterChip>)}</span>
              : <span className="text-[var(--color-content-muted)]">{t("responses.exportNoFilters")}</span>,
          },
        ]} />
        <div ref={columnsGroup}>
          <RadioGroupField
            label={t("responses.exportColumns")}
            showLabel
            help={t("responses.exportHint")}
            value={selection}
            onValueChange={setSelection}
            options={[
              { value: "all", label: t("responses.allColumns", { count: allColumns }) },
              {
                value: "visible",
                label: t("responses.visibleColumns", { count: visibleColumns }),
                // Without hidden columns both options give the same file.
                disabled: nothingHidden,
                disabledReason: nothingHidden ? t("responses.exportAllVisible") : null,
              },
            ]}
          />
        </div>
        {/* Voided responses stay out of the file unless they are asked for (CW11-A); with a state chosen, the state says which go. */}
        {filter.state ? null : <CheckboxField label={t("responses.includeVoided")} help={t("responses.includeVoidedHelp")} checked={includeVoided} onCheckedChange={setIncludeVoided}/>}
        <DataList items={[
          { key: "file", label: t("responses.exportFile"), value: `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}.xlsx` },
          {
            key: "rows",
            // How the Excel comes out (XL1-A): a row per item of the exported block, or a row per response.
            label: block ? <span className="flex items-center gap-1">{t("responses.exportRows")}
              <span className="-my-1 inline-flex"><InfoTip label={t("common:actions.moreInfo", { label: t("responses.exportRows") })} text={t("responses.exportRowsHelp")} /></span>
            </span> : t("responses.exportRows"),
            value: block ? t("responses.exportRowsPerItem", { block: block.label }) : t("responses.exportRowsPerResponse"),
          },
        ]} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          {/* The limit and the wait are the reason of the disabled download, not a text above the footer. */}
          <DisabledReason
            reason={pending ? null : total > 10000 ? t("responses.exportLimit") : cooldown.seconds > 0 ? t("responses.wait", { count: cooldown.seconds }) : null}
            className="max-sm:*:flex-1"
          >
            <Button
              type="button"
              pending={pending}
              disabled={!ready || pending || total > 10000 || cooldown.seconds > 0}
              onClick={() => {
                void download();
              }}
            >
              {t(pending ? "responses.exporting" : "responses.export")}
            </Button>
          </DisabledReason>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
