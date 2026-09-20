import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "./input";

/// Búsqueda con espera: no dispara una consulta por cada tecla.
export function SearchInput({
  value,
  onChange,
  delay = 300,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  delay?: number;
  label?: string;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);
  const [previousValue, setPreviousValue] = useState(value);

  // El valor externo cambió (por ejemplo, se limpiaron los filtros): se ajusta durante el render, no en un
  // efecto aparte, para no disparar un segundo render innecesario.
  if (value !== previousValue) {
    setPreviousValue(value);
    setDraft(value);
  }

  useEffect(() => {
    if (draft === value) {
      return;
    }

    const timer = setTimeout(() => onChange(draft), delay);

    return () => clearTimeout(timer);
  }, [draft, delay, onChange, value]);

  return (
    <Input
      type="search"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      aria-label={label ?? t("actions.search")}
      placeholder={label ?? t("actions.search")}
    />
  );
}
