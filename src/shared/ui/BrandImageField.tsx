import { useId, useRef, type CSSProperties, type ReactNode } from "react";
import { contrastRatio } from "@/shared/lib/appearance";
import { Button } from "./button";
import { IconButton } from "./IconButton";
import { InfoTip } from "./InfoTip";
import { Skeleton } from "./skeleton";
import { TrashIcon } from "./icons";

export interface BrandImageFieldLabels {
  label: string; help: string; helpLabel: string; upload: string; uploadOther: string; uploading: string; remove: string; current: string;
}

/// ME2: an image of the installation's brand. The sample is the band of the menu with its color: the logo (or, without it, the name)
/// or the icon; beside it, upload (the browser's file picker) and remove in red. What the file has to be goes in the (i).
export function BrandImageField({ shape, url, fallback, background, accept, uploading, disabled, error, labels, onFile, onRemove }: {
  shape: "wide" | "square"; url: string | null; fallback?: string; background: string; accept: readonly string[]; uploading: boolean;
  disabled: boolean; error?: string; labels: BrandImageFieldLabels; onFile: (file: File | undefined) => void; onRemove: () => void;
}): ReactNode {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const ink = contrastRatio("#FFFFFF", background) >= contrastRatio("#000000", background) ? "#FFFFFF" : "#000000";
  const wide = shape === "wide";
  return <div role="group" aria-labelledby={`${id}-label`} className="flex min-w-0 flex-col gap-1.5">
    <span className="flex items-center gap-1">
      <span id={`${id}-label`} className="text-sm font-medium text-[var(--color-content)]">{labels.label}</span>
      <InfoTip text={labels.help} label={labels.helpLabel} />
    </span>
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className={wide ? "flex h-12 w-50 max-w-full shrink-0 items-center overflow-hidden rounded-[var(--radius-control)] px-3"
        : "flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-control)]"} style={{ background, color: ink } as CSSProperties}>
        {uploading ? <Skeleton aria-hidden="true" className={wide ? "h-4 w-30 opacity-25" : "size-7 opacity-25"} style={{ background: ink }} />
          : url ? <img src={url} alt={labels.current} className={wide ? "block h-7 w-auto max-w-full object-contain object-left" : "block size-7 rounded-[var(--radius-control)] object-contain"} />
          : fallback ? <span className="truncate text-sm font-semibold">{fallback}</span> : null}
      </span>
      <Button variant="outline" pending={uploading} disabled={disabled} aria-describedby={error ? `${id}-error` : undefined} onClick={() => input.current?.click()}>
        {uploading ? labels.uploading : url ? labels.uploadOther : labels.upload}
      </Button>
      {url && !uploading ? <IconButton label={labels.remove} disabled={disabled} className="text-[var(--color-danger)]" onClick={onRemove}>
        <TrashIcon className="size-4" />
      </IconButton> : null}
      <input ref={input} type="file" accept={accept.join(",")} className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={event => { onFile(event.target.files?.[0]); event.target.value = ""; }} />
    </div>
    {error ? <p id={`${id}-error`} role="alert" className="text-sm text-[var(--color-danger)]">{error}</p> : null}
  </div>;
}
