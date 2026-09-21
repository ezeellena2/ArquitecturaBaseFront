import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { currentUserQueryKey, useCurrentUser } from "./useCurrentUser";
import { updateProfile } from "@/shared/api/profile";
import i18n, { changeLanguage, isSupportedLanguage, type SupportedLanguage } from "@/shared/i18n";

/// Aplica en la interfaz el idioma que tiene guardado la cuenta, apenas llega el perfil (sección 9 del spec de
/// la Fase 4). Está montado en `AppLayout`, así que vale para toda pantalla con sesión, y es el **único**
/// lugar del front donde el idioma de la cuenta se aplica.
///
/// **Cuando el idioma de la cuenta y el de este navegador difieren, gana el de la cuenta.** Es el que la
/// persona guardó a propósito y el que la sigue a cualquier máquina; el de `localStorage` es apenas lo último
/// que se eligió en esta. Desde esta tarea, todo cambio hecho con la sesión abierta se guarda en la cuenta,
/// así que si los dos valores no coinciden es porque el de la cuenta se cambió en otro navegador, o porque el
/// de acá se eligió antes de ingresar, en la pantalla de ingreso, que es la única que sigue guardando solo en
/// el navegador.
export function useProfileLanguageSync(): void {
  const { data: user } = useCurrentUser();
  const culture = user?.culture;

  useEffect(() => {
    // Depende solo del `culture` que trae el perfil, a propósito. Si dependiera también del idioma actual,
    // volvería a pisarlo apenas alguien lo cambia desde el menú, antes de que termine el guardado.
    // `i18n.language` se lee del módulo (no de `useTranslation`) para no suscribir a este hook a cada cambio.
    if (!isSupportedLanguage(culture) || culture === i18n.language) {
      return;
    }

    void changeLanguage(culture);
  }, [culture]);
}

/// Cambiar el idioma desde una pantalla con sesión: se aplica en la interfaz y se guarda en la cuenta.
///
/// No es un `useMutation` porque no es solo una llamada al servidor: primero toca un sistema externo
/// (i18next) y, si el guardado falla, lo tiene que devolver atrás. Lo que no puede pasar, de ninguna de las
/// tres formas, es que la interfaz y la cuenta queden diciendo cosas distintas.
export function useLanguagePreference(): { change: (language: SupportedLanguage) => Promise<void> } {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();

  async function change(language: SupportedLanguage): Promise<void> {
    const previous = isSupportedLanguage(i18n.language) ? i18n.language : "es";

    if (language === previous) {
      return;
    }

    // La interfaz cambia ya: es lo único que la persona pidió ver, y hacerla esperar una ida y vuelta sería
    // peor que el riesgo de tener que volver atrás.
    await changeLanguage(language);

    // Sin perfil no hay dónde guardarlo (todavía no llegó, o no hay sesión): vale para este navegador y listo.
    if (!user) {
      return;
    }

    try {
      await updateProfile({ displayName: user.displayName, culture: language, timeZoneId: user.timeZoneId });
      // El perfil lo usa medio front (el menú, la barra lateral, las fechas de los listados) y además es de
      // donde `useProfileLanguageSync` toma el idioma: si esto no se invalida, la caché queda diciendo el
      // idioma viejo y lo reaplica en el próximo montaje.
      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
    } catch {
      await changeLanguage(previous);
      toast.error(t("language.saveFailed"));
    }
  }

  return { change };
}
