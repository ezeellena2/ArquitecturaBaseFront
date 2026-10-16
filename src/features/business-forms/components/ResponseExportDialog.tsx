import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/shared/api/httpClient";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { savePrivateBlob } from "@/shared/hooks/usePrivateFormFile";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/ui/dialog";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { Button } from "@/shared/ui/button";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import type { ResponseColumn, ResponseQuery } from "../responses";
export function ResponseExportDialog({
  formId,
  prefix,
  filter,
  total,
  columns,
  visible,
  onClose,
  onForbidden,
  filterLabels,
}: {
  formId: string;
  prefix: string;
  filter: ResponseQuery;
  total: number;
  columns: readonly ResponseColumn[];
  visible: readonly ResponseColumn[];
  onClose: () => void;
  onForbidden: () => void;
  filterLabels: readonly string[];
}) {
  const { t } = useTranslation("forms");
  const [selection, setSelection] = useState("all");
  const [pending, setPending] = useState(false);
  const cooldown = useCountdown(0);
  const controller = useRef<AbortController | null>(null);
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
      <DialogContent onCloseAutoFocus={restore}>
        <DialogHeader>
          <DialogTitle>{t("responses.exportTitle")}</DialogTitle>
          <DialogDescription>
            {t("responses.exportDescription")}
          </DialogDescription>
        </DialogHeader>
        <p>
          {t("responses.count", { count: total })}
        </p>
        <p>{t("responses.appliedFilters", { count: filterLabels.length })}</p>
        {filterLabels.length ? <ul className="list-disc pl-5 text-sm">{filterLabels.map(label => <li key={label}>{label}</li>)}</ul> : null}
        <RadioGroupField
          label={t("responses.exportColumns")}
          value={selection}
          onValueChange={setSelection}
          options={[
            {
              value: "all",
              label: t("responses.allColumns", { count: columns.length }),
            },
            {
              value: "visible",
              label: t("responses.visibleColumns", { count: visible.length }),
            },
          ]}
        />
        <p className="text-sm text-[var(--color-content-muted)]">
          {t("responses.exportHint")}
        </p>
        <p className="break-words text-sm">
          {prefix}-{new Date().toISOString().slice(0, 10).replaceAll("-", "")}
          .xlsx
        </p>
        {total > 10000 ? <p>{t("responses.exportLimit")}</p> : null}
        {cooldown.seconds > 0 ? (
          <p>{t("responses.wait", { count: cooldown.seconds })}</p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            type="button"
            disabled={pending || total > 10000 || cooldown.seconds > 0}
            onClick={() => {
              void download();
            }}
          >
            {t(pending ? "responses.exporting" : "responses.export")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
