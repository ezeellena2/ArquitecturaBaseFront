/// El backend manda las fechas en UTC con `Z` (sección 6.3 del spec maestro) y la pantalla las muestra en la
/// zona horaria del perfil, nunca la cadena cruda. Es el único formateador de fecha y hora del front: si
/// aparece otro, las mismas fechas se van a ver distinto en dos pantallas.
///
/// `timeZone: undefined` deja la del navegador, que es lo correcto mientras el perfil todavía no llegó.
export function formatDateTimeInZone(valueUtc: string, language: string, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone }).format(
    new Date(valueUtc),
  );
}
