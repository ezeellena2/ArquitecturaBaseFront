import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";

type Frame = { readonly width: number; readonly height: number };

// Read-only preview; the owner validates the URL and supplies an accessible title.
// With `frame`, the page keeps the size its site lays it out for (Meta's interactive official preview: 480 × 840 CSS px) and scales whole to the
// room its owner gives it: never cut and without scroll bars (VO1-A, 2026-11-06).
export function EmbeddedPreview({ url, title, kind = "external", className, frame }: { url: string; title: string; kind?: "external" | "pdf"; className?: string; frame?: Frame }) {
  const sandbox = kind === "pdf" ? undefined : "allow-scripts allow-same-origin allow-forms";
  if (frame) return <FittedPreview url={url} title={title} sandbox={sandbox} frame={frame} className={className} />;
  return <iframe className={cn("h-[min(30rem,55svh)] w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)]", className)} src={url} title={title} sandbox={sandbox} referrerPolicy="no-referrer" />;
}

// The frame is measured against its room before the browser paints, so it never shows at the wrong size; a room that grows or
// shrinks (a narrower window) scales it again. Centered in its room, like a contained image, and never bigger than its own size.
function FittedPreview({ url, title, sandbox, frame, className }: { url: string; title: string; sandbox: string | undefined; frame: Frame; className?: string }) {
  const room = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const element = room.current;
    if (!element) return;
    const fit = () => {
      const { clientWidth: width, clientHeight: height } = element;
      if (width && height) setScale(Math.min(1, width / frame.width, height / frame.height));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [frame.width, frame.height]);
  return <div ref={room} className={cn("flex min-h-0 min-w-0 items-center justify-center overflow-hidden", className)}>
    <div className="relative shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-[var(--color-surface)]" style={{ width: frame.width * scale, height: frame.height * scale }}>
      <iframe className="block origin-top-left border-0" style={{ width: frame.width, height: frame.height, transform: `scale(${scale})` }} src={url} title={title} sandbox={sandbox} referrerPolicy="no-referrer" />
      {/* The edge is drawn over the page, inside the box: a ring outside would be cut by the room when the width is what limits it. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[var(--radius-control)] ring-1 ring-[var(--color-border)] ring-inset" />
    </div>
  </div>;
}
