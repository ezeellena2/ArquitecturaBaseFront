import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { notify } from "@/shared/ui/notifications";
import { Page } from "@/shared/ui/Page";
import { Surface } from "@/shared/ui/Surface";

export function ConnectionProposal() {
  const { t } = useTranslation("finalProposal");
  const [connected, setConnected] = useState(true);
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreFocus = useRestoreFocusOnClose(open);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function check() { setChecking(true); timer.current = setTimeout(() => { setChecking(false); notify({ id: "proposal-connection", kind: "success", message: t("checked") }); }, 600); }
  return <Page title={t("connection")} actions={<Button variant="outline" onClick={() => setOpen(true)}>{t("setup")}</Button>}>
    <div className="chat-lab-controls"><p className="text-sm text-[var(--color-content-muted)]">{t("lab")}</p><div className="chat-lab-select"><FormField label={t("state")}><NativeSelect value={connected ? "connected" : "disconnected"} onChange={event => setConnected(event.target.value === "connected")}><option value="connected">{t("connected")}</option><option value="disconnected">{t("disconnected")}</option></NativeSelect></FormField></div></div>
    <div className="ai-simple">{connected ? <Surface padded><div className="ai-fields"><FormField label={t("businessName")}><Input value={t("business")} readOnly /></FormField><FormField label={t("number")}><Input value="+54 9 11 5555-0100" readOnly /></FormField></div><FormField label={t("status")}><Input value={t("connected")} readOnly /></FormField><FormField label={t("credential")}><Input value={t("configured")} readOnly /></FormField><p className="text-sm text-[var(--color-content-muted)]">{t("setupHint")}</p><div><Button variant="outline" disabled={checking} onClick={check}>{t(checking ? "checking" : "check")}</Button></div></Surface> : <Surface><EmptyState embedded title={t("noConnection")} description={t("noConnectionHint")} action={<Button variant="outline" onClick={() => setOpen(true)}>{t("setup")}</Button>} /></Surface>}</div>
    <p className="mt-4 text-xs text-[var(--color-content-muted)]">{t("isolated")}</p>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent onCloseAutoFocus={restoreFocus}><DialogHeader><DialogTitle>{t("setupTitle")}</DialogTitle><DialogDescription>{t("onlyAdmin")}</DialogDescription></DialogHeader><ol className="list-decimal space-y-3 pl-5 text-sm">{["setupOne", "setupTwo", "setupThree"].map(key => <li key={key}>{t(key)}</li>)}</ol><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("close")}</Button></DialogFooter></DialogContent></Dialog>
  </Page>;
}
