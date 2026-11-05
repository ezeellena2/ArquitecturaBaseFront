import { useId, useRef, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

interface CertificatePickerProps {
  label: string;
  pending: boolean;
  disabled: boolean;
  /// El texto del servidor cuando el certificado no corresponde: otra clave, otra CUIT, otro ambiente o vencido.
  error: string | null;
  /// En el alta, el botón va dentro de una zona punteada donde también se puede soltar el .crt.
  dropZone?: boolean;
  /// En la renovación es la acción principal de la zona.
  primary?: boolean;
  onPick: (pem: string) => void;
}

/// Elegir el .crt que dio ARCA: se lee en el navegador y viaja como texto. El error queda junto al botón.
export function CertificatePicker({ label, pending, disabled, error, dropZone = false, primary = false, onPick }: CertificatePickerProps) {
  const { t } = useTranslation("arca");
  const picker = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const [dragging, setDragging] = useState(false);
  function read(file: File | undefined) { if (file) void file.text().then(onPick); }
  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!disabled) read(event.dataTransfer.files[0]);
  }
  const choose = <Button variant={primary ? "default" : "outline"} disabled={disabled} pending={pending} aria-describedby={error ? errorId : undefined}
    onClick={() => picker.current?.click()}>{pending ? t("certificate.uploading") : label}</Button>;
  return <div className="flex flex-col gap-1.5">
    <Input ref={picker} type="file" hidden tabIndex={-1} accept=".crt,.cer,.pem" aria-label={t("certificate.file")}
      onChange={event => {
        const file = event.target.files?.[0];
        event.target.value = "";
        read(file);
      }} />
    {dropZone ? <div onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}
      className={"flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-dashed px-4 py-5 text-sm "
        + (dragging ? "border-[var(--color-brand-500)] bg-[var(--color-brand-50)]" : "border-[var(--color-input)]")}>
      <span className="text-[var(--color-content-muted)]">{t("certificate.drop")}</span>{choose}
    </div> : <div className="flex flex-wrap items-center gap-2">{choose}</div>}
    {error ? <p id={errorId} role="alert" className="text-sm text-[var(--color-danger)]">{error}</p> : null}
  </div>;
}
