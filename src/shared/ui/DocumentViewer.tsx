import { useState } from "react";
import { useTranslation } from "react-i18next";
import { savePrivateBlob } from "@/shared/hooks/usePrivateFormFile";
import { formatPercent } from "@/shared/lib/numberFormat";
import { cn } from "@/shared/lib/utils";
import { Button } from "./button";
import { DisabledReason } from "./DisabledReason";
import { EmbeddedPreview } from "./EmbeddedPreview";
import { IconButton } from "./IconButton";
import { PrivateImage } from "./PrivateImage";
import { Spinner } from "./Spinner";
import { DownloadIcon, FileIcon, RotateIcon, ZoomInIcon, ZoomOutIcon } from "./icons";

const zooms = [0.5, 0.75, 1, 1.5, 2, 3] as const;
const photoTypes = new Set(["image/jpeg", "image/png"]);

/**
 * A document read where it is used (DOC5-A, «Documentos recibidos»): a photo is brought closer, taken away and turned a quarter at a
 * time, inside its box, which scrolls when the photo is bigger than it; a PDF uses the browser's viewer, with its pages and its zoom;
 * anything else has no preview. All of them download as they are. Presentation only: the owner reads the bytes with its permission and
 * says how that went (`loading`, `failed` with its «Reintentar» and the reason it waits); it knows no feature, route nor credential.
 * Its box keeps the same height while the file arrives, so nothing below it moves.
 */
export function DocumentViewer({ name, mediaType, blob, loading = false, failed = false, onRetry, retryReason, className }: {
  name: string;
  mediaType: string;
  blob?: Blob;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
  retryReason?: string | null;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const photo = photoTypes.has(mediaType);
  const pdf = mediaType === "application/pdf";
  const [view, setView] = useState({ blob, zoom: 2, turns: 0 });
  // Another file starts at its size and upright.
  if (view.blob !== blob) setView({ blob, zoom: 2, turns: 0 });
  const zoom = zooms[view.zoom];
  const quarter = view.turns % 2 === 1;
  const ready = !!blob && !loading;
  const box = "h-[min(26rem,50svh)] min-h-0 bg-[var(--color-surface-muted)]";
  return (
    <div className={cn("flex flex-col overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)]", className)}>
      <div role="toolbar" aria-label={t("documentViewer.toolbar", { name })} className="flex flex-wrap items-center gap-1 border-b border-[var(--color-border)] px-2 py-1">
        {photo ? (
          <>
            <IconButton label={t("documentViewer.zoomOut")} disabled={!ready || view.zoom === 0} onClick={() => setView(current => ({ ...current, zoom: current.zoom - 1 }))}><ZoomOutIcon className="size-4" /></IconButton>
            <span aria-live="polite" className="min-w-12 text-center text-xs tabular-nums text-[var(--color-content-muted)]">{t("documentViewer.zoom", { percent: formatPercent(zoom, i18n.language) })}</span>
            <IconButton label={t("documentViewer.zoomIn")} disabled={!ready || view.zoom === zooms.length - 1} onClick={() => setView(current => ({ ...current, zoom: current.zoom + 1 }))}><ZoomInIcon className="size-4" /></IconButton>
            <IconButton label={t("documentViewer.rotate")} disabled={!ready} onClick={() => setView(current => ({ ...current, turns: (current.turns + 1) % 4 }))}><RotateIcon className="size-4" /></IconButton>
          </>
        ) : null}
        <Button type="button" variant="outline" size="sm" className="ml-auto" disabled={!ready} onClick={() => { if (blob) savePrivateBlob(blob, name); }}>
          <DownloadIcon className="size-4" />{t("documentViewer.download")}
        </Button>
      </div>
      {loading ? (
        <div role="status" className={cn(box, "flex items-center justify-center gap-2 text-sm text-[var(--color-content-muted)]")}><Spinner decorative />{t("documentViewer.loading")}</div>
      ) : failed || !blob ? (
        <div className={cn(box, "flex flex-col items-center justify-center gap-3 px-4 text-center text-sm")}>
          <p>{t("documentViewer.failed")}</p>
          {onRetry ? <DisabledReason reason={retryReason}><Button type="button" variant="outline" disabled={!!retryReason} onClick={onRetry}>{t("actions.retry")}</Button></DisabledReason> : null}
        </div>
      ) : photo ? (
        // The photo fills its stage, which grows with the zoom and scrolls inside the box; turned a quarter, it takes the stage's
        // other measures before turning, so it never leaves it.
        <div className={cn(box, "overflow-auto")} tabIndex={0} aria-label={t("documentViewer.photo", { name })} role="region">
          <div className="relative min-h-full min-w-full" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, containerType: "size" }}>
            <PrivateImage blob={blob} alt={name} className="absolute top-1/2 left-1/2 max-w-none object-contain"
              style={{ width: quarter ? "100cqh" : "100cqw", height: quarter ? "100cqw" : "100cqh", transform: `translate(-50%, -50%) rotate(${view.turns * 90}deg)` }} />
          </div>
        </div>
      ) : pdf ? (
        <EmbeddedPreview blob={blob} title={t("documentViewer.pdf", { name })} kind="pdf" className={cn(box, "rounded-none border-0")} />
      ) : (
        <div className={cn(box, "flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-[var(--color-content-muted)]")}>
          <FileIcon className="size-8" />
          <p>{t("documentViewer.noPreview")}</p>
        </div>
      )}
    </div>
  );
}
