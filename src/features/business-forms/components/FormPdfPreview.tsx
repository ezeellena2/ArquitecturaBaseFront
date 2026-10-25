import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { EmbeddedPreview } from "@/shared/ui/EmbeddedPreview";
import { Spinner } from "@/shared/ui/Spinner";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import type { FormPdfFile } from "../api/pdf";
import type { FormCulture } from "../model";
export function FormPdfPreview({ operationId, load, onForbidden, requestedCulture, example = false, compact = false, disabled = false, name }: {
    operationId: string;
    load: (signal: AbortSignal) => Promise<FormPdfFile>;
    onForbidden: () => void;
    requestedCulture: FormCulture;
    example?: boolean;
    compact?: boolean;
    disabled?: boolean;
    name?: string;
}) {
    const { t } = useTranslation("forms");
    const [pdf, setPdf] = useState<{
        url: string;
        culture: FormCulture;
        fileName: string | null;
    } | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [attempt, setAttempt] = useState(0);
    const [expanded, setExpanded] = useState(false);
    const restore = useRestoreFocusOnClose(expanded);
    const cooldown = useCountdown(0);
    const { restart } = cooldown;
    const [source, setSource] = useState({ load, onForbidden });
    if (source.load !== load || source.onForbidden !== onForbidden) {
        setSource({ load, onForbidden });
        setPdf(null);
        setError(null);
        setExpanded(false);
    }
    useEffect(() => { const controller = new AbortController(); let url: string | null = null; dismissNotification(operationId); void load(controller.signal).then(file => { if (controller.signal.aborted)
        return; url = URL.createObjectURL(file.blob); setPdf({ url, culture: file.contentLanguage, fileName: file.fileName }); dismissNotification(operationId); }).catch(failure => { if (controller.signal.aborted || errorFeedback(failure).kind === "cancelled")
        return; if (failure instanceof ApiError && failure.status === 403) {
        onForbidden();
        return;
    } setError(failure); if (errorFeedback(failure).kind !== "session") notify({ id: operationId, kind: "error", message: readErrorMessage(failure, t) }); if (failure instanceof ApiError && failure.status === 429)
        restart(failure.retryAfterSeconds ?? 60); }); return () => { controller.abort(); dismissNotification(operationId); if (url)
        URL.revokeObjectURL(url); }; }, [operationId, load, onForbidden, attempt, restart, t]);
    return <div className="space-y-3">{pdf ? <><p role="status" className="text-sm text-[var(--color-content-muted)]">{pdf.culture !== requestedCulture ? t("pdf.fallback", { requested: t("cultures." + requestedCulture), actual: t("cultures." + pdf.culture) }) : t("pdf.language", { language: t("cultures." + pdf.culture) })}</p><EmbeddedPreview url={pdf.url} title={t("pdf.previewTitle")} kind="pdf" className={compact ? "h-44 max-w-xs" : undefined}/><div className="flex flex-wrap gap-2">{compact ? <Button variant="outline" size="sm" disabled={disabled} onClick={() => setExpanded(true)}>{t("pdf.view")}</Button> : null}<Button asChild variant="outline" size={compact ? "sm" : "default"} disabled={disabled}><a href={disabled ? undefined : pdf.url} download={pdf.fileName ?? name ?? t("pdf.receipt") + ".pdf"}>{t("pdf.download")}</a></Button></div>{compact ? <Dialog open={expanded} onOpenChange={setExpanded}><DialogContent onCloseAutoFocus={restore}><DialogTitle>{t("pdf.copy")}</DialogTitle><DialogDescription>{pdf.fileName ?? name ?? t("pdf.receipt")}</DialogDescription><EmbeddedPreview url={pdf.url} title={t("pdf.previewTitle")} kind="pdf"/><Button asChild variant="outline" disabled={disabled}><a href={disabled ? undefined : pdf.url} download={pdf.fileName ?? name ?? t("pdf.receipt") + ".pdf"}>{t("pdf.download")}</a></Button><Button variant="outline" onClick={() => setExpanded(false)}>{t("common:actions.close")}</Button></DialogContent></Dialog> : null}</> : error ? <div role="status" className="space-y-2 text-sm"><p>{t("common:states.loadFailed")}</p>{!(error instanceof ApiError && error.status === 404) ? <DisabledReason reason={cooldown.isRunning ? t("wait", { count: cooldown.seconds }) : null}><Button variant="outline" disabled={disabled || cooldown.isRunning} onClick={() => { setPdf(null); setError(null); setAttempt(value => value + 1); }}>{t("common:actions.retry")}</Button></DisabledReason> : null}</div> : <Spinner />}<p className="text-xs text-[var(--color-content-muted)]">{t(example ? "pdf.exampleHint" : "pdf.fixedHint")}</p></div>;
}
