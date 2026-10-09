import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { Surface } from "@/shared/ui/Surface";
import { Textarea } from "@/shared/ui/textarea";
import { businessLocationLink } from "../businessDetailsModel";
import type { BusinessLocation } from "../api/businessInformation";
import { BusinessPlaceSearch } from "./BusinessPlaceSearch";
interface Props { value: BusinessLocation; onChange: (value: BusinessLocation) => void; editable: boolean; locked: boolean; error?: string; legacy: React.ReactNode }
export function BusinessLocationEditor({ value, onChange, editable, locked, error, legacy }: Props) {
  const { t } = useTranslation("businessInformation");
  const link = businessLocationLink(value);
  const cleared = { latitude: null, longitude: null, placeId: null };
  return <Surface title={t("locationSection")} padded>
    <div id="business-details.location" tabIndex={-1} role="group" aria-label={t("locationSection")} aria-invalid={!!error} aria-describedby={error ? "business-location-error" : undefined} className="space-y-4">
      <FormField label={t("locationType")}><NativeSelect value={value.mode} disabled={!editable || locked} onChange={event => {
        const mode = event.target.value as BusinessLocation["mode"];
        onChange({ ...value, mode, ...(mode === "unknown" || mode === "area" ? { address: "", reference: "", ...cleared } : {}), ...(mode === "unknown" || mode === "local" ? { area: "" } : {}) });
      }}>{["unknown", "local", "area", "both"].map(mode => <option key={mode} value={mode}>{t(mode)}</option>)}</NativeSelect></FormField>
      {value.mode === "local" || value.mode === "both" ? <>
        <FormField label={t("address")} hint={t("addressHint")}><Input value={value.address} maxLength={500} readOnly={!editable} disabled={locked} onChange={event => onChange({ ...value, address: event.target.value, ...cleared })} /></FormField>
        {editable ? <BusinessPlaceSearch disabled={locked} placeId={value.placeId} onSelect={placeId => onChange({ ...value, latitude: null, longitude: null, placeId })} /> : null}
        <FormField label={t("locationLink")} hint={t("placeLinkHint")}><Input type="url" value={link} readOnly /></FormField>
        {link ? <div className="flex flex-wrap items-center gap-3"><a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--color-brand-600)] underline underline-offset-2">{t("openLocation")}</a>{editable ? <Button variant="muted-link" disabled={locked} onClick={() => onChange({ ...value, ...cleared })}>{t("removePoint")}</Button> : null}</div> : <p className="text-xs text-[var(--color-content-muted)]">{t("noPlaceChosen")}</p>}
        <FormField label={t("reference")}><Input value={value.reference} maxLength={500} readOnly={!editable} disabled={locked} placeholder={t("referencePlaceholder")} onChange={event => onChange({ ...value, reference: event.target.value })} /></FormField>
      </> : null}
      {value.mode === "area" || value.mode === "both" ? <FormField label={t("serviceArea")}><Textarea value={value.area} rows={2} maxLength={500} readOnly={!editable} disabled={locked} onChange={event => onChange({ ...value, area: event.target.value })} /></FormField> : null}
      {error ? <p id="business-location-error" role="alert" className="text-sm text-[var(--color-danger)]">{error}</p> : null}
    </div>
    {legacy}
  </Surface>;
}
