import { useTranslation } from "react-i18next";
import { formatCoordinates, mapUrl, type MapPoint } from "@/shared/lib/mapPoint";
import { ExternalLinkIcon, MapPinIcon } from "@/shared/ui/icons";

/** W1-A: a location that arrives is its point, with the pin, and «Ver en el mapa», a link to the map in another tab. */
export function ChatLocation({ point }: { point: MapPoint }) {
  const { t } = useTranslation("whatsapp");
  return <div className="flex flex-col gap-1">
    <p className="flex items-center gap-2 text-sm tabular-nums"><MapPinIcon className="size-4 shrink-0" aria-hidden="true" />{formatCoordinates(point)}</p>
    <a href={mapUrl(point)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[var(--color-brand-700)] underline">
      {t("location.viewOnMap")}<ExternalLinkIcon className="size-3.5 shrink-0" aria-hidden="true" /></a>
  </div>;
}
