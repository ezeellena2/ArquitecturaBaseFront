import { useCallback } from "react";
import { useTranslation } from "react-i18next";

const secondsPerHour = 60 * 60;

/// Una espera para el texto de un botón o de un aviso («Reintentá en …», «Podés reenviar en …»): hasta una hora, en segundos,
/// como la cuenta regresiva de siempre («45 s»); desde una hora, en horas y minutos («22 h 53 min»), porque un tope diario
/// (N7: los del correo y el de WhatsApp) pide esperar hasta un día. Los minutos se redondean para arriba, como la cuenta lo
/// hace al segundo, así la espera nunca se muestra más corta de lo que es. Los números van con la región del idioma, como
/// todo número de un texto (shared/i18n).
export function useWaitText() {
  const { t } = useTranslation("common");

  return useCallback((seconds: number) => {
    if (seconds < secondsPerHour) return t("wait.seconds", { seconds });

    const totalMinutes = Math.ceil(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return minutes === 0 ? t("wait.hours", { hours }) : t("wait.hoursMinutes", { hours, minutes });
  }, [t]);
}
