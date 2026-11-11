import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { IconButton } from "@/shared/ui/IconButton";
import { InfoTip } from "@/shared/ui/InfoTip";
import { AlertTriangleIcon, CloseIcon, ExternalLinkIcon, MapPinIcon } from "@/shared/ui/icons";
import {
  canRequestLocation, formatAccuracy, formatCoordinates, isLowAccuracy, locationAnswer, mapUrl, parseLocationAnswer, requestLocation,
  type LocationProblem,
} from "../locationAnswer";

interface Props {
  /** The answer as the form sends it: the text of the point, or empty. */
  value: string;
  onChange: (value: string) => void;
  id: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  /** The browser's location service; the page's own unless a test passes one. */
  geolocation?: Geolocation;
}

/**
 * «Usar mi ubicación» (UB3-A): nothing is asked until the button is pressed, and the point travels with «Enviar». The point goes
 * in a box like a file, with its accuracy in grey (amber with its (i) above 100 m) and the cross to remove it; under it, «Ver en
 * el mapa» and «Volver a pedirla». Why the browser did not give it goes in a red line under the button.
 */
export function EntryLocationField({ value, onChange, id, invalid, describedBy, disabled, geolocation }: Props) {
  const { t, i18n } = useTranslation("formEntries");
  const mobile = useMediaQuery("(width < 640px)");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<LocationProblem | null>(null);
  const service = geolocation ?? globalThis.navigator?.geolocation;
  const point = parseLocationAnswer(value);
  const problemId = id + "-location-problem";

  async function ask() {
    setPending(true);
    setProblem(null);
    const result = await requestLocation(service);
    setPending(false);
    if ("point" in result) onChange(locationAnswer(result.point));
    else setProblem(result.problem);
  }

  const described = [describedBy, problem ? problemId : undefined].filter(Boolean).join(" ") || undefined;
  const button = (label: string, buttonId?: string) => <Button type="button" id={buttonId} variant="outline" size={mobile ? "touch" : "sm"}
    className={mobile ? "w-full" : undefined} pending={pending} disabled={disabled} aria-invalid={buttonId && invalid || undefined}
    aria-describedby={buttonId ? described : undefined} onClick={() => void ask()}>{pending ? t("location.finding") : label}</Button>;
  const problemLine = problem && problem !== "unsupported"
    ? <p id={problemId} className="text-sm text-[var(--color-danger-700)]" aria-live="polite">{t("location." + problem)}</p> : null;

  if (!canRequestLocation(service)) return <DisabledReason reason={t("location.unsupported")}>
    <Button type="button" id={id} variant="outline" size={mobile ? "touch" : "sm"} className={mobile ? "w-full" : "self-start"} disabled
      aria-invalid={invalid || undefined} aria-describedby={describedBy}><MapPinIcon className="size-4"/>{t("location.use")}</Button>
  </DisabledReason>;

  if (!point) return <div className="flex flex-col items-start gap-2">
    {button(t("location.use"), id)}
    {problemLine}
  </div>;

  const low = isLowAccuracy(point);
  const accuracy = point.accuracyMeters === undefined ? null : formatAccuracy(point.accuracyMeters, i18n.language);
  return <div className="flex flex-col gap-2">
    <div data-location-point className="relative flex items-center gap-3 rounded-[var(--radius-control)] border border-[var(--color-border)] py-2 pr-9 pl-3"
      aria-live="polite">
      <MapPinIcon className="size-5 shrink-0"/>
      <div className="min-w-0">
        <p className="text-sm tabular-nums">{formatCoordinates(point)}</p>
        {accuracy ? low
          ? <p className="flex items-center gap-1 text-xs text-[var(--color-warning-700)]"><AlertTriangleIcon className="size-3.5 shrink-0"/>{accuracy}
            <span className="-my-1 inline-flex"><InfoTip label={t("location.lowAccuracyLabel")} text={t("location.lowAccuracy")}/></span></p>
          : <p className="text-xs text-[var(--color-content-muted)]">{accuracy}</p> : null}
      </div>
      <span className="absolute top-1 right-1"><IconButton variant="destructive-outline" size="icon-sm" label={t("location.remove")} disabled={disabled || pending}
        onClick={() => { setProblem(null); onChange(""); }}><CloseIcon className="size-3.5"/></IconButton></span>
    </div>
    <div className={mobile ? "flex flex-col gap-2" : "flex flex-wrap items-center gap-2"}>
      {mobile
        ? <Button asChild variant="outline" size="touch" className="w-full">
          <a href={mapUrl(point)} target="_blank" rel="noopener noreferrer"><ExternalLinkIcon className="size-4"/>{t("location.viewOnMap")}</a>
        </Button>
        : <a href={mapUrl(point)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[var(--color-brand-700)] underline">
          {t("location.viewOnMap")}<ExternalLinkIcon className="size-3.5 shrink-0"/></a>}
      {button(t("location.askAgain"), id)}
    </div>
    {problemLine}
  </div>;
}
