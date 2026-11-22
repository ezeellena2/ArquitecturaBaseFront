import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { FormField } from "@/shared/ui/FormField";
import { Picker } from "@/shared/ui/Picker";
import { Input } from "@/shared/ui/input";
import { Surface } from "@/shared/ui/Surface";
import { Textarea } from "@/shared/ui/textarea";
import { businessLocationLink } from "../businessDetailsModel";
import type { BusinessLocation } from "../api/businessInformation";
import { BusinessPlaceSearch } from "./BusinessPlaceSearch";
const modes: readonly BusinessLocation["mode"][] = ["unknown", "local", "area", "both"];
// `placeSearch`: the installation has the Google key (`place-search`, I7); without it the search is not offered and the address is manual.
interface Props { value: BusinessLocation; onChange: (value: BusinessLocation) => void; editable: boolean; locked: boolean; placeSearch: boolean; error?: string; legacy: React.ReactNode }
export function BusinessLocationEditor({ value, onChange, editable, locked, placeSearch, error, legacy }: Props) {
  const { t } = useTranslation("businessInformation");
  const link = businessLocationLink(value);
  const cleared = { latitude: null, longitude: null, placeId: null };
  return <Surface title={t("locationSection")} padded>
    <div id="business-details.location" tabIndex={-1} role="group" aria-label={t("locationSection")} aria-invalid={!!error} aria-describedby={error ? "business-location-error" : undefined} className="space-y-4">
      {/* The four ways of attending go in the shared piece for choosing, like any list (DS1-A, 2026-11-22). */}
      <div className="w-full sm:w-72"><FormField label={t("locationType")}>
        <Picker label={t("locationType")} disabled={!editable || locked} value={value.mode} options={modes.map(mode => ({ id: mode, label: t(mode) }))}
          onChange={next => {
            const mode = modes.find(item => item === next);
            if (!mode || mode === value.mode) return;
            onChange({ ...value, mode, ...(mode === "unknown" || mode === "area" ? { address: "", reference: "", ...cleared } : {}), ...(mode === "unknown" || mode === "local" ? { area: "" } : {}) });
          }} />
      </FormField></div>
      {value.mode === "local" || value.mode === "both" ? <>
        {/* Sin leyendas: al cambiar la dirección el enlace se vacía a la vista, y el enlace vacío ya dice que no hay lugar elegido. */}
        <FormField label={t("address")}><Input value={value.address} maxLength={500} readOnly={!editable} disabled={locked} onChange={event => onChange({ ...value, address: event.target.value, ...cleared })} /></FormField>
        {editable && placeSearch ? <BusinessPlaceSearch disabled={locked} placeId={value.placeId} onSelect={placeId => onChange({ ...value, latitude: null, longitude: null, placeId })} /> : null}
        <FormField label={t("locationLink")}><Input type="url" value={link} readOnly /></FormField>
        {link ? <div className="flex flex-wrap items-center gap-3"><a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--color-brand-600)] underline underline-offset-2">{t("openLocation")}</a>{editable ? <Button variant="muted-link" disabled={locked} onClick={() => onChange({ ...value, ...cleared })}>{t("removePoint")}</Button> : null}</div> : null}
        <FormField label={t("reference")}><Input value={value.reference} maxLength={500} readOnly={!editable} disabled={locked} placeholder={t("referencePlaceholder")} onChange={event => onChange({ ...value, reference: event.target.value })} /></FormField>
      </> : null}
      {value.mode === "area" || value.mode === "both" ? <FormField label={t("serviceArea")}><Textarea value={value.area} rows={2} maxLength={500} readOnly={!editable} disabled={locked} onChange={event => onChange({ ...value, area: event.target.value })} /></FormField> : null}
      {error ? <p id="business-location-error" role="alert" className="text-sm text-[var(--color-danger)]">{error}</p> : null}
    </div>
    {legacy}
  </Surface>;
}
