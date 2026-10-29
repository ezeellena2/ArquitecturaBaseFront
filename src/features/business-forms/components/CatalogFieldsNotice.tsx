import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { AlertTriangleIcon, PlusIcon } from "@/shared/ui/icons";
import type { CatalogFieldFeedback } from "../api/catalogFieldFeedback";
import { catalogFieldHasErrors, type CatalogFieldDraft, type CatalogFieldErrors } from "../catalogFields";
import { administrativeName } from "../editorModel";
import type { FormCulture } from "../model";
import { localizedIssue, localizedIssueMessage } from "../validationPaths";

// The controls of a field in the order of the modal: the notice says their errors in that order.
const controlPaths: readonly string[] = ["name", "key", "type", "sourceCatalogId", "maxLength", "min", "max", "required", "unique", "role"];

// «Agregar campos» in the options header, next to «Agregar opción» (C, 2026-10-27): it opens the modal with every field. The
// count is of the active fields; it turns red while the server rejected one. Someone who can only read the fields sees
// «Campos», only when there are fields.
export function CatalogFieldsButton({ fields, errors, canManage, onOpen }: { fields: readonly CatalogFieldDraft[]; errors: CatalogFieldErrors; canManage: boolean; onOpen: () => void }) {
  const { t } = useTranslation("forms");
  const count = fields.filter(field => field.isActive).length;
  if (!canManage && !count) return null;
  const failing = fields.some(field => catalogFieldHasErrors(errors, field));
  return <Button type="button" variant="outline" aria-label={count ? t(canManage ? "catalogs.fields.addCountLabel" : "catalogs.fields.countLabel", { count }) : undefined} onClick={onOpen}>
    {canManage ? <><PlusIcon className="size-4" />{t("catalogs.fields.addFields")}</> : t("catalogs.fields.title")}{count ? <Badge variant={failing ? "danger" : "secondary"}>{count}</Badge> : null}
  </Button>;
}

// Above the options table, what the server said about the fields when saving: a line per error of a field («Zona» · Clave: …),
// the errors of the whole list, its counts and, when it offered them, the rows to show in the table. «Revisar» opens the modal
// on the first field with an error.
export function CatalogFieldsNotice({ fields, errors, feedback, rootErrors = [], culture, errorRows, onReview }: { fields: readonly CatalogFieldDraft[]; errors: CatalogFieldErrors; feedback?: CatalogFieldFeedback | null; rootErrors?: readonly string[]; culture: FormCulture; errorRows?: { readonly count: number; readonly onShow: () => void }; onReview: (localId: string) => void }) {
  const { t } = useTranslation("forms");
  const labels: Readonly<Record<string, string>> = { name: t("name"), key: t("catalogs.fields.key"), type: t("catalogs.fields.type"), sourceCatalogId: t("catalogQuestion.catalog"), maxLength: t("maxLength"), min: t("catalogs.fields.min"), max: t("catalogs.fields.max"), required: t("catalogs.fields.requiredLabel"), unique: t("catalogs.fields.unique"), role: t("catalogs.fields.role") };
  const order = (path: string) => { const index = controlPaths.indexOf(path); return index < 0 ? controlPaths.length : index; };
  const lines = fields.flatMap(field => {
    const messages = errors[field.localId] ?? {};
    const name = administrativeName(field.name, culture) || t("catalogs.fields.new");
    // A removed field, or one whose restore failed, is said as a whole; the rest by control. The name may come in either language.
    const whole = field.isActive ? messages.isActive ?? [] : Object.values(messages).flat();
    if (!field.isActive) return whole.length ? [t("catalogs.fields.fieldProblem", { name, message: whole.join(" ") })] : [];
    const nameMessage = localizedIssueMessage(localizedIssue(messages, "name", culture), culture, t);
    const controls = Object.entries(messages).filter(([path, list]) => list.length && path !== "isActive" && path !== "name" && !path.startsWith("name.")).sort(([a], [b]) => order(a) - order(b));
    return [
      ...(whole.length ? [t("catalogs.fields.fieldProblem", { name, message: whole.join(" ") })] : []),
      ...(nameMessage ? [t("catalogs.fields.controlProblem", { name, field: labels.name, message: nameMessage })] : []),
      ...controls.map(([path, list]) => labels[path] ? t("catalogs.fields.controlProblem", { name, field: labels[path], message: list.join(" ") }) : t("catalogs.fields.fieldProblem", { name, message: list.join(" ") })),
    ];
  });
  const counts = [
    ...(feedback?.missingCount !== undefined ? [t("catalogs.fields.missingValues", { count: feedback.missingCount })] : []),
    ...(feedback?.invalidCount !== undefined ? [t(feedback.convertedCount !== undefined ? "catalogs.fields.invalidValues" : "catalogs.fields.incompatibleValues", { count: feedback.invalidCount })] : []),
    ...(feedback?.convertedCount !== undefined ? [t("catalogs.fields.convertedValues", { count: feedback.convertedCount })] : []),
  ];
  const texts = [...rootErrors, ...lines, ...counts];
  if (!texts.length) return null;
  const failed = fields.find(field => catalogFieldHasErrors(errors, field));
  return <div role="alert" className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] p-4">
    <div className="min-w-0 flex-1 space-y-1 text-sm text-[var(--color-danger)]">{texts.map((text, index) => <p key={index} className="flex items-start gap-1.5"><AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />{text}</p>)}</div>
    {failed || errorRows ? <div className="flex flex-wrap gap-2">
      {failed ? <Button type="button" variant="outline" onClick={() => onReview(failed.localId)}>{t("common:actions.review")}</Button> : null}
      {errorRows ? <Button type="button" variant="outline" onClick={errorRows.onShow}>{t("catalogs.fields.conversion.show", { count: errorRows.count })}</Button> : null}
    </div> : null}
  </div>;
}
