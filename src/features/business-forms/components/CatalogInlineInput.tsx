import { useId } from "react";
import { Input } from "@/shared/ui/input";
// `placeholder` carries the original's text of a translation the cell has no room to describe.
export function CatalogInlineInput({ label, value, placeholder, readOnly, onChange, onBlur, error, warning, count = false, type = "text", inputMode, maxLength }: { label: string; value: string; placeholder?: string; readOnly: boolean; onChange: (value: string) => void; onBlur?: () => void; error?: string; warning?: string; count?: boolean; type?: "text" | "date"; inputMode?: "numeric" | "decimal"; maxLength?: number }) {
  const id = useId(), message = error ?? warning;
  return <div className="min-w-32"><div className="flex items-center gap-1"><Input maxLength={maxLength} type={type} inputMode={inputMode} className="min-w-0" aria-label={label} aria-invalid={!!error} aria-describedby={message ? id : undefined} placeholder={placeholder} readOnly={readOnly} value={value} onChange={event => onChange(event.target.value)} onBlur={onBlur}/>{count ? <span className="shrink-0 text-xs text-[var(--color-content-muted)]">{value.length}/30</span> : null}</div>{message ? <p id={id} role={error ? "alert" : undefined} className={error ? "whitespace-normal text-xs text-[var(--color-danger)]" : "whitespace-normal text-xs text-[var(--color-warning-700)]"}>{message}</p> : null}</div>;
}
