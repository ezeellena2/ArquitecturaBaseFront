import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { settingFields, type SettingField, type SettingsDraft, type SystemSettings } from "../api/settings";
import { Button } from "@/shared/ui/button";
import { Surface } from "@/shared/ui/Surface";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell, TableRowHeader } from "@/shared/ui/table";

export function SettingsReview({ current, draft, disabled, titleRef, onAccept }: {
  current: SystemSettings; draft: SettingsDraft; disabled: boolean; titleRef: Ref<HTMLHeadingElement>; onAccept: (keepDraft: boolean) => void;
}) {
  const { t } = useTranslation("settings");
  const display = (field: SettingField, value: string | number) => field === "defaultCulture"
    ? t(`common:language.${value}`) : field === "registrationMode" ? t(`registration.${value}Label`) : String(value).replaceAll("_", " ");
  // Las elecciones resuelven toda la comparación: van al borde derecho de su banda, a la altura del título.
  return <Surface title={t("review.title")} titleRef={titleRef} padded actions={<>
    <Button variant="outline" disabled={disabled} onClick={() => onAccept(false)}>{t("review.useCurrent")}</Button>
    <Button disabled={disabled} onClick={() => onAccept(true)}>{t("review.keepMine")}</Button>
  </>}>
    <Table>
      <TableHeader><TableRow><TableHead scope="col" className="whitespace-normal">{t("review.setting")}</TableHead><TableHead scope="col" className="whitespace-normal">{t("review.current")}</TableHead><TableHead scope="col" className="whitespace-normal">{t("review.mine")}</TableHead></TableRow></TableHeader>
      <TableBody>{settingFields.map(field => <TableRow key={field}>
        <TableRowHeader className="max-w-40 break-words whitespace-normal">{t(`fields.${field}`)}</TableRowHeader>
        <TableCell className="break-all whitespace-normal">{display(field, current[field])}</TableCell>
        <TableCell className="break-all whitespace-normal">{display(field, draft[field])}</TableCell>
      </TableRow>)}</TableBody>
    </Table>
  </Surface>;
}
