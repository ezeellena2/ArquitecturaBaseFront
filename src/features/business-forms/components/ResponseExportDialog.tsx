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
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { InfoTip } from "@/shared/ui/InfoTip";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import type { ResponseCatalogFieldSelection, ResponseColumn, ResponseQuery } from "../responses";
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
  const { t } = useTranslation("forms");
  const [selection, setSelection] = useState("all");
  const [pending, setPending] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const columnsGroup = useRef<HTMLDivElement | null>(null);
  const feedbackId = `responses:export:${formId}`;
  const restore = useRestoreFocusOnClose();
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
        <p>
          {t("responses.count", { count: total })}
        </p>
        <p>{t("responses.appliedFilters", { count: filterLabels.length })}</p>
        {filterLabels.length ? <ul className="list-disc pl-5 text-sm">{filterLabels.map(label => <li key={label}>{label}</li>)}</ul> : null}
        {/* What always goes in the file is in the (i) next to the group's name, not in a line under the options. */}
        <div ref={columnsGroup} className="flex flex-col gap-1.5">
        <p className="flex items-center gap-1 text-sm font-medium">{t("responses.exportColumns")}<span className="-my-1 inline-flex"><InfoTip label={t("common:actions.moreInfo", { label: t("responses.exportColumns") })} text={t("responses.exportHint")}/></span></p>
        <RadioGroupField
          label={t("responses.exportColumns")}
          value={selection}
          onValueChange={setSelection}
          options={[
            {
              value: "all",
              label: t("responses.allColumns", { count: columns.reduce((count, column) => count + 1 + (column.fields?.length ?? 0), 0) }),
            },
            {
              value: "visible",
              label: t("responses.visibleColumns", { count: visible.length + visibleCatalogFields.length }),
            },
          ]}
        />
        </div>
        <p className="break-words text-sm">
          {prefix}-{new Date().toISOString().slice(0, 10).replaceAll("-", "")}
          .xlsx
        </p>
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
