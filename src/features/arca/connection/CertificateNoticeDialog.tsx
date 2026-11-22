import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { changeArcaCertificateNotice, type ArcaConnection } from "./api";
import { certificateNoticeDays, isValidCertificateNotice } from "./model";
import { useArcaAction } from "./useArcaAction";

/// AC5-A: «Aviso de vencimiento», que abre el lápiz del renglón de «Certificado»: desde cuántos días antes del vencimiento
/// avisan la pantalla y el correo a quienes administran la conexión (RC7-B). Guarda con la revisión de la conexión: un 409
/// cierra el diálogo y abre «Revisar»; un número fuera de rango se marca en el campo sin llamar al servidor. Se monta sólo
/// mientras está abierto, y guarda con los días y la revisión con que se abrió: si la conexión se vuelve a leer mientras tanto
/// (otra pestaña guardó), «Guardar» no se habilita solo y lo de la otra pestaña no se pisa sin el 409.
export function CertificateNoticeDialog({ connection, onChanged, onConflict, onClose }: {
  connection: ArcaConnection;
  onChanged: (connection: ArcaConnection) => void;
  onConflict: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("arca");
  const restoreFocus = useRestoreFocusOnClose();
  const [opened] = useState(() => ({ days: connection.certificateNoticeDays, revision: connection.revision }));
  const [days, setDays] = useState(String(opened.days));
  const [error, setError] = useState<string>();
  const action = useArcaAction(() => { onClose(); onConflict(); });
  const saving = action.pending === "notice";
  const invalid = t("certificate.noticeInvalid", { min: certificateNoticeDays.min, max: certificateNoticeDays.max });

  async function save() {
    const value = Number(days);
    if (days.trim() === "" || !isValidCertificateNotice(value)) { setError(invalid); return; }
    setError(undefined);
    const result = await action.run("notice", () => changeArcaCertificateNotice(value, opened.revision), failure => {
      if (!(failure instanceof ApiError) || failure.code !== "Arca.Connection.CertificateNoticeInvalid") return false;
      setError(invalid);
      return true;
    });
    if (result) { onChanged(result); onClose(); }
  }

  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
    <DialogContent aria-describedby={undefined} closeDisabledReason={saving ? t("certificate.noticeSaving") : undefined} onCloseAutoFocus={restoreFocus}>
      <DialogHeader><DialogTitle>{t("certificate.noticeTitle")}</DialogTitle></DialogHeader>
      <form id="arca-certificate-notice" noValidate onSubmit={event => { event.preventDefault(); void save(); }}>
        <FormField label={t("certificate.noticeDays")} help={t("certificate.noticeHelp")} required error={error}
          beside={<span className="text-sm text-[var(--color-content-muted)]">{t("certificate.noticeDaysUnit")}</span>}>
          <Input id="arca-certificate-notice-days" type="number" inputMode="numeric" step={1} min={certificateNoticeDays.min} max={certificateNoticeDays.max}
            className="w-24" value={days} disabled={saving} onChange={event => setDays(event.target.value)} />
        </FormField>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={saving} onClick={onClose}>{t("data.cancel")}</Button>
        <Button type="submit" form="arca-certificate-notice" pending={saving}
          disabled={saving || days.trim() === String(opened.days)}>
          {t(saving ? "certificate.noticeSaving" : "common:actions.save")}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
