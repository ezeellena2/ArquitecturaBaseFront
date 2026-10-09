import { useTranslation } from "react-i18next";
import type { RegistrationMode, SettingField, SettingsDraft } from "../api/settings";
import { FormField } from "@/shared/ui/FormField";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { Surface } from "@/shared/ui/Surface";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";

export type SettingsFieldErrors = Partial<Record<SettingField, string>>;

interface Props {
  draft: SettingsDraft;
  errors: SettingsFieldErrors;
  disabled: boolean;
  onChange: (changes: Partial<SettingsDraft>) => void;
}

export function SettingsForm({ draft, errors, disabled, onChange }: Props) {
  const { t } = useTranslation("settings");
  const zones = [...new Set([draft.defaultTimeZoneId, "America/Argentina/Buenos_Aires", "UTC", ...Intl.supportedValuesOf("timeZone")])].sort();
  return <>
    <Surface title={t("sections.regional")} padded>
      <p className="max-w-2xl text-sm text-[var(--color-content-muted)]">{t("hints.regional")}</p>
      <div className="flex flex-wrap gap-4">
        <div className="w-72 max-w-full"><FormField label={t("fields.defaultCulture")} error={errors.defaultCulture}>
          <NativeSelect value={draft.defaultCulture} disabled={disabled} onChange={event => onChange({ defaultCulture: event.target.value as SettingsDraft["defaultCulture"] })}>
            {["es", "en"].map(language => <option key={language} value={language}>{t(`common:language.${language}`)}</option>)}
          </NativeSelect>
        </FormField></div>
        <div className="w-96 max-w-full"><FormField label={t("fields.defaultTimeZoneId")} error={errors.defaultTimeZoneId}>
          <NativeSelect value={draft.defaultTimeZoneId} disabled={disabled} onChange={event => onChange({ defaultTimeZoneId: event.target.value })}>
            {zones.map(zone => <option key={zone} value={zone}>{zone.replaceAll("_", " ")}</option>)}
          </NativeSelect>
        </FormField></div>
      </div>
      <div className="space-y-1">
        <p className="text-sm text-[var(--color-content-muted)]">{t("preview.label")}</p>
        <p className="text-sm font-medium">{formatDateTimeInZone("2026-10-01T15:30:00Z", draft.defaultCulture, draft.defaultTimeZoneId)}</p>
      </div>
    </Surface>
    <Surface title={t("sections.lists")} padded>
      <div className="w-72 max-w-full"><FormField label={t("fields.defaultPageSize")} error={errors.defaultPageSize}>
        <NativeSelect value={draft.defaultPageSize} disabled={disabled} onChange={event => onChange({ defaultPageSize: Number(event.target.value) })}>
          {[10, 20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
        </NativeSelect>
      </FormField></div>
      <p className="max-w-2xl text-sm text-[var(--color-content-muted)]">{t("hints.listados")}</p>
    </Surface>
    <Surface title={t("sections.registration")} padded>
      <div className="max-w-2xl"><RadioGroupField label={t("registration.title")} value={draft.registrationMode}
        onValueChange={value => onChange({ registrationMode: value as RegistrationMode })} error={errors.registrationMode}
        options={[
          { value: "InviteOnly", label: t("registration.InviteOnlyLabel"), description: t("registration.inviteOnly"), disabled },
          { value: "Open", label: t("registration.OpenLabel"), description: t("registration.open"), disabled },
        ]} />
      </div>
    </Surface>
  </>;
}
