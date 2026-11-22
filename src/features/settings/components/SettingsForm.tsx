import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { RegistrationMode, SettingField, SettingsDraft } from "../api/settings";
import { FormField } from "@/shared/ui/FormField";
import { Picker } from "@/shared/ui/Picker";
import { Surface } from "@/shared/ui/Surface";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { timeZoneOptions } from "@/shared/lib/timeZones";

export type SettingsFieldErrors = Partial<Record<SettingField, string>>;

interface Props {
  draft: SettingsDraft;
  errors: SettingsFieldErrors;
  disabled: boolean;
  onChange: (changes: Partial<SettingsDraft>) => void;
}

const languages: readonly SettingsDraft["defaultCulture"][] = ["es", "en"];
const pageSizes = [10, 20, 50, 100];

export function SettingsForm({ draft, errors, disabled, onChange }: Props) {
  const { t, i18n } = useTranslation("settings");
  // The only list of time zones (DS1-A), keeping the saved one and the defaults the browser may not list: the backend keeps
  // «America/Argentina/Buenos_Aires», which the browser calls «America/Buenos_Aires», and «UTC».
  const zones = useMemo(() => timeZoneOptions(i18n.language, [draft.defaultTimeZoneId, "America/Argentina/Buenos_Aires", "UTC"]),
    [i18n.language, draft.defaultTimeZoneId]);
  // Sin leyendas: lo que hace falta aclarar va en la (i) del título o de la etiqueta. El efecto de cada registro lo
  // explica la confirmación al guardar. Las opciones fijas, el idioma, las filas y el registro, van en la pieza para
  // elegir como cualquier lista (DS1-A, 2026-11-22), del ancho que tenían sus desplegables.
  return <>
    <Surface title={t("sections.regional")} help={t("hints.regional")} padded>
      <div className="flex flex-wrap gap-4">
        <div className="w-full sm:w-72"><FormField label={t("fields.defaultCulture")} error={errors.defaultCulture}>
          <Picker label={t("fields.defaultCulture")} disabled={disabled} value={draft.defaultCulture}
            options={languages.map(language => ({ id: language, label: t(`common:language.${language}`) }))}
            onChange={language => { if (language !== draft.defaultCulture) onChange({ defaultCulture: language as SettingsDraft["defaultCulture"] }); }}/>
        </FormField></div>
        <div className="w-full sm:w-96"><FormField label={t("fields.defaultTimeZoneId")} error={errors.defaultTimeZoneId}>
          <Picker label={t("fields.defaultTimeZoneId")} options={zones} value={draft.defaultTimeZoneId} disabled={disabled} onChange={defaultTimeZoneId => onChange({ defaultTimeZoneId })}/>
        </FormField></div>
      </div>
      <div className="space-y-1">
        <p className="text-sm text-[var(--color-content-muted)]">{t("preview.label")}</p>
        <p className="text-sm font-medium">{formatDateTimeInZone("2026-10-01T15:30:00Z", draft.defaultCulture, draft.defaultTimeZoneId)}</p>
      </div>
    </Surface>
    <Surface title={t("sections.lists")} padded>
      <div className="w-full sm:w-72"><FormField label={t("fields.defaultPageSize")} help={t("hints.listados")} error={errors.defaultPageSize}>
        <Picker label={t("fields.defaultPageSize")} disabled={disabled} value={String(draft.defaultPageSize)}
          options={pageSizes.map(size => ({ id: String(size), label: String(size) }))}
          onChange={size => { if (Number(size) !== draft.defaultPageSize) onChange({ defaultPageSize: Number(size) as SettingsDraft["defaultPageSize"] }); }}/>
      </FormField></div>
    </Surface>
    <Surface title={t("sections.registration")} padded>
      <div className="w-full sm:w-96"><FormField label={t("registration.title")} error={errors.registrationMode}>
        <Picker label={t("registration.title")} disabled={disabled} value={draft.registrationMode}
          options={[{ id: "InviteOnly", label: t("registration.InviteOnlyLabel") }, { id: "Open", label: t("registration.OpenLabel") }]}
          onChange={value => { if (value !== draft.registrationMode) onChange({ registrationMode: value as RegistrationMode }); }}/>
      </FormField></div>
    </Surface>
  </>;
}
