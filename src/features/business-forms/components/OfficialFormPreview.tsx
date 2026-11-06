import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { EmbeddedPreview } from "@/shared/ui/EmbeddedPreview";
import { Spinner } from "@/shared/ui/Spinner";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { fetchFormPreview } from "../api/forms";
import { ExpiredFormPreview, type readFormPreview } from "../api/response";
import type { FormCulture } from "../model";

// VO1-A (2026-11-06): Meta lays its official preview out for a 430 × 800 frame, the size its documentation embeds. The dialog gives
// it that room in rem (26.875 × 50 at 16 px), so on the desktop scale it shrinks with the rest of the app, and the page scales
// whole to fit a shorter or narrower window.
const META_FRAME = { width: 430, height: 800 } as const;

// Meta's page takes a moment to draw after its URL arrives: until the frame loads, the region says it is loading. The listener
// is attached before the browser paints, so a load cannot be missed.
function OfficialFrame({ url, title, loading }: { url: string; title: string; loading: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  useLayoutEffect(() => {
    const frame = host.current?.querySelector("iframe");
    if (!frame) return;
    const done = () => setLoaded(url);
    frame.addEventListener("load", done);
    return () => frame.removeEventListener("load", done);
  }, [url]);
  return <div ref={host} className="relative flex min-h-0 flex-1 flex-col">
    {loaded === url ? null : <div role="status" className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-surface)]"><Spinner decorative /><p>{loading}</p></div>}
    <EmbeddedPreview url={url} title={title} frame={META_FRAME} className="min-h-0 flex-1" />
  </div>;
}

// The expiring official URL stays in this dialog. It never enters QueryCache or storage.
// It shows the menu language when that version published it and, otherwise, the original.
export function OfficialFormPreview({ definitionId, versionId, versionNumber, culture: menuCulture, originalCulture, cultures, onClose }: { cultures: readonly FormCulture[]; definitionId: string; versionId: string; versionNumber: number; culture: FormCulture; originalCulture: FormCulture; onClose: () => void }) {
  const { t } = useTranslation("forms");
  const restoreFocus = useRestoreFocusOnClose(true);
  const culture = cultures.includes(menuCulture) ? menuCulture : cultures.includes(originalCulture) ? originalCulture : cultures[0]!;
  const [preview,setPreview] = useState<ReturnType<typeof readFormPreview> | null>(null);
  const [busy,setBusy] = useState(false);
  const [expired,setExpired] = useState(false);
  const [failed,setFailed] = useState(false);
  const [denied,setDenied] = useState(false);
  const [now,setNow] = useState(() => Date.now());
  const [waitUntil,setWaitUntil] = useState(0);
  const flight = useRef<AbortController | null>(null);
  const active = useRef(true);
  const noticeId = "forms:official-preview:" + definitionId;
  const load = useCallback(async (selectedCulture: FormCulture) => {
    if (denied || Date.now() < waitUntil) return;
    flight.current?.abort();
    const controller = new AbortController(); flight.current = controller;
    setPreview(null);setExpired(false);setFailed(false);setBusy(true);
    try {
      const value = await fetchFormPreview(definitionId,versionId,selectedCulture,controller.signal);
      if (active.current && !controller.signal.aborted && flight.current===controller) {setPreview(value);setNow(Date.now());dismissNotification(noticeId);}
    } catch(error) {
      if (!active.current || controller.signal.aborted || flight.current!==controller) return;
      const feedback = errorFeedback(error);
      const hasExpired = error instanceof ExpiredFormPreview || error instanceof ApiError && ["Forms.Preview.Expired","WhatsApp.Flow.PreviewUnavailable"].includes(error.code??"");
      setExpired(hasExpired);setFailed(!hasExpired);setDenied(feedback.kind==="forbidden");
      if (feedback.kind==="wait") setWaitUntil(Date.now()+(feedback.retryAfterSeconds??30)*1000);
      if (!["cancelled","session"].includes(feedback.kind)) notify({id:noticeId,kind:hasExpired?"warning":"error",message:hasExpired?t("publication.previewExpired"):feedback.detail??t("publication.previewFailed"),description:feedback.traceId?t("common:errors.traceId",{traceId:feedback.traceId}):undefined});
    } finally {if (flight.current===controller){flight.current=null;if(active.current)setBusy(false);}}
  }, [denied,waitUntil,definitionId,versionId,noticeId,t]);
  const loadCurrent = useRef(() => load(culture));
  const generation = useRef(0);
  useEffect(() => { loadCurrent.current = () => load(culture); }, [load,culture]);
  useEffect(()=>{active.current=true;const epoch=++generation.current;queueMicrotask(()=>{if(active.current&&generation.current===epoch)void loadCurrent.current();});return()=>{active.current=false;flight.current?.abort();dismissNotification(noticeId);};},[definitionId,versionId,culture,noticeId]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
  if (preview && Date.parse(preview.expiresAtUtc)<=now) {setPreview(null);setExpired(true);}
  const live = preview && Date.parse(preview.expiresAtUtc)>now ? preview : null;
  // VO1-A (2026-11-06): the backend gives the link ready to be gone through (Meta's interactive mode, from the Flow's first screen and
  // with sample options of each list): the frame and «Abrir en otra pestaña» use it as it comes.
  const view = live?.url ?? null;
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}>
    {/* The dialog is as tall as Meta's frame and its title and footer (8rem), or the window, and as wide as the frame. */}
    <DialogContent className="flex h-[min(58rem,calc(100svh-2rem))] w-[28.875rem] flex-col overflow-hidden sm:max-w-[calc(100%-2rem)]" aria-describedby={undefined} onCloseAutoFocus={restoreFocus}>
      <DialogHeader><DialogTitle>{t("publication.previewTitle",{version:versionNumber})}</DialogTitle></DialogHeader>
      {/* While it loads, expires or fails, the region keeps the room of the frame: the dialog does not jump when the view arrives. */}
      <div className="flex min-h-0 flex-1 flex-col">
        {busy ? <div role="status" className="flex flex-1 items-center justify-center gap-2"><Spinner /><p>{t("publication.previewLoading")}</p></div> : view ? <OfficialFrame url={view} title={t("publication.previewFrame")} loading={t("publication.previewLoading")} /> : <p className="flex flex-1 items-center justify-center text-center text-sm text-[var(--color-content-muted)]">{t(denied?"publication.previewNoPermission":expired?"publication.previewExpired":failed?"publication.previewUnavailable":"publication.previewChoose")}</p>}
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>{t("common:actions.close")}</Button>
        {view ? <Button asChild variant="outline"><a href={view} target="_blank" rel="noopener noreferrer">{t("publication.previewOpen")}</a></Button> : null}
        {!denied ? <DisabledReason reason={!busy&&now<waitUntil?t("wait",{count:Math.ceil((waitUntil-now)/1000)}):null} className="max-sm:*:flex-1"><Button disabled={busy||now<waitUntil} onClick={()=>void load(culture)}>{t(expired||live?"publication.previewRenew":"publication.previewLoad")}</Button></DisabledReason> : null}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
