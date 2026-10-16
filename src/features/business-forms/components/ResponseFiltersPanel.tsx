import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { FormField } from "@/shared/ui/FormField";
import { calendarDateInZone } from "@/shared/lib/dateTime";
import {
  receivedDateBoundary,
  replaceResponseCondition,
  type ResponseColumn,
  type ResponseFilter,
  type ResponseQuery,
} from "../responses";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import {
  ResponseFacetControl,
  ResponsePresenceControl,
} from "./ResponseFacetControl";
export function ResponseFiltersPanel({
  formId,
  query,
  columns,
  zone,
  onApply,
  onClose,
  initialFieldId,
}: {
  initialFieldId?: string;
  formId: string;
  query: ResponseQuery;
  columns: readonly ResponseColumn[];
  zone: string;
  onApply: (filter: ResponseFilter, versions: readonly string[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("forms");
  const [draft, setDraft] = useState(query);
  const [expanded, setExpanded] = useState<string | null>(
    initialFieldId ?? null,
  );
  const restore = useRestoreFocusOnClose();
  const [from, setFrom] = useState(
    query.receivedFromUtc
      ? calendarDateInZone(query.receivedFromUtc, zone)
      : "",
  );
  const [to, setTo] = useState(
    query.receivedToUtc
      ? calendarDateInZone(
          new Date(Date.parse(query.receivedToUtc) - 1).toISOString(),
          zone,
        )
      : "",
  );
  const condition = (
    fieldId: string,
    operator: string,
    values: readonly string[] | null,
  ) =>
    setDraft((previous) => ({
      ...previous,
      conditions: replaceResponseCondition(
        previous.conditions ?? [],
        fieldId,
        operator,
        values,
      ),
    }));
  const value = (id: string, op: string) =>
    draft.conditions?.find(
      (condition) => condition.fieldId === id && condition.operator === op,
    )?.values?.[0] ?? "";
  const invalidNumber = columns.some(
    (column) =>
      column.type === "decimal" &&
      (draft.conditions ?? [])
        .filter((condition) => condition.fieldId === column.fieldId)
        .some((condition) =>
          condition.values?.some(
            (value) => !/^[-+]?\d+([.,]\d+)?$/.test(value),
          ),
        ),
  );
  const invalidRange = !!from && !!to && from > to;
  const apply = () => {
    const filter: ResponseFilter = {
      search: draft.search,
      actorIds: draft.actorIds,
      receivedFromUtc: receivedDateBoundary(from, zone),
      receivedToUtc: receivedDateBoundary(to, zone, true),
      conditions: draft.conditions?.map((item) => ({
        ...item,
        values:
          columns.find((column) => column.fieldId === item.fieldId)?.type ===
          "decimal"
            ? item.values?.map((value) => value.replace(",", "."))
            : item.values,
      })),
    };
    onApply(filter, draft.versionIds ?? []);
    onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent placement="right" onCloseAutoFocus={restore}>
        <DialogHeader>
          <DialogTitle>{t("responses.filters")}</DialogTitle>
          <DialogDescription>{t("responses.filterHint")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              label={t("responses.receivedFrom")}
              error={invalidRange ? t("responses.invalidRange") : undefined}
            >
              <Input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </FormField>
            <FormField label={t("responses.receivedTo")}>
              <Input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </FormField>
          </div>
          {[
            { id: "actor", label: t("responses.actor") },
            { id: "version", label: t("responses.version") },
          ].map((section) => (
            <div
              key={section.id}
              className="border-b border-[var(--color-border)] pb-3"
            >
              <Button
                type="button"
                variant="ghost"
                aria-expanded={expanded === section.id}
                onClick={() =>
                  setExpanded(expanded === section.id ? null : section.id)
                }
              >
                {section.label}
              </Button>
              {expanded === section.id ? (
                <ResponseFacetControl
                  formId={formId}
                  filter={draft}
                  dimension={section.id}
                  selected={
                    section.id === "actor"
                      ? (draft.actorIds ?? [])
                      : (draft.versionIds ?? [])
                  }
                  onChange={(ids) =>
                    setDraft((previous) => ({
                      ...previous,
                      [section.id === "actor" ? "actorIds" : "versionIds"]: ids,
                    }))
                  }
                />
              ) : null}
            </div>
          ))}
          {columns.map((column) => (
            <div
              key={column.fieldId}
              className="border-b border-[var(--color-border)] pb-3"
            >
              <Button
                type="button"
                variant="ghost"
                aria-expanded={expanded === column.fieldId}
                onClick={() =>
                  setExpanded(
                    expanded === column.fieldId ? null : column.fieldId,
                  )
                }
              >
                {column.label}
              </Button>
              {expanded === column.fieldId ? (
                <div className="flex flex-col gap-3">
                  <FormField label={t("responses.answerState")}>
                    <ResponsePresenceControl
                      formId={formId}
                      filter={draft}
                      fieldId={column.fieldId}
                      value={
                        (draft.conditions ?? []).find(
                          (item) =>
                            item.fieldId === column.fieldId &&
                            ["answered", "unanswered", "notAsked"].includes(
                              item.operator,
                            ),
                        )?.operator ?? "all"
                      }
                      onChange={(operator) => {
                        setDraft((previous) => ({
                          ...previous,
                          conditions: [
                            ...(previous.conditions ?? []).filter(
                              (item) =>
                                item.fieldId !== column.fieldId ||
                                ![
                                  "answered",
                                  "unanswered",
                                  "notAsked",
                                ].includes(item.operator),
                            ),
                            ...(operator === "all"
                              ? []
                              : [
                                  {
                                    fieldId: column.fieldId,
                                    operator,
                                    values: null,
                                  },
                                ]),
                          ],
                        }));
                      }}
                    />
                  </FormField>
                  {column.type === "choice" || column.type === "boolean" ? (
                    <ResponseFacetControl
                      formId={formId}
                      filter={draft}
                      dimension="choice"
                      fieldId={column.fieldId}
                      searchable={column.type !== "boolean"}
                      selected={
                        draft.conditions?.find(
                          (condition) =>
                            condition.fieldId === column.fieldId &&
                            condition.operator === "in",
                        )?.values ?? []
                      }
                      onChange={(ids) => condition(column.fieldId, "in", ids)}
                    />
                  ) : column.type === "decimal" || column.type === "date" ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {["gte", "lte"].map((operator) => (
                        <FormField
                          key={operator}
                          label={t(
                            operator === "gte"
                              ? "responses.from"
                              : "responses.to",
                          )}
                          error={
                            column.type === "decimal" &&
                            value(column.fieldId, operator) &&
                            !/^[-+]?\d+([.,]\d+)?$/.test(
                              value(column.fieldId, operator),
                            )
                              ? t("responses.invalidNumber")
                              : undefined
                          }
                        >
                          <Input
                            type={column.type === "date" ? "date" : "text"}
                            inputMode={
                              column.type === "decimal" ? "decimal" : undefined
                            }
                            value={value(column.fieldId, operator)}
                            onChange={(event) =>
                              condition(
                                column.fieldId,
                                operator,
                                event.target.value ? [event.target.value] : [],
                              )
                            }
                          />
                        </FormField>
                      ))}
                    </div>
                  ) : column.type === "shortText" ||
                    column.type === "longText" ? (
                    <FormField label={t("responses.contains")}>
                      <Input
                        value={value(column.fieldId, "contains")}
                        maxLength={600}
                        onChange={(event) =>
                          condition(
                            column.fieldId,
                            "contains",
                            event.target.value ? [event.target.value] : [],
                          )
                        }
                      />
                    </FormField>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setDraft({
                ...query,
                search: undefined,
                actorIds: [],
                versionIds: [],
                conditions: [],
                receivedFromUtc: undefined,
                receivedToUtc: undefined,
              });
              setFrom("");
              setTo("");
            }}
          >
            {t("responses.clear")}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            type="button"
            disabled={invalidNumber || invalidRange}
            onClick={apply}
          >
            {t("responses.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
